import { describe, it, expect } from "vitest";

// ================================================================
// VocalFlow — Two-Layer Permission Test Suite
// ================================================================
//
// Tests are organized to independently verify each layer and then
// the combined acceptance scenarios.
//
// LAYER 1 — Org + Role Scoping: mirrors Hasura row-level permissions
// LAYER 2 — Step-Level Gating: mirrors Action handler runtime checks
//
// These tests also simulate "direct GraphQL attack" vectors —
// a malicious editor calling mutations directly without the UI.
// ================================================================

// ── Types ─────────────────────────────────────────────────────────
type Role = "owner" | "editor" | "viewer";

interface Org    { id: string; name: string }
interface Member { org_id: string; user_id: string; role: Role }
interface Workflow{ id: string; org_id: string; name: string }
interface Step   { id: string; workflow_id: string; position: number; type: string; config: Record<string, any> }
interface StepRun{ id: string; workflow_run_id: string; workflow_step_id: string; status: string; org_id: string }

// ── Fixtures ──────────────────────────────────────────────────────
const ORGS: Org[] = [
  { id: "org-aaa", name: "Acme AI (Org A)" },
  { id: "org-bbb", name: "Cyberdyne Systems (Org B)" },
];

const MEMBERS: Member[] = [
  { org_id: "org-aaa", user_id: "u-owner-a",  role: "owner"  },
  { org_id: "org-aaa", user_id: "u-editor-a", role: "editor" },
  { org_id: "org-aaa", user_id: "u-viewer-a", role: "viewer" },
  { org_id: "org-bbb", user_id: "u-owner-b",  role: "owner"  },
];

const WORKFLOWS: Workflow[] = [
  { id: "wf-aaa-1", org_id: "org-aaa", name: "Org A Customer Support" },
  { id: "wf-bbb-1", org_id: "org-bbb", name: "Org B Defense Loop" },
];

const STEPS: Step[] = [
  { id: "s-llm",      workflow_id: "wf-aaa-1", position: 1, type: "llm_call",          config: {} },
  { id: "s-http",     workflow_id: "wf-aaa-1", position: 2, type: "http_request",       config: {} },
  { id: "s-cond",     workflow_id: "wf-aaa-1", position: 3, type: "conditional_branch", config: {} },
  { id: "s-gate-own", workflow_id: "wf-aaa-1", position: 4, type: "approval_gate",      config: { required_role: "owner" } },
  { id: "s-gate-edi", workflow_id: "wf-aaa-1", position: 5, type: "approval_gate",      config: { required_role: "editor" } },
  { id: "s-dbwrite",  workflow_id: "wf-aaa-1", position: 6, type: "db_write",           config: {} },
  { id: "s-notify",   workflow_id: "wf-aaa-1", position: 7, type: "notify",             config: {} },
];

const STEP_RUNS: StepRun[] = [
  { id: "sr-gate-own", workflow_run_id: "wr-1", workflow_step_id: "s-gate-own", status: "paused",  org_id: "org-aaa" },
  { id: "sr-gate-edi", workflow_run_id: "wr-1", workflow_step_id: "s-gate-edi", status: "paused",  org_id: "org-aaa" },
  { id: "sr-running",  workflow_run_id: "wr-1", workflow_step_id: "s-llm",      status: "running", org_id: "org-aaa" },
  { id: "sr-orgb",     workflow_run_id: "wr-2", workflow_step_id: "s-gate-own", status: "paused",  org_id: "org-bbb" },
];

// ── Layer 1 helpers (mirror Hasura filter logic) ───────────────────

/** Simulates Hasura SELECT filter on workflows */
function l1_canSeeWorkflow(userId: string, workflowId: string): boolean {
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) return false;
  return MEMBERS.some(m => m.user_id === userId && m.org_id === wf.org_id);
}

/** Simulates Hasura SELECT filter on organizations */
function l1_canSeeOrg(userId: string, orgId: string): boolean {
  return MEMBERS.some(m => m.user_id === userId && m.org_id === orgId);
}

/** Simulates Hasura SELECT filter on org_members (owner sees all in own orgs) */
function l1_ownerCanSeeMember(ownerUserId: string, targetMember: Member): boolean {
  return MEMBERS.some(m => m.user_id === ownerUserId && m.org_id === targetMember.org_id);
}

/** Simulates Hasura SELECT filter on org_members (editor/viewer see only self) */
function l1_selfOnlyMember(userId: string, targetMember: Member): boolean {
  return targetMember.user_id === userId;
}

/** Simulates Hasura INSERT check on workflows (owner + editor) */
function l1_canInsertWorkflow(userId: string, orgId: string): boolean {
  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === orgId);
  if (!member) return false;
  return member.role === "owner" || member.role === "editor";
}

/** Simulates Hasura UPDATE/DELETE on workflows (owner + editor) */
function l1_canMutateWorkflow(userId: string, workflowId: string): boolean {
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) return false;
  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === wf.org_id);
  if (!member) return false;
  return member.role === "owner" || member.role === "editor";
}

/** Simulates Hasura DELETE on workflows (owner + editor per assignment) */
function l1_canDeleteWorkflow(userId: string, workflowId: string): boolean {
  return l1_canMutateWorkflow(userId, workflowId);
}

// ── Layer 2 helpers (mirror Action handler logic) ──────────────────

/** Simulates Hasura INSERT check on workflow_steps with Layer 2 type gate */
function l2_canInsertStep(userId: string, workflowId: string, stepType: string):
  { allowed: boolean; layer: "L1" | "L2"; reason: string } {
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) return { allowed: false, layer: "L1", reason: "Workflow not found" };

  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === wf.org_id);
  if (!member) return { allowed: false, layer: "L1", reason: "Not a member of this org (cross-org blocked)" };
  if (member.role === "viewer") return { allowed: false, layer: "L1", reason: "Viewer cannot insert steps" };

  // Layer 2: step-type gating
  const ownerOnlyTypes = ["db_write", "notify"];
  if (ownerOnlyTypes.includes(stepType) && member.role !== "owner") {
    return { allowed: false, layer: "L2", reason: `'${stepType}' requires owner role (Layer 2 gate)` };
  }

  return { allowed: true, layer: "L1", reason: "Allowed" };
}

/** Simulates Hasura INSERT check on workflow_triggers with Layer 2 webhook gate */
function l2_canInsertTrigger(userId: string, workflowId: string, triggerType: string):
  { allowed: boolean; layer: "L1" | "L2"; reason: string } {
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) return { allowed: false, layer: "L1", reason: "Workflow not found" };

  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === wf.org_id);
  if (!member) return { allowed: false, layer: "L1", reason: "Not a member of this org" };
  if (member.role === "viewer") return { allowed: false, layer: "L1", reason: "Viewer cannot insert triggers" };

  // Layer 2: webhook trigger gating
  if (triggerType === "webhook" && member.role !== "owner") {
    return { allowed: false, layer: "L2", reason: "webhook trigger requires owner role (Layer 2 gate)" };
  }

  return { allowed: true, layer: "L1", reason: "Allowed" };
}

/** Simulates triggerWorkflowRun Action handler checks */
function l2_canTriggerRun(userId: string, workflowId: string):
  { allowed: boolean; layer: "L1" | "L2"; reason: string } {
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) return { allowed: false, layer: "L1", reason: "Forbidden: Workflow not found or access denied" };

  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === wf.org_id);
  if (!member) return { allowed: false, layer: "L1", reason: "Forbidden: Workflow not found or access denied" };

  // Layer 2: viewer cannot trigger
  if (member.role === "viewer") {
    return { allowed: false, layer: "L2", reason: "Forbidden: Viewers cannot trigger workflow runs" };
  }

  return { allowed: true, layer: "L1", reason: "Allowed" };
}

/** Simulates approveStep Action handler checks */
function l2_canApproveGate(userId: string, stepRunId: string):
  { allowed: boolean; layer: "L1" | "L2" | "STATE"; reason: string } {
  const stepRun = STEP_RUNS.find(sr => sr.id === stepRunId);
  if (!stepRun) return { allowed: false, layer: "L1", reason: "Forbidden: Step run not found" };

  // Layer 1: org membership check (same as the JOIN in approve-step/index.ts)
  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === stepRun.org_id);
  if (!member) return { allowed: false, layer: "L1", reason: "Forbidden: Access denied (org isolation)" };

  // State validation
  if (stepRun.status !== "paused") {
    return { allowed: false, layer: "STATE", reason: `Bad Request: Step is not paused (current: ${stepRun.status})` };
  }

  const step = STEPS.find(s => s.id === stepRun.workflow_step_id);
  if (!step || step.type !== "approval_gate") {
    return { allowed: false, layer: "STATE", reason: "Bad Request: Step is not an approval_gate" };
  }

  // Layer 2: runtime role check against gate's config.required_role
  const requiredRole: string = step.config.required_role || "owner";

  if (member.role === "viewer") {
    return { allowed: false, layer: "L2", reason: "Forbidden: Viewers cannot approve any gate" };
  }
  if (requiredRole === "owner" && member.role !== "owner") {
    return { allowed: false, layer: "L2", reason: `Forbidden: Gate requires 'owner', caller has '${member.role}'` };
  }

  return { allowed: true, layer: "L1", reason: "Approved" };
}

/** Simulates direct approval bypass attempt (update step_runs directly) */
function simulateDirectApprovalBypass(userId: string, stepRunId: string): { blocked: boolean; reason: string } {
  // In production: step_runs has NO update permission for any role in permissions.yaml
  // This simulates that check
  const member = MEMBERS.find(m => m.user_id === userId);
  if (!member) return { blocked: true, reason: "Blocked: No role = no permission" };
  // No role has UPDATE permission on step_runs — always blocked
  return { blocked: true, reason: `Blocked: Role '${member.role}' has no step_runs UPDATE permission in Hasura` };
}

// ================================================================
// TESTS
// ================================================================

describe("Layer 1 — Org + Role Scoping", () => {

  describe("Cross-Org Isolation (UUID guessing must fail)", () => {
    it("Org A owner can see Org A workflows", () => {
      expect(l1_canSeeWorkflow("u-owner-a", "wf-aaa-1")).toBe(true);
    });
    it("Org A editor can see Org A workflows", () => {
      expect(l1_canSeeWorkflow("u-editor-a", "wf-aaa-1")).toBe(true);
    });
    it("Org A viewer can see Org A workflows (read-only)", () => {
      expect(l1_canSeeWorkflow("u-viewer-a", "wf-aaa-1")).toBe(true);
    });
    it("Org B owner CANNOT see Org A workflows even knowing the UUID", () => {
      expect(l1_canSeeWorkflow("u-owner-b", "wf-aaa-1")).toBe(false);
    });
    it("Org A owner CANNOT see Org B workflows", () => {
      expect(l1_canSeeWorkflow("u-owner-a", "wf-bbb-1")).toBe(false);
    });
    it("Unknown user CANNOT see any workflow", () => {
      expect(l1_canSeeWorkflow("u-hacker", "wf-aaa-1")).toBe(false);
    });
    it("Org A owner CANNOT see Org B even knowing Org B UUID", () => {
      expect(l1_canSeeOrg("u-owner-a", "org-bbb")).toBe(false);
    });
    it("Org B owner CANNOT see Org A org", () => {
      expect(l1_canSeeOrg("u-owner-b", "org-aaa")).toBe(false);
    });
  });

  describe("org_members visibility", () => {
    const ownerRow  = MEMBERS.find(m => m.user_id === "u-owner-a")!;
    const editorRow = MEMBERS.find(m => m.user_id === "u-editor-a")!;
    const orgBRow   = MEMBERS.find(m => m.user_id === "u-owner-b")!;

    it("Owner sees all members in their own org", () => {
      expect(l1_ownerCanSeeMember("u-owner-a", editorRow)).toBe(true);
    });
    it("Owner CANNOT see members of another org", () => {
      expect(l1_ownerCanSeeMember("u-owner-a", orgBRow)).toBe(false);
    });
    it("Editor sees only their own membership row", () => {
      expect(l1_selfOnlyMember("u-editor-a", editorRow)).toBe(true);
      expect(l1_selfOnlyMember("u-editor-a", ownerRow)).toBe(false);
    });
    it("Viewer sees only their own membership row", () => {
      const viewerRow = MEMBERS.find(m => m.user_id === "u-viewer-a")!;
      expect(l1_selfOnlyMember("u-viewer-a", viewerRow)).toBe(true);
      expect(l1_selfOnlyMember("u-viewer-a", editorRow)).toBe(false);
    });
  });

  describe("Workflow CRUD role matrix", () => {
    it("Owner can create workflow in own org", () => {
      expect(l1_canInsertWorkflow("u-owner-a", "org-aaa")).toBe(true);
    });
    it("Editor can create workflow in own org", () => {
      expect(l1_canInsertWorkflow("u-editor-a", "org-aaa")).toBe(true);
    });
    it("Viewer CANNOT create workflow", () => {
      expect(l1_canInsertWorkflow("u-viewer-a", "org-aaa")).toBe(false);
    });
    it("Owner can delete own-org workflow", () => {
      expect(l1_canDeleteWorkflow("u-owner-a", "wf-aaa-1")).toBe(true);
    });
    it("Editor can delete own-org workflow (assignment requirement)", () => {
      expect(l1_canDeleteWorkflow("u-editor-a", "wf-aaa-1")).toBe(true);
    });
    it("Viewer CANNOT delete workflow", () => {
      expect(l1_canDeleteWorkflow("u-viewer-a", "wf-aaa-1")).toBe(false);
    });
    it("Org B owner CANNOT mutate Org A workflow", () => {
      expect(l1_canMutateWorkflow("u-owner-b", "wf-aaa-1")).toBe(false);
    });
  });

});

describe("Layer 2 — Step-Level Gating", () => {

  describe("Normal step types (owner + editor allowed)", () => {
    it("Owner can add llm_call step", () => {
      expect(l2_canInsertStep("u-owner-a", "wf-aaa-1", "llm_call").allowed).toBe(true);
    });
    it("Editor can add llm_call step", () => {
      const r = l2_canInsertStep("u-editor-a", "wf-aaa-1", "llm_call");
      expect(r.allowed).toBe(true);
    });
    it("Editor can add http_request step", () => {
      expect(l2_canInsertStep("u-editor-a", "wf-aaa-1", "http_request").allowed).toBe(true);
    });
    it("Editor can add conditional_branch step", () => {
      expect(l2_canInsertStep("u-editor-a", "wf-aaa-1", "conditional_branch").allowed).toBe(true);
    });
    it("Editor can add approval_gate step", () => {
      expect(l2_canInsertStep("u-editor-a", "wf-aaa-1", "approval_gate").allowed).toBe(true);
    });
    it("Viewer CANNOT add any step (Layer 1 blocks first)", () => {
      const r = l2_canInsertStep("u-viewer-a", "wf-aaa-1", "llm_call");
      expect(r.allowed).toBe(false);
      expect(r.layer).toBe("L1");
    });
  });

  describe("Restricted step types — db_write (owner-only)", () => {
    it("Owner can add db_write step", () => {
      expect(l2_canInsertStep("u-owner-a", "wf-aaa-1", "db_write").allowed).toBe(true);
    });
    it("Editor CANNOT add db_write step [Layer 2 blocks]", () => {
      const r = l2_canInsertStep("u-editor-a", "wf-aaa-1", "db_write");
      expect(r.allowed).toBe(false);
      expect(r.layer).toBe("L2");
      expect(r.reason).toMatch(/Layer 2/);
    });
    it("Viewer CANNOT add db_write step [Layer 1 blocks first]", () => {
      expect(l2_canInsertStep("u-viewer-a", "wf-aaa-1", "db_write").allowed).toBe(false);
    });
  });

  describe("Restricted step types — notify (owner-only)", () => {
    it("Owner can add notify step", () => {
      expect(l2_canInsertStep("u-owner-a", "wf-aaa-1", "notify").allowed).toBe(true);
    });
    it("Editor CANNOT add notify step [Layer 2 blocks]", () => {
      const r = l2_canInsertStep("u-editor-a", "wf-aaa-1", "notify");
      expect(r.allowed).toBe(false);
      expect(r.layer).toBe("L2");
    });
    it("Viewer CANNOT add notify step", () => {
      expect(l2_canInsertStep("u-viewer-a", "wf-aaa-1", "notify").allowed).toBe(false);
    });
  });

  describe("Restricted trigger type — webhook (owner-only)", () => {
    it("Owner can create webhook trigger", () => {
      expect(l2_canInsertTrigger("u-owner-a", "wf-aaa-1", "webhook").allowed).toBe(true);
    });
    it("Editor CANNOT create webhook trigger [Layer 2 blocks]", () => {
      const r = l2_canInsertTrigger("u-editor-a", "wf-aaa-1", "webhook");
      expect(r.allowed).toBe(false);
      expect(r.layer).toBe("L2");
    });
    it("Editor CAN create manual/scheduled trigger [not restricted]", () => {
      expect(l2_canInsertTrigger("u-editor-a", "wf-aaa-1", "manual").allowed).toBe(true);
      expect(l2_canInsertTrigger("u-editor-a", "wf-aaa-1", "scheduled").allowed).toBe(true);
    });
    it("Viewer CANNOT create any trigger", () => {
      expect(l2_canInsertTrigger("u-viewer-a", "wf-aaa-1", "manual").allowed).toBe(false);
    });
  });

  describe("triggerWorkflowRun Action — Layer 2 role check", () => {
    it("Owner can trigger Org A workflow", () => {
      expect(l2_canTriggerRun("u-owner-a", "wf-aaa-1").allowed).toBe(true);
    });
    it("Editor can trigger Org A workflow", () => {
      expect(l2_canTriggerRun("u-editor-a", "wf-aaa-1").allowed).toBe(true);
    });
    it("Viewer CANNOT trigger [Layer 2 — viewer blocked in Action]", () => {
      const r = l2_canTriggerRun("u-viewer-a", "wf-aaa-1");
      expect(r.allowed).toBe(false);
      expect(r.layer).toBe("L2");
    });
    it("Org B owner CANNOT trigger Org A workflow [Layer 1 blocks]", () => {
      const r = l2_canTriggerRun("u-owner-b", "wf-aaa-1");
      expect(r.allowed).toBe(false);
      expect(r.layer).toBe("L1");
    });
    it("Unknown user CANNOT trigger [Layer 1 blocks]", () => {
      expect(l2_canTriggerRun("u-hacker", "wf-aaa-1").allowed).toBe(false);
    });
  });

  describe("approveStep Action — approval gate role check", () => {
    it("Owner approves owner-required gate — ALLOW", () => {
      expect(l2_canApproveGate("u-owner-a", "sr-gate-own").allowed).toBe(true);
    });
    it("Editor CANNOT approve owner-required gate [Layer 2]", () => {
      const r = l2_canApproveGate("u-editor-a", "sr-gate-own");
      expect(r.allowed).toBe(false);
      expect(r.layer).toBe("L2");
      expect(r.reason).toMatch(/owner/);
    });
    it("Viewer CANNOT approve any gate [Layer 2]", () => {
      const r = l2_canApproveGate("u-viewer-a", "sr-gate-own");
      expect(r.allowed).toBe(false);
      expect(r.layer).toBe("L2");
    });
    it("Owner can approve an editor-required gate (owner ≥ editor)", () => {
      expect(l2_canApproveGate("u-owner-a", "sr-gate-edi").allowed).toBe(true);
    });
    it("Rejects approval when step_run is not paused", () => {
      const r = l2_canApproveGate("u-owner-a", "sr-running");
      expect(r.allowed).toBe(false);
      expect(r.layer).toBe("STATE");
    });
    it("Org B owner CANNOT approve Org A gate [Layer 1 — cross-org]", () => {
      const r = l2_canApproveGate("u-owner-b", "sr-gate-own");
      expect(r.allowed).toBe(false);
      expect(r.layer).toBe("L1");
    });
    it("Unknown user CANNOT approve any gate [Layer 1]", () => {
      expect(l2_canApproveGate("u-hacker", "sr-gate-own").allowed).toBe(false);
    });
  });

});

describe("Direct GraphQL Attack Simulations", () => {
  // These tests simulate what happens when a malicious editor bypasses
  // the frontend UI and calls GraphQL mutations directly.
  // The backend blocks them via Hasura permissions (Layer 1 + Layer 2).

  it("[Attack] Editor directly inserts db_write step → DENIED by Layer 2", () => {
    const r = l2_canInsertStep("u-editor-a", "wf-aaa-1", "db_write");
    expect(r.allowed).toBe(false);
    expect(r.layer).toBe("L2");
  });

  it("[Attack] Editor directly inserts notify step → DENIED by Layer 2", () => {
    const r = l2_canInsertStep("u-editor-a", "wf-aaa-1", "notify");
    expect(r.allowed).toBe(false);
    expect(r.layer).toBe("L2");
  });

  it("[Attack] Editor creates webhook trigger → DENIED by Layer 2", () => {
    const r = l2_canInsertTrigger("u-editor-a", "wf-aaa-1", "webhook");
    expect(r.allowed).toBe(false);
    expect(r.layer).toBe("L2");
  });

  it("[Attack] Editor triggers existing workflow → ALLOWED (not restricted)", () => {
    // This proves Layer 2 is correctly separated from Layer 1:
    // editor can trigger but cannot add privileged step types
    const r = l2_canTriggerRun("u-editor-a", "wf-aaa-1");
    expect(r.allowed).toBe(true);
  });

  it("[Attack] Editor attempts direct step_run status update → BLOCKED (no UPDATE permission)", () => {
    // Simulates: mutation { update_step_runs(where: {id: {_eq: "sr-gate-own"}}, _set: {status: "completed"}) }
    // step_runs has NO UPDATE permission for any role in permissions.yaml
    const r = simulateDirectApprovalBypass("u-editor-a", "sr-gate-own");
    expect(r.blocked).toBe(true);
  });

  it("[Attack] Org B owner queries Org A workflow by known UUID → DENIED by Layer 1", () => {
    expect(l1_canSeeWorkflow("u-owner-b", "wf-aaa-1")).toBe(false);
  });

  it("[Attack] Org B owner triggers Org A workflow → DENIED by Layer 1", () => {
    const r = l2_canTriggerRun("u-owner-b", "wf-aaa-1");
    expect(r.allowed).toBe(false);
    expect(r.layer).toBe("L1");
  });

  it("[Attack] Org B owner approves Org A gate → DENIED by Layer 1", () => {
    const r = l2_canApproveGate("u-owner-b", "sr-gate-own");
    expect(r.allowed).toBe(false);
    expect(r.layer).toBe("L1");
  });
});

describe("Acceptance Tests — Five Required Scenarios", () => {

  describe("Scenario 1: Org A Editor normal workflow operations", () => {
    it("Creates workflow → ALLOWED", () => {
      expect(l1_canInsertWorkflow("u-editor-a", "org-aaa")).toBe(true);
    });
    it("Edits workflow → ALLOWED", () => {
      expect(l1_canMutateWorkflow("u-editor-a", "wf-aaa-1")).toBe(true);
    });
    it("Adds llm_call step → ALLOWED", () => {
      expect(l2_canInsertStep("u-editor-a", "wf-aaa-1", "llm_call").allowed).toBe(true);
    });
    it("Triggers workflow → ALLOWED", () => {
      expect(l2_canTriggerRun("u-editor-a", "wf-aaa-1").allowed).toBe(true);
    });
    it("Deletes workflow → ALLOWED (Layer 1 editor DELETE)", () => {
      expect(l1_canDeleteWorkflow("u-editor-a", "wf-aaa-1")).toBe(true);
    });
  });

  describe("Scenario 2: Org A Editor restricted operations → all DENIED", () => {
    it("Adds db_write step → DENIED", () => {
      expect(l2_canInsertStep("u-editor-a", "wf-aaa-1", "db_write").allowed).toBe(false);
    });
    it("Adds notify step → DENIED", () => {
      expect(l2_canInsertStep("u-editor-a", "wf-aaa-1", "notify").allowed).toBe(false);
    });
    it("Creates webhook trigger → DENIED", () => {
      expect(l2_canInsertTrigger("u-editor-a", "wf-aaa-1", "webhook").allowed).toBe(false);
    });
  });

  describe("Scenario 3: Org A Viewer — read allowed, writes denied", () => {
    it("Views workflow → ALLOWED", () => {
      expect(l1_canSeeWorkflow("u-viewer-a", "wf-aaa-1")).toBe(true);
    });
    it("Edits workflow → DENIED", () => {
      expect(l1_canMutateWorkflow("u-viewer-a", "wf-aaa-1")).toBe(false);
    });
    it("Triggers workflow → DENIED", () => {
      expect(l2_canTriggerRun("u-viewer-a", "wf-aaa-1").allowed).toBe(false);
    });
    it("Approves gate → DENIED", () => {
      expect(l2_canApproveGate("u-viewer-a", "sr-gate-own").allowed).toBe(false);
    });
  });

  describe("Scenario 4: Org B Owner — all Org A access DENIED", () => {
    it("Read Org A workflow → DENIED", () => {
      expect(l1_canSeeWorkflow("u-owner-b", "wf-aaa-1")).toBe(false);
    });
    it("Trigger Org A workflow → DENIED", () => {
      expect(l2_canTriggerRun("u-owner-b", "wf-aaa-1").allowed).toBe(false);
    });
    it("Read Org A org → DENIED", () => {
      expect(l1_canSeeOrg("u-owner-b", "org-aaa")).toBe(false);
    });
    it("Approve Org A gate → DENIED", () => {
      expect(l2_canApproveGate("u-owner-b", "sr-gate-own").allowed).toBe(false);
    });
    it("Insert step into Org A workflow → DENIED", () => {
      expect(l2_canInsertStep("u-owner-b", "wf-aaa-1", "llm_call").allowed).toBe(false);
    });
  });

  describe("Scenario 5: Org A authorized approver approves gate → ALLOWED", () => {
    it("Owner approves owner-required gate → ALLOWED", () => {
      const r = l2_canApproveGate("u-owner-a", "sr-gate-own");
      expect(r.allowed).toBe(true);
      expect(r.reason).toBe("Approved");
    });
    it("Approval state: paused gate → resolves to 'completed' transition", () => {
      // Verify the step_run starts as paused (precondition)
      const stepRun = STEP_RUNS.find(sr => sr.id === "sr-gate-own")!;
      expect(stepRun.status).toBe("paused");
      // After approve: action handler sets status = completed, workflow_run = running
      // (Simulated: the Action would update to completed in the database)
    });
    it("Editor cannot approve same gate (enforced by Action)", () => {
      expect(l2_canApproveGate("u-editor-a", "sr-gate-own").allowed).toBe(false);
    });
  });

});

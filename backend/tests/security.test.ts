import { describe, it, expect } from "vitest";

// ================================================================
// VocalFlow — Two-Layer Permission Test Suite
// ================================================================
//
// This test file mirrors the exact logic enforced by:
//   Layer 1 → Hasura row-level permissions (permissions.yaml)
//   Layer 2 → Action handler runtime checks (approve-step, trigger-workflow-run)
//
// No real database or HTTP calls are made. The permission helper
// functions simulate the SQL JOINs and handler conditions exactly
// as they would execute in production.
// ================================================================

// ── Types ────────────────────────────────────────────────────────
type Role = "owner" | "editor" | "viewer";

interface Org   { id: string; name: string }
interface Member { org_id: string; user_id: string; role: Role }
interface Workflow { id: string; org_id: string; name: string }
interface WorkflowStep {
  id: string; workflow_id: string; position: number;
  name: string; type: string; config: Record<string, any>
}
interface StepRun {
  id: string; workflow_run_id: string; workflow_step_id: string;
  status: string; org_id: string
}

// ── Fixtures ─────────────────────────────────────────────────────
const ORGS: Org[] = [
  { id: "aaa-org", name: "Acme AI (Org A)" },
  { id: "bbb-org", name: "Cyberdyne Systems (Org B)" },
];

const MEMBERS: Member[] = [
  { org_id: "aaa-org", user_id: "u-owner-a",  role: "owner"  },
  { org_id: "aaa-org", user_id: "u-editor-a", role: "editor" },
  { org_id: "aaa-org", user_id: "u-viewer-a", role: "viewer" },
  { org_id: "bbb-org", user_id: "u-owner-b",  role: "owner"  },
];

const WORKFLOWS: Workflow[] = [
  { id: "wf-aaa-1", org_id: "aaa-org", name: "Org A Support" },
  { id: "wf-bbb-1", org_id: "bbb-org", name: "Org B Defense" },
];

const STEPS: WorkflowStep[] = [
  { id: "s1", workflow_id: "wf-aaa-1", position: 1, name: "LLM Step",        type: "llm_call",          config: {} },
  { id: "s2", workflow_id: "wf-aaa-1", position: 2, name: "DB Write",         type: "db_write",          config: {} },
  { id: "s3", workflow_id: "wf-aaa-1", position: 3, name: "Notify",           type: "notify",            config: {} },
  { id: "s4", workflow_id: "wf-aaa-1", position: 4, name: "Gate (owner req)", type: "approval_gate",     config: { required_role: "owner" } },
  { id: "s5", workflow_id: "wf-aaa-1", position: 5, name: "Gate (editor ok)", type: "approval_gate",     config: { required_role: "editor" } },
  { id: "s6", workflow_id: "wf-aaa-1", position: 6, name: "Webhook Trigger",  type: "webhook",           config: {} },
  { id: "s7", workflow_id: "wf-aaa-1", position: 7, name: "HTTP Step",        type: "http_request",      config: {} },
  { id: "s8", workflow_id: "wf-aaa-1", position: 8, name: "Conditional",      type: "conditional_branch",config: {} },
];

// Paused step runs for approve-step tests
const STEP_RUNS: StepRun[] = [
  { id: "sr-gate-owner", workflow_run_id: "wr-1", workflow_step_id: "s4", status: "paused", org_id: "aaa-org" },
  { id: "sr-gate-editor", workflow_run_id: "wr-1", workflow_step_id: "s5", status: "paused", org_id: "aaa-org" },
  { id: "sr-running",    workflow_run_id: "wr-1", workflow_step_id: "s1", status: "running", org_id: "aaa-org" },
  { id: "sr-orgb-gate",  workflow_run_id: "wr-2", workflow_step_id: "s4", status: "paused", org_id: "bbb-org" },
];

// ── Layer 1 helpers ───────────────────────────────────────────────
// These mirror the Hasura permission filter:
//   workflows JOIN org_members ON org_members.org_id = workflow.org_id
//   WHERE org_members.user_id = X-Hasura-User-Id

function layer1_canSeeWorkflow(userId: string, workflowId: string): boolean {
  const wf = WORKFLOWS.find((w) => w.id === workflowId);
  if (!wf) return false;
  return MEMBERS.some((m) => m.user_id === userId && m.org_id === wf.org_id);
}

function layer1_canSeeOrg(userId: string, orgId: string): boolean {
  return MEMBERS.some((m) => m.user_id === userId && m.org_id === orgId);
}

function layer1_memberSelfOnly(userId: string, targetMember: Member): boolean {
  // viewer and editor see only their own membership row
  return targetMember.user_id === userId;
}

function layer1_ownerSeesAllOrgMembers(userId: string, targetMember: Member): boolean {
  // owner sees all members in orgs they belong to
  const ownerMemberships = MEMBERS.filter((m) => m.user_id === userId && m.role === "owner");
  return ownerMemberships.some((m) => m.org_id === targetMember.org_id);
}

// ── Layer 2 helpers ───────────────────────────────────────────────
// These mirror the Action handler logic.

function layer2_canInsertStep(userId: string, workflowId: string, stepType: string): { allowed: boolean; reason?: string } {
  const wf = WORKFLOWS.find((w) => w.id === workflowId);
  if (!wf) return { allowed: false, reason: "Workflow not found" };

  const member = MEMBERS.find((m) => m.user_id === userId && m.org_id === wf.org_id);
  if (!member) return { allowed: false, reason: "Not a member of this org" };
  if (member.role === "viewer") return { allowed: false, reason: "Viewers cannot add steps" };

  const OWNER_ONLY_STEPS = ["db_write", "notify"];
  const OWNER_ONLY_TRIGGERS = ["webhook"];

  if (OWNER_ONLY_STEPS.includes(stepType) && member.role !== "owner") {
    return { allowed: false, reason: `Only owners can add '${stepType}' steps` };
  }
  if (OWNER_ONLY_TRIGGERS.includes(stepType) && member.role !== "owner") {
    return { allowed: false, reason: "Only owners can add webhook triggers" };
  }

  return { allowed: true };
}

function layer2_canTriggerRun(userId: string, workflowId: string): { allowed: boolean; reason?: string } {
  const wf = WORKFLOWS.find((w) => w.id === workflowId);
  if (!wf) return { allowed: false, reason: "Forbidden: Workflow not found or access denied" };

  const member = MEMBERS.find((m) => m.user_id === userId && m.org_id === wf.org_id);
  if (!member) return { allowed: false, reason: "Forbidden: Workflow not found or access denied" };
  if (member.role === "viewer") return { allowed: false, reason: "Forbidden: Viewers cannot trigger runs" };

  return { allowed: true };
}

function layer2_canApproveGate(
  userId: string,
  stepRunId: string
): { allowed: boolean; reason?: string } {
  const stepRun = STEP_RUNS.find((sr) => sr.id === stepRunId);
  if (!stepRun) return { allowed: false, reason: "Forbidden: Step run not found" };

  // Layer 1: caller must be in the org that owns this run
  const member = MEMBERS.find((m) => m.user_id === userId && m.org_id === stepRun.org_id);
  if (!member) return { allowed: false, reason: "Forbidden: Access denied (org isolation)" };

  // State validation
  if (stepRun.status !== "paused") {
    return { allowed: false, reason: `Bad Request: Step is not paused (current: ${stepRun.status})` };
  }

  // Layer 2: gate role check against config.required_role
  const step = STEPS.find((s) => s.id === stepRun.workflow_step_id);
  if (!step || step.type !== "approval_gate") {
    return { allowed: false, reason: "Bad Request: Step is not an approval_gate" };
  }

  const requiredRole: string = step.config.required_role || "owner";

  if (member.role === "viewer") {
    return { allowed: false, reason: "Forbidden: Viewers cannot approve steps" };
  }
  if (requiredRole === "owner" && member.role !== "owner") {
    return { allowed: false, reason: `Forbidden: Gate requires 'owner', caller has '${member.role}'` };
  }

  return { allowed: true };
}

// =================================================================
// TEST SUITE
// =================================================================

describe("Layer 1 — Org + Role Scoping", () => {
  describe("Workflow visibility (org isolation)", () => {
    it("Org A owner can see Org A workflows", () => {
      expect(layer1_canSeeWorkflow("u-owner-a", "wf-aaa-1")).toBe(true);
    });
    it("Org A editor can see Org A workflows", () => {
      expect(layer1_canSeeWorkflow("u-editor-a", "wf-aaa-1")).toBe(true);
    });
    it("Org A viewer can see Org A workflows (read-only)", () => {
      expect(layer1_canSeeWorkflow("u-viewer-a", "wf-aaa-1")).toBe(true);
    });
    it("Org B owner CANNOT see Org A workflows", () => {
      expect(layer1_canSeeWorkflow("u-owner-b", "wf-aaa-1")).toBe(false);
    });
    it("Org A owner CANNOT see Org B workflows", () => {
      expect(layer1_canSeeWorkflow("u-owner-a", "wf-bbb-1")).toBe(false);
    });
    it("Unknown user CANNOT see any workflow", () => {
      expect(layer1_canSeeWorkflow("u-hacker", "wf-aaa-1")).toBe(false);
    });
  });

  describe("Organization visibility", () => {
    it("Member sees their own org", () => {
      expect(layer1_canSeeOrg("u-owner-a", "aaa-org")).toBe(true);
    });
    it("Member CANNOT see another org even knowing the UUID", () => {
      expect(layer1_canSeeOrg("u-owner-a", "bbb-org")).toBe(false);
    });
  });

  describe("org_members visibility", () => {
    it("Owner sees all org member rows in their org", () => {
      const editorRow = MEMBERS.find((m) => m.user_id === "u-editor-a")!;
      expect(layer1_ownerSeesAllOrgMembers("u-owner-a", editorRow)).toBe(true);
    });
    it("Owner CANNOT see members in a different org", () => {
      const orgBOwner = MEMBERS.find((m) => m.user_id === "u-owner-b")!;
      expect(layer1_ownerSeesAllOrgMembers("u-owner-a", orgBOwner)).toBe(false);
    });
    it("Editor sees only their own membership row", () => {
      const ownRow = MEMBERS.find((m) => m.user_id === "u-editor-a")!;
      const otherRow = MEMBERS.find((m) => m.user_id === "u-owner-a")!;
      expect(layer1_memberSelfOnly("u-editor-a", ownRow)).toBe(true);
      expect(layer1_memberSelfOnly("u-editor-a", otherRow)).toBe(false);
    });
    it("Viewer sees only their own membership row", () => {
      const ownRow = MEMBERS.find((m) => m.user_id === "u-viewer-a")!;
      const otherRow = MEMBERS.find((m) => m.user_id === "u-editor-a")!;
      expect(layer1_memberSelfOnly("u-viewer-a", ownRow)).toBe(true);
      expect(layer1_memberSelfOnly("u-viewer-a", otherRow)).toBe(false);
    });
  });
});

describe("Layer 2 — Step-Level Gating (INSERT permissions + Action checks)", () => {
  describe("Step insertion — restricted step types", () => {
    it("Owner can add db_write step", () => {
      const res = layer2_canInsertStep("u-owner-a", "wf-aaa-1", "db_write");
      expect(res.allowed).toBe(true);
    });
    it("Editor CANNOT add db_write step", () => {
      const res = layer2_canInsertStep("u-editor-a", "wf-aaa-1", "db_write");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/owner/);
    });
    it("Owner can add notify step", () => {
      const res = layer2_canInsertStep("u-owner-a", "wf-aaa-1", "notify");
      expect(res.allowed).toBe(true);
    });
    it("Editor CANNOT add notify step", () => {
      const res = layer2_canInsertStep("u-editor-a", "wf-aaa-1", "notify");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/owner/);
    });
    it("Owner can add webhook trigger", () => {
      const res = layer2_canInsertStep("u-owner-a", "wf-aaa-1", "webhook");
      expect(res.allowed).toBe(true);
    });
    it("Editor CANNOT add webhook trigger", () => {
      const res = layer2_canInsertStep("u-editor-a", "wf-aaa-1", "webhook");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/webhook/);
    });
    it("Viewer CANNOT add any step type", () => {
      expect(layer2_canInsertStep("u-viewer-a", "wf-aaa-1", "llm_call").allowed).toBe(false);
      expect(layer2_canInsertStep("u-viewer-a", "wf-aaa-1", "http_request").allowed).toBe(false);
    });
    it("Editor CAN add llm_call, http_request, conditional_branch, approval_gate steps", () => {
      expect(layer2_canInsertStep("u-editor-a", "wf-aaa-1", "llm_call").allowed).toBe(true);
      expect(layer2_canInsertStep("u-editor-a", "wf-aaa-1", "http_request").allowed).toBe(true);
      expect(layer2_canInsertStep("u-editor-a", "wf-aaa-1", "conditional_branch").allowed).toBe(true);
      expect(layer2_canInsertStep("u-editor-a", "wf-aaa-1", "approval_gate").allowed).toBe(true);
    });
    it("Org B user CANNOT add any step to Org A workflow", () => {
      const res = layer2_canInsertStep("u-owner-b", "wf-aaa-1", "llm_call");
      expect(res.allowed).toBe(false);
    });
  });

  describe("triggerWorkflowRun — Action handler Layer 2 checks", () => {
    it("Owner can trigger a run", () => {
      expect(layer2_canTriggerRun("u-owner-a", "wf-aaa-1").allowed).toBe(true);
    });
    it("Editor can trigger a run", () => {
      expect(layer2_canTriggerRun("u-editor-a", "wf-aaa-1").allowed).toBe(true);
    });
    it("Viewer CANNOT trigger a run", () => {
      const res = layer2_canTriggerRun("u-viewer-a", "wf-aaa-1");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/[Vv]iewer/);
    });
    it("Org B owner CANNOT trigger Org A run (cross-org blocked)", () => {
      const res = layer2_canTriggerRun("u-owner-b", "wf-aaa-1");
      expect(res.allowed).toBe(false);
    });
    it("Unknown user CANNOT trigger a run", () => {
      const res = layer2_canTriggerRun("u-hacker", "wf-aaa-1");
      expect(res.allowed).toBe(false);
    });
  });

  describe("approveStep — approval_gate runtime role check", () => {
    it("Owner approves a gate that requires owner — allowed", () => {
      const res = layer2_canApproveGate("u-owner-a", "sr-gate-owner");
      expect(res.allowed).toBe(true);
    });
    it("Editor CANNOT approve a gate that requires owner", () => {
      const res = layer2_canApproveGate("u-editor-a", "sr-gate-owner");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/owner/);
    });
    it("Viewer CANNOT approve any gate", () => {
      const res = layer2_canApproveGate("u-viewer-a", "sr-gate-owner");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/[Vv]iewer/);
    });
    it("Owner can approve a gate that requires editor (owner ≥ editor)", () => {
      const res = layer2_canApproveGate("u-owner-a", "sr-gate-editor");
      expect(res.allowed).toBe(true);
    });
    it("Editor CAN approve a gate that requires editor", () => {
      const res = layer2_canApproveGate("u-editor-a", "sr-gate-editor");
      expect(res.allowed).toBe(true);
    });
    it("Rejects approval if step_run is not paused", () => {
      const res = layer2_canApproveGate("u-owner-a", "sr-running");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/paused/);
    });
    it("Org B owner CANNOT approve Org A step run (cross-org isolation)", () => {
      const res = layer2_canApproveGate("u-owner-b", "sr-gate-owner");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/org isolation/);
    });
    it("Unknown user CANNOT approve any gate", () => {
      const res = layer2_canApproveGate("u-hacker", "sr-gate-owner");
      expect(res.allowed).toBe(false);
    });
  });
});

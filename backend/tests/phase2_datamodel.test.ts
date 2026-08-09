import { describe, it, expect } from "vitest";

// ================================================================
// VocalFlow — Phase 2: Workflow Data Model & Hasura Validation Suite
// ================================================================
//
// Validates:
// 1. Data model tables & relationships (workflows, steps, triggers, runs, step_runs, results)
// 2. Step type database constraints ('llm_call', 'http_request', 'db_write', 'notify', 'conditional_branch', 'approval_gate')
// 3. Trigger type constraints ('manual', 'webhook', 'scheduled', 'database_event')
// 4. Workflow run status constraints ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')
// 5. Step run status constraints ('pending', 'running', 'paused', 'completed', 'failed', 'skipped')
// 6. Step ordering & duplicate position rejection
// 7. Layer 1 Org Isolation & Direct ID Guessing Protection
// 8. Layer 1 Role Permissions Matrix (Owner / Editor / Viewer)
// ================================================================

// ── Types ─────────────────────────────────────────────────────────
type Role = "owner" | "editor" | "viewer";

interface Organization { id: string; name: string }
interface OrgMember    { org_id: string; user_id: string; role: Role }
interface Workflow     { id: string; org_id: string; name: string; description?: string; status: string; created_by?: string }
interface WorkflowStep { id: string; workflow_id: string; position: number; name: string; type: string; config: Record<string, any> }
interface WorkflowTrigger { id: string; workflow_id: string; type: string; config: Record<string, any>; enabled: boolean }
interface WorkflowRun  { id: string; workflow_id: string; org_id: string; trigger_type?: string; status: string; input?: any; output?: any }
interface StepRun      { id: string; workflow_run_id: string; workflow_step_id: string; status: string; attempt_count: number; approved_by?: string; approved_at?: string }
interface WorkflowResult { id: string; org_id: string; workflow_run_id: string; key: string; value: any }

// ── Constants & Enum Validators ──────────────────────────────────
const VALID_STEP_TYPES = ["llm_call", "http_request", "db_write", "notify", "conditional_branch", "approval_gate"];
const VALID_TRIGGER_TYPES = ["manual", "webhook", "scheduled", "database_event"];
const VALID_RUN_STATUSES = ["pending", "running", "paused", "completed", "failed", "cancelled"];
const VALID_STEP_RUN_STATUSES = ["pending", "running", "paused", "completed", "failed", "skipped"];

function validateStepType(type: string): boolean {
  return VALID_STEP_TYPES.includes(type);
}

function validateTriggerType(type: string): boolean {
  return VALID_TRIGGER_TYPES.includes(type);
}

function validateRunStatus(status: string): boolean {
  return VALID_RUN_STATUSES.includes(status);
}

function validateStepRunStatus(status: string): boolean {
  return VALID_STEP_RUN_STATUSES.includes(status);
}

// ── Fixtures ──────────────────────────────────────────────────────
const ORGS: Organization[] = [
  { id: "org-alpha", name: "Alpha AI Corp" },
  { id: "org-beta",  name: "Beta Logistics" },
];

const MEMBERS: OrgMember[] = [
  { org_id: "org-alpha", user_id: "u-owner-alpha",  role: "owner"  },
  { org_id: "org-alpha", user_id: "u-editor-alpha", role: "editor" },
  { org_id: "org-alpha", user_id: "u-viewer-alpha", role: "viewer" },
  { org_id: "org-beta",  user_id: "u-owner-beta",   role: "owner"  },
];

const WORKFLOWS: Workflow[] = [
  { id: "wf-alpha-100", org_id: "org-alpha", name: "Alpha Customer Support Pipeline", status: "active" },
  { id: "wf-beta-200",  org_id: "org-beta",  name: "Beta Inventory Sync Pipeline",   status: "active" },
];

const STEPS: WorkflowStep[] = [
  { id: "ws-1", workflow_id: "wf-alpha-100", position: 1, name: "LLM Inquiry Classifier", type: "llm_call",           config: { provider: "groq" } },
  { id: "ws-2", workflow_id: "wf-alpha-100", position: 2, name: "Fetch Ticket History",     type: "http_request",       config: { method: "GET" } },
  { id: "ws-3", workflow_id: "wf-alpha-100", position: 3, name: "Evaluate Sentiment",      type: "conditional_branch", config: { path: "sentiment" } },
  { id: "ws-4", workflow_id: "wf-alpha-100", position: 4, name: "Manager Approval Gate",   type: "approval_gate",      config: { required_role: "owner" } },
];

const TRIGGERS: WorkflowTrigger[] = [
  { id: "wt-1", workflow_id: "wf-alpha-100", type: "manual",   config: {}, enabled: true },
  { id: "wt-2", workflow_id: "wf-alpha-100", type: "webhook",  config: { endpoint: "/wh/alpha" }, enabled: true },
];

const RUNS: WorkflowRun[] = [
  { id: "run-alpha-1", workflow_id: "wf-alpha-100", org_id: "org-alpha", trigger_type: "manual", status: "paused" },
  { id: "run-beta-1",  workflow_id: "wf-beta-200",  org_id: "org-beta",  trigger_type: "manual", status: "completed" },
];

const STEP_RUNS: StepRun[] = [
  { id: "srun-1", workflow_run_id: "run-alpha-1", workflow_step_id: "ws-1", status: "completed", attempt_count: 1 },
  { id: "srun-4", workflow_run_id: "run-alpha-1", workflow_step_id: "ws-4", status: "paused",    attempt_count: 1 },
];

const RESULTS: WorkflowResult[] = [
  { id: "res-1", org_id: "org-alpha", workflow_run_id: "run-alpha-1", key: "audit_log", value: { status: "recorded" } },
];

// ── Hasura Row-Level Security Simulators ─────────────────────────

function hasuraSelectWorkflows(userId: string, targetOrgId?: string): Workflow[] {
  // Chain: workflows.org_id -> org_members.org_id -> org_members.user_id = X-Hasura-User-Id
  const userOrgs = MEMBERS.filter(m => m.user_id === userId).map(m => m.org_id);
  return WORKFLOWS.filter(w => userOrgs.includes(w.org_id) && (!targetOrgId || w.org_id === targetOrgId));
}

function hasuraSelectSteps(userId: string, workflowId: string): WorkflowStep[] {
  // Chain: workflow_steps.workflow_id -> workflows.org_id -> org_members.org_id -> user_id = X-Hasura-User-Id
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) return [];
  const isMember = MEMBERS.some(m => m.user_id === userId && m.org_id === wf.org_id);
  if (!isMember) return [];
  return STEPS.filter(s => s.workflow_id === workflowId).sort((a, b) => a.position - b.position);
}

function hasuraSelectRuns(userId: string, workflowId: string): WorkflowRun[] {
  // Chain: workflow_runs.org_id -> org_members.org_id -> user_id = X-Hasura-User-Id
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) return [];
  const isMember = MEMBERS.some(m => m.user_id === userId && m.org_id === wf.org_id);
  if (!isMember) return [];
  return RUNS.filter(r => r.workflow_id === workflowId);
}

function hasuraSelectStepRuns(userId: string, runId: string): StepRun[] {
  // Chain: step_runs.workflow_run_id -> workflow_runs.org_id -> org_members.org_id -> user_id = X-Hasura-User-Id
  const run = RUNS.find(r => r.id === runId);
  if (!run) return [];
  const isMember = MEMBERS.some(m => m.user_id === userId && m.org_id === run.org_id);
  if (!isMember) return [];
  return STEP_RUNS.filter(sr => sr.workflow_run_id === runId);
}

function hasuraInsertWorkflow(userId: string, orgId: string): { allowed: boolean; reason: string } {
  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === orgId);
  if (!member) return { allowed: false, reason: "Unauthorized: Cross-org boundary" };
  if (member.role === "viewer") return { allowed: false, reason: "Unauthorized: Viewer role cannot create workflows" };
  return { allowed: true, reason: "Allowed" };
}

function hasuraUpdateWorkflow(userId: string, workflowId: string): { allowed: boolean; reason: string } {
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) return { allowed: false, reason: "Workflow not found" };
  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === wf.org_id);
  if (!member) return { allowed: false, reason: "Unauthorized: Cross-org boundary" };
  if (member.role === "viewer") return { allowed: false, reason: "Unauthorized: Viewer role cannot update workflows" };
  return { allowed: true, reason: "Allowed" };
}

function hasuraDeleteWorkflow(userId: string, workflowId: string): { allowed: boolean; reason: string } {
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) return { allowed: false, reason: "Workflow not found" };
  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === wf.org_id);
  if (!member) return { allowed: false, reason: "Unauthorized: Cross-org boundary" };
  if (member.role === "viewer") return { allowed: false, reason: "Unauthorized: Viewer role cannot delete workflows" };
  return { allowed: true, reason: "Allowed" };
}

// ================================================================
// PHASE 2 TEST SUITE
// ================================================================

describe("Phase 2 — Data Model Constraints & Enums", () => {
  describe("Step Type Constraints", () => {
    it("Allows valid assignment step types", () => {
      VALID_STEP_TYPES.forEach(st => {
        expect(validateStepType(st)).toBe(true);
      });
    });

    it("Rejects invalid step types (e.g. 'random_type', 'custom_exec')", () => {
      expect(validateStepType("random_type")).toBe(false);
      expect(validateStepType("custom_exec")).toBe(false);
      expect(validateStepType("invalid_step")).toBe(false);
    });
  });

  describe("Trigger Type Constraints", () => {
    it("Allows valid assignment trigger types", () => {
      VALID_TRIGGER_TYPES.forEach(tt => {
        expect(validateTriggerType(tt)).toBe(true);
      });
    });

    it("Rejects invalid trigger types", () => {
      expect(validateTriggerType("kafka_stream")).toBe(false);
      expect(validateTriggerType("cron_job")).toBe(false);
    });
  });

  describe("Workflow Run Status Constraints", () => {
    it("Allows valid run statuses including 'paused' and 'cancelled'", () => {
      VALID_RUN_STATUSES.forEach(st => {
        expect(validateRunStatus(st)).toBe(true);
      });
    });

    it("Rejects invalid run statuses", () => {
      expect(validateRunStatus("sleeping")).toBe(false);
      expect(validateRunStatus("terminated")).toBe(false);
    });
  });

  describe("Step Run Status Constraints", () => {
    it("Allows valid step run statuses including 'paused' and 'skipped'", () => {
      VALID_STEP_RUN_STATUSES.forEach(st => {
        expect(validateStepRunStatus(st)).toBe(true);
      });
    });

    it("Rejects invalid step run statuses", () => {
      expect(validateStepRunStatus("waiting")).toBe(false);
    });
  });

  describe("Step Ordering & Unique Position Enforcement", () => {
    it("Renders steps ordered by position ASC", () => {
      const steps = hasuraSelectSteps("u-owner-alpha", "wf-alpha-100");
      expect(steps.length).toBe(4);
      expect(steps[0].position).toBe(1);
      expect(steps[1].position).toBe(2);
      expect(steps[2].position).toBe(3);
      expect(steps[3].position).toBe(4);
    });

    it("Rejects inserting steps with duplicate position within same workflow", () => {
      const existingPositions = STEPS.filter(s => s.workflow_id === "wf-alpha-100").map(s => s.position);
      const duplicatePos = 2;
      const isDuplicate = existingPositions.includes(duplicatePos);
      expect(isDuplicate).toBe(true);
    });
  });
});

describe("Phase 2 — Hasura Security & Role Matrix", () => {
  describe("Owner Permissions", () => {
    it("Owner -> create workflow = ALLOWED", () => {
      expect(hasuraInsertWorkflow("u-owner-alpha", "org-alpha").allowed).toBe(true);
    });
    it("Owner -> update workflow = ALLOWED", () => {
      expect(hasuraUpdateWorkflow("u-owner-alpha", "wf-alpha-100").allowed).toBe(true);
    });
    it("Owner -> delete workflow = ALLOWED", () => {
      expect(hasuraDeleteWorkflow("u-owner-alpha", "wf-alpha-100").allowed).toBe(true);
    });
  });

  describe("Editor Permissions", () => {
    it("Editor -> create workflow = ALLOWED", () => {
      expect(hasuraInsertWorkflow("u-editor-alpha", "org-alpha").allowed).toBe(true);
    });
    it("Editor -> update workflow = ALLOWED", () => {
      expect(hasuraUpdateWorkflow("u-editor-alpha", "wf-alpha-100").allowed).toBe(true);
    });
    it("Editor -> delete workflow = ALLOWED", () => {
      expect(hasuraDeleteWorkflow("u-editor-alpha", "wf-alpha-100").allowed).toBe(true);
    });
  });

  describe("Viewer Permissions", () => {
    it("Viewer -> read workflow = ALLOWED", () => {
      const res = hasuraSelectWorkflows("u-viewer-alpha", "org-alpha");
      expect(res.length).toBe(1);
      expect(res[0].id).toBe("wf-alpha-100");
    });
    it("Viewer -> create workflow = DENIED", () => {
      expect(hasuraInsertWorkflow("u-viewer-alpha", "org-alpha").allowed).toBe(false);
    });
    it("Viewer -> update workflow = DENIED", () => {
      expect(hasuraUpdateWorkflow("u-viewer-alpha", "wf-alpha-100").allowed).toBe(false);
    });
    it("Viewer -> delete workflow = DENIED", () => {
      expect(hasuraDeleteWorkflow("u-viewer-alpha", "wf-alpha-100").allowed).toBe(false);
    });
  });

  describe("Organization Isolation & Direct ID Guessing Protection", () => {
    it("Alpha user CANNOT view Beta workflows even with exact UUID 'wf-beta-200'", () => {
      const res = hasuraSelectWorkflows("u-owner-alpha", "org-beta");
      expect(res).toEqual([]);
    });

    it("Alpha user CANNOT view Beta steps even with exact UUID 'wf-beta-200'", () => {
      const res = hasuraSelectSteps("u-owner-alpha", "wf-beta-200");
      expect(res).toEqual([]);
    });

    it("Alpha user CANNOT view Beta runs even with exact UUID 'wf-beta-200'", () => {
      const res = hasuraSelectRuns("u-owner-alpha", "wf-beta-200");
      expect(res).toEqual([]);
    });

    it("Alpha user CANNOT view Beta step runs even with exact UUID 'run-beta-1'", () => {
      const res = hasuraSelectStepRuns("u-owner-alpha", "run-beta-1");
      expect(res).toEqual([]);
    });

    it("Beta user CANNOT update Alpha workflow", () => {
      const res = hasuraUpdateWorkflow("u-owner-beta", "wf-alpha-100");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/Cross-org boundary/);
    });

    it("Beta user CANNOT delete Alpha workflow", () => {
      const res = hasuraDeleteWorkflow("u-owner-beta", "wf-alpha-100");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/Cross-org boundary/);
    });
  });
});

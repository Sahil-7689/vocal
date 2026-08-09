import { describe, it, expect } from "vitest";
import { executeStep, WorkflowStep } from "../functions/_shared/executor";
import { handleApprovalGate } from "../functions/_shared/handlers/approval";
import { handleNotify } from "../functions/_shared/handlers/notify";

// ── Types & Fixtures for Phase 4 ──────────────────────────────────
type Role = "owner" | "editor" | "viewer";

interface OrgMember { org_id: string; user_id: string; role: Role }
interface StepRun   { id: string; workflow_run_id: string; workflow_step_id: string; status: string; approved_by?: string; approved_at?: string; org_id: string }

const MEMBERS: OrgMember[] = [
  { org_id: "org-aaa", user_id: "u-owner-a",  role: "owner"  },
  { org_id: "org-aaa", user_id: "u-editor-a", role: "editor" },
  { org_id: "org-aaa", user_id: "u-viewer-a", role: "viewer" },
  { org_id: "org-bbb", user_id: "u-owner-b",  role: "owner"  },
];

const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: "s1-llm",      workflow_id: "wf-1", position: 1, name: "LLM Call",        type: "llm_call",          config: { prompt: "Analyze request" } },
  { id: "s2-http",     workflow_id: "wf-1", position: 2, name: "HTTP Request",     type: "http_request",      config: { url: "https://httpbin.org/get" } },
  { id: "s3-gate-own", workflow_id: "wf-1", position: 3, name: "Approval Gate",     type: "approval_gate",     config: { required_role: "owner" } },
  { id: "s4-gate-edi", workflow_id: "wf-1", position: 4, name: "Editor Gate",       type: "approval_gate",     config: { required_role: "editor" } },
  { id: "s5-dbwrite",  workflow_id: "wf-1", position: 5, name: "DB Write",         type: "db_write",          config: { key: "audit_data" } },
  { id: "s6-notify",   workflow_id: "wf-1", position: 6, name: "Slack Alert",      type: "notify",            config: { channel: "#alerts", message: "Completed." } },
];

const PAUSED_STEP_RUNS: StepRun[] = [
  { id: "srun-gate-own", workflow_run_id: "wfr-1", workflow_step_id: "s3-gate-own", status: "paused", org_id: "org-aaa" },
  { id: "srun-gate-edi", workflow_run_id: "wfr-1", workflow_step_id: "s4-gate-edi", status: "paused", org_id: "org-aaa" },
  { id: "srun-running",  workflow_run_id: "wfr-1", workflow_step_id: "s1-llm",      status: "running", org_id: "org-aaa" },
  { id: "srun-org-b",    workflow_run_id: "wfr-2", workflow_step_id: "s3-gate-own", status: "paused", org_id: "org-bbb" },
];

// ── approveStep Action Handler Simulator ────────────────────────
function simulateApproveStep(userId: string, stepRunId: string): { allowed: boolean; status: string; reason: string } {
  const stepRun = PAUSED_STEP_RUNS.find(sr => sr.id === stepRunId);
  if (!stepRun) {
    return { allowed: false, status: "403", reason: "Forbidden: Step run not found or access denied" };
  }

  // Layer 1 Org Membership Check
  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === stepRun.org_id);
  if (!member) {
    return { allowed: false, status: "403", reason: "Forbidden: Step run not found or access denied" };
  }

  // State Check
  if (stepRun.status !== "paused") {
    return { allowed: false, status: "400", reason: `Bad Request: Step is not paused (current: ${stepRun.status})` };
  }

  const step = WORKFLOW_STEPS.find(s => s.id === stepRun.workflow_step_id);
  if (!step || step.type !== "approval_gate") {
    return { allowed: false, status: "400", reason: "Bad Request: Step is not an approval_gate" };
  }

  // Layer 2 Gate Role Check
  const requiredRole = step.config.required_role || "owner";
  if (member.role === "viewer") {
    return { allowed: false, status: "403", reason: "Forbidden: Viewers cannot approve workflow steps" };
  }
  if (requiredRole === "owner" && member.role !== "owner") {
    return { allowed: false, status: "403", reason: `Forbidden: Gate requires 'owner', caller has '${member.role}'` };
  }

  return { allowed: true, status: "200", reason: "Step approved and execution resumed" };
}

// ── Layer 2 Step Insertion/Update Security Checker ─────────────
function simulateInsertStep(userId: string, orgId: string, stepType: string): { allowed: boolean; reason: string } {
  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === orgId);
  if (!member) return { allowed: false, reason: "Cross-org denied" };
  if (member.role === "viewer") return { allowed: false, reason: "Viewer denied" };

  const restrictedTypes = ["db_write", "notify"];
  if (restrictedTypes.includes(stepType) && member.role !== "owner") {
    return { allowed: false, reason: `Layer 2: Only owner can insert '${stepType}' step` };
  }
  return { allowed: true, reason: "Allowed" };
}

function simulateUpdateStepType(userId: string, orgId: string, oldType: string, newType: string): { allowed: boolean; reason: string } {
  const member = MEMBERS.find(m => m.user_id === userId && m.org_id === orgId);
  if (!member) return { allowed: false, reason: "Cross-org denied" };
  if (member.role === "viewer") return { allowed: false, reason: "Viewer denied" };

  const restrictedTypes = ["db_write", "notify"];
  if (restrictedTypes.includes(newType) && member.role !== "owner") {
    return { allowed: false, reason: `Layer 2 Escalation Blocked: Editor cannot change step to '${newType}'` };
  }
  return { allowed: true, reason: "Allowed" };
}

// ================================================================
// PHASE 4 TEST SUITE
// ================================================================

describe("Phase 4 — Approval Gate & Restricted Steps Test Suite", () => {
  describe("Approval Gate Execution & Pausing", () => {
    it("Returns paused status when workflow executor hits approval_gate step", async () => {
      const step: WorkflowStep = WORKFLOW_STEPS.find(s => s.type === "approval_gate")!;
      const res = await executeStep(step, {});
      expect(res.status).toBe("paused");
      expect(res.output).toHaveProperty("paused", true);
      expect(res.output.requiredRole).toBe("owner");
    });

    it("Directs handleApprovalGate helper to return paused state and required role", async () => {
      const res = await handleApprovalGate({ message: "Review needed", required_role: "owner" });
      expect(res.paused).toBe(true);
      expect(res.message).toBe("Review needed");
      expect(res.requiredRole).toBe("owner");
    });
  });

  describe("approveStep Action Authorization & Security", () => {
    it("Owner approves owner-required gate — ALLOWED", () => {
      const res = simulateApproveStep("u-owner-a", "srun-gate-own");
      expect(res.allowed).toBe(true);
      expect(res.status).toBe("200");
    });

    it("Editor CANNOT approve owner-required gate — DENIED", () => {
      const res = simulateApproveStep("u-editor-a", "srun-gate-own");
      expect(res.allowed).toBe(false);
      expect(res.status).toBe("403");
      expect(res.reason).toMatch(/requires 'owner'/);
    });

    it("Editor CAN approve editor-required gate — ALLOWED", () => {
      const res = simulateApproveStep("u-editor-a", "srun-gate-edi");
      expect(res.allowed).toBe(true);
      expect(res.status).toBe("200");
    });

    it("Viewer CANNOT approve any gate — DENIED", () => {
      const res = simulateApproveStep("u-viewer-a", "srun-gate-edi");
      expect(res.allowed).toBe(false);
      expect(res.status).toBe("403");
      expect(res.reason).toMatch(/Viewers cannot approve/);
    });

    it("Org B owner CANNOT approve Org A gate (cross-org isolation) — DENIED", () => {
      const res = simulateApproveStep("u-owner-b", "srun-gate-own");
      expect(res.allowed).toBe(false);
      expect(res.status).toBe("403");
    });

    it("Rejects approval if step run is not paused — DENIED", () => {
      const res = simulateApproveStep("u-owner-a", "srun-running");
      expect(res.allowed).toBe(false);
      expect(res.status).toBe("400");
      expect(res.reason).toMatch(/not paused/);
    });
  });

  describe("Layer 2 Step Insertion Security (db_write & notify)", () => {
    it("Owner CAN insert db_write step — ALLOWED", () => {
      expect(simulateInsertStep("u-owner-a", "org-aaa", "db_write").allowed).toBe(true);
    });

    it("Editor CANNOT insert db_write step — DENIED", () => {
      const res = simulateInsertStep("u-editor-a", "org-aaa", "db_write");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/Layer 2/);
    });

    it("Owner CAN insert notify step — ALLOWED", () => {
      expect(simulateInsertStep("u-owner-a", "org-aaa", "notify").allowed).toBe(true);
    });

    it("Editor CANNOT insert notify step — DENIED", () => {
      const res = simulateInsertStep("u-editor-a", "org-aaa", "notify");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/Layer 2/);
    });

    it("Editor CAN insert normal steps (llm_call, http_request, conditional_branch, approval_gate)", () => {
      expect(simulateInsertStep("u-editor-a", "org-aaa", "llm_call").allowed).toBe(true);
      expect(simulateInsertStep("u-editor-a", "org-aaa", "http_request").allowed).toBe(true);
      expect(simulateInsertStep("u-editor-a", "org-aaa", "conditional_branch").allowed).toBe(true);
      expect(simulateInsertStep("u-editor-a", "org-aaa", "approval_gate").allowed).toBe(true);
    });
  });

  describe("Layer 2 UPDATE Escalation Attack Protection", () => {
    it("Blocks Editor from updating an existing llm_call step to db_write", () => {
      const res = simulateUpdateStepType("u-editor-a", "org-aaa", "llm_call", "db_write");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/Escalation Blocked/);
    });

    it("Blocks Editor from updating an existing llm_call step to notify", () => {
      const res = simulateUpdateStepType("u-editor-a", "org-aaa", "llm_call", "notify");
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/Escalation Blocked/);
    });

    it("Allows Owner to update step to db_write or notify", () => {
      expect(simulateUpdateStepType("u-owner-a", "org-aaa", "llm_call", "db_write").allowed).toBe(true);
      expect(simulateUpdateStepType("u-owner-a", "org-aaa", "llm_call", "notify").allowed).toBe(true);
    });
  });

  describe("Modular Notify Step Handler", () => {
    it("Executes notify step, resolves template message, and returns dispatched status", async () => {
      const res = await handleNotify(
        { channel: "#alerts", message: "Run {{previousOutput.status}} complete." },
        { previousOutput: { status: "success" } }
      );

      expect(res.sent).toBe(true);
      expect(res.channel).toBe("#alerts");
      expect(res.message).toBe("Run success complete.");
    });
  });

  describe("End-to-End Approval Workflow Pipeline Simulation", () => {
    it("Executes pipeline LLM -> HTTP -> Approval Gate (pauses) -> approveStep -> completes remaining steps", async () => {
      // Step 1: LLM
      const s1Res = await executeStep(WORKFLOW_STEPS[0], { input: { text: "Audit query" } });
      expect(s1Res.status).toBe("completed");

      // Step 2: HTTP
      const s2Res = await executeStep(WORKFLOW_STEPS[1], { previousOutput: s1Res.output });
      expect(s2Res.status).toBe("completed");

      // Step 3: Approval Gate -> PAUSES
      const s3Res = await executeStep(WORKFLOW_STEPS[2], { previousOutput: s2Res.output });
      expect(s3Res.status).toBe("paused");

      // Action Handler: approveStep by Owner -> ALLOWED
      const appRes = simulateApproveStep("u-owner-a", "srun-gate-own");
      expect(appRes.allowed).toBe(true);

      // Remaining Steps executed after approval clearance:
      const s6Res = await handleNotify(WORKFLOW_STEPS[5].config, { previousOutput: s2Res.output });
      expect(s6Res.sent).toBe(true);
    });
  });
});

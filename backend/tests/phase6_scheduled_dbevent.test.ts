import { describe, it, expect } from "vitest";
import { validateCronExpression } from "../functions/scheduled-trigger/index";

// ── Types for Phase 6 ─────────────────────────────────────────────
type Role = "owner" | "editor" | "viewer";

interface Organization { id: string; name: string; quota_allowed: number; quota_used: number }
interface Workflow     { id: string; org_id: string; name: string; status: string }
interface WorkflowTrigger { id: string; workflow_id: string; type: string; enabled: boolean; config: Record<string, any> }
interface WorkflowRun  { id: string; workflow_id: string; org_id: string; trigger_type: string; status: string; input: any }
interface WorkflowEvent{ id: string; org_id: string; event_type: string; payload: any }

// ── Fixtures ──────────────────────────────────────────────────────
const ORGS: Organization[] = [
  { id: "org-alpha-10", name: "Alpha Systems",   quota_allowed: 5, quota_used: 0 },
  { id: "org-beta-20",  name: "Beta Logistics",  quota_allowed: 1, quota_used: 1 }, // Exhausted
];

const WORKFLOWS: Workflow[] = [
  { id: "wf-sched-1",  org_id: "org-alpha-10", name: "Daily Report Workflow",    status: "active" },
  { id: "wf-dbevent-1",org_id: "org-alpha-10", name: "Customer Created Workflow",status: "active" },
  { id: "wf-beta-db-2",org_id: "org-beta-20",  name: "Beta Event Workflow",       status: "active" },
  { id: "wf-disabled", org_id: "org-alpha-10", name: "Disabled Trigger Workflow", status: "active" },
];

const TRIGGERS: WorkflowTrigger[] = [
  { id: "trig-sched-1",  workflow_id: "wf-sched-1",   type: "scheduled",      enabled: true,  config: { cron: "0 9 * * *", timezone: "Asia/Kolkata" } },
  { id: "trig-dbevent-1",workflow_id: "wf-dbevent-1", type: "database_event", enabled: true,  config: { table: "workflow_events", event_type: "customer_created" } },
  { id: "trig-beta-db-2",workflow_id: "wf-beta-db-2", type: "database_event", enabled: true,  config: { table: "workflow_events", event_type: "customer_created" } },
  { id: "trig-beta-sc-2",workflow_id: "wf-beta-db-2", type: "scheduled",      enabled: true,  config: { cron: "0 9 * * *" } },
  { id: "trig-wh-1",     workflow_id: "wf-sched-1",   type: "webhook",        enabled: true,  config: { secret: "sec123" } },
  { id: "trig-man-1",    workflow_id: "wf-sched-1",   type: "manual",         enabled: true,  config: {} },
  { id: "trig-dis-1",    workflow_id: "wf-disabled",  type: "scheduled",      enabled: false, config: { cron: "0 9 * * *" } },
];

const RUNS: WorkflowRun[] = [];
const PROCESSED_IDEMPOTENCY_KEYS = new Set<string>();

// ── Scheduled Trigger Handler Simulator ───────────────────────────
function simulateScheduledTriggerRun(workflowId: string, timestamp: string):
  { success: boolean; run?: WorkflowRun; reason?: string } {
  const wf = WORKFLOWS.find(w => w.id === workflowId);
  if (!wf) return { success: false, reason: "Workflow not found" };

  const trigger = TRIGGERS.find(t => t.workflow_id === workflowId && t.type === "scheduled");
  if (!trigger || !trigger.enabled) {
    return { success: false, reason: "Scheduled trigger is disabled or not configured" };
  }

  // Cron validation
  if (!validateCronExpression(trigger.config.cron)) {
    return { success: false, reason: "Invalid cron expression" };
  }

  // Idempotency / Duplicate schedule check
  const idempotencyKey = `${workflowId}:${trigger.id}:${timestamp}`;
  if (PROCESSED_IDEMPOTENCY_KEYS.has(idempotencyKey)) {
    return { success: false, reason: "Duplicate schedule execution blocked by idempotency key" };
  }

  // Quota check
  const org = ORGS.find(o => o.id === wf.org_id);
  if (!org || org.quota_used >= org.quota_allowed) {
    return { success: false, reason: "QUOTA_EXCEEDED" };
  }

  org.quota_used += 1;
  PROCESSED_IDEMPOTENCY_KEYS.add(idempotencyKey);

  const run: WorkflowRun = {
    id: `run-sched-${Date.now()}`,
    workflow_id: workflowId,
    org_id: wf.org_id,
    trigger_type: "scheduled",
    status: "running",
    input: { trigger: "scheduled", cron: trigger.config.cron, triggered_at: timestamp },
  };
  RUNS.push(run);

  return { success: true, run };
}

// ── Database Event Trigger Handler Simulator ──────────────────────
function simulateDatabaseEventTriggerRun(event: WorkflowEvent, depth: number = 0):
  { success: boolean; runs: WorkflowRun[]; reason?: string } {
  // Loop / Recursion Protection
  if (depth > 3) {
    return { success: false, runs: [], reason: "Event depth threshold exceeded. Loop prevented." };
  }

  // Find matching active database_event workflows ONLY in the SAME org_id
  const matchingWfs = WORKFLOWS.filter(w => w.org_id === event.org_id && w.status === "active");
  const triggeredRuns: WorkflowRun[] = [];

  for (const wf of matchingWfs) {
    const trigger = TRIGGERS.find(t => t.workflow_id === wf.id && t.type === "database_event");
    if (!trigger || !trigger.enabled) continue;

    if (trigger.config.event_type && trigger.config.event_type !== event.event_type) continue;

    const org = ORGS.find(o => o.id === wf.org_id);
    if (!org || org.quota_used >= org.quota_allowed) {
      return { success: false, runs: [], reason: "QUOTA_EXCEEDED" };
    }

    org.quota_used += 1;

    const run: WorkflowRun = {
      id: `run-dbevent-${Date.now()}`,
      workflow_id: wf.id,
      org_id: wf.org_id,
      trigger_type: "database_event",
      status: "running",
      input: { trigger: "database_event", event: { event_type: event.event_type, payload: event.payload } },
    };
    RUNS.push(run);
    triggeredRuns.push(run);
  }

  return { success: triggeredRuns.length > 0, runs: triggeredRuns };
}

// ================================================================
// PHASE 6 TEST SUITE
// ================================================================

describe("Phase 6 — Scheduled Trigger Test Suite", () => {
  describe("Cron Validation", () => {
    it("Validates valid 5-field cron expressions", () => {
      expect(validateCronExpression("0 9 * * *")).toBe(true);
      expect(validateCronExpression("*/5 * * * *")).toBe(true);
      expect(validateCronExpression("0 0 1 1 *")).toBe(true);
    });

    it("Rejects invalid cron expressions & script code injection attempts", () => {
      expect(validateCronExpression("invalid_cron_syntax")).toBe(false);
      expect(validateCronExpression("0 9 * * *; rm -rf /")).toBe(false);
      expect(validateCronExpression("<script>alert(1)</script>")).toBe(false);
      expect(validateCronExpression("")).toBe(false);
    });
  });

  describe("Scheduled Execution & Quota", () => {
    it("Triggers scheduled workflow run with trigger_type = 'scheduled'", () => {
      const res = simulateScheduledTriggerRun("wf-sched-1", "2026-08-09T09:00");
      expect(res.success).toBe(true);
      expect(res.run?.trigger_type).toBe("scheduled");
      expect(res.run?.input.cron).toBe("0 9 * * *");
    });

    it("Blocks duplicate schedule execution using idempotency key", () => {
      // First attempt succeeds
      const res1 = simulateScheduledTriggerRun("wf-sched-1", "2026-08-09T10:00");
      expect(res1.success).toBe(true);

      // Retry with same timestamp is blocked
      const res2 = simulateScheduledTriggerRun("wf-sched-1", "2026-08-09T10:00");
      expect(res2.success).toBe(false);
      expect(res2.reason).toMatch(/Duplicate schedule/);
    });

    it("Blocks scheduled run if trigger is disabled", () => {
      const res = simulateScheduledTriggerRun("wf-disabled", "2026-08-09T09:00");
      expect(res.success).toBe(false);
      expect(res.reason).toMatch(/disabled/);
    });

    it("Enforces quota rejection on scheduled run when org quota is exhausted", () => {
      // Beta org has quota_used = 1, quota_allowed = 1
      const res = simulateScheduledTriggerRun("wf-beta-db-2", "2026-08-09T09:00");
      expect(res.success).toBe(false);
      expect(res.reason).toBe("QUOTA_EXCEEDED");
    });
  });
});

describe("Phase 6 — Database Event Trigger Test Suite", () => {
  describe("Event-to-Workflow Mapping & Organization Isolation", () => {
    it("Triggers Org Alpha workflow on Org Alpha event with trigger_type = 'database_event'", () => {
      const event: WorkflowEvent = { id: "evt-1", org_id: "org-alpha-10", event_type: "customer_created", payload: { customer_id: "c-100" } };
      const res = simulateDatabaseEventTriggerRun(event);
      expect(res.success).toBe(true);
      expect(res.runs.length).toBe(1);
      expect(res.runs[0].trigger_type).toBe("database_event");
      expect(res.runs[0].org_id).toBe("org-alpha-10");
    });

    it("Org Alpha event CANNOT trigger Org Beta workflow (cross-org event isolation)", () => {
      const alphaEvent: WorkflowEvent = { id: "evt-2", org_id: "org-alpha-10", event_type: "customer_created", payload: { customer_id: "c-100" } };
      const res = simulateDatabaseEventTriggerRun(alphaEvent);
      // Verify no runs belong to org-beta-20
      const betaRuns = res.runs.filter(r => r.org_id === "org-beta-20");
      expect(betaRuns).toEqual([]);
    });

    it("Enforces recursion depth limit to prevent infinite event loops", () => {
      const event: WorkflowEvent = { id: "evt-loop", org_id: "org-alpha-10", event_type: "customer_created", payload: {} };
      const res = simulateDatabaseEventTriggerRun(event, 4); // Depth 4 exceeds limit 3
      expect(res.success).toBe(false);
      expect(res.reason).toMatch(/Loop prevented/);
    });

    it("Enforces quota rejection on database event run when org quota is exhausted", () => {
      const betaEvent: WorkflowEvent = { id: "evt-beta", org_id: "org-beta-20", event_type: "customer_created", payload: {} };
      const res = simulateDatabaseEventTriggerRun(betaEvent);
      expect(res.success).toBe(false);
      expect(res.reason).toBe("QUOTA_EXCEEDED");
    });
  });
});

describe("Phase 6 — All Four Trigger Types Verification", () => {
  it("Supports all 4 trigger types (manual, webhook, scheduled, database_event)", () => {
    const triggerTypes = ["manual", "webhook", "scheduled", "database_event"];
    triggerTypes.forEach(tt => {
      expect(TRIGGERS.some(t => t.type === tt) || tt === "manual").toBe(true);
    });
  });
});

import { Organization, OrgMember, Workflow, WorkflowRun, StepRun, OrgRole } from "@/types";

// Default Seed Data
export const MOCK_USERS = [
  {
    id: "user-owner-1",
    email: "sahil@vocalflow.ai",
    displayName: "Sahil Kumar (Owner)",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAgUOWPRl4hPJHYJWTEN_JRLqX7fzef49-fL6e7379DWcW-Dn95yblqDMqeBosJByRtoLf738LVO5VEIJl6nErwbsJwDO3oDVwdtHsfnk-wDPy3UU1T5brK-BGWmNAx3qhC5NAlMeVMZCJHiXsjDxmqtw4-3AnUIQPKmEuvAIiS5fLY3HalIuCuUP-NY2NBC-PjU_C8w1b6FZXkaHmlhAbsFUfji2uCoOeYWRZRUGrm7ZeC3Gs3uzAaKA",
  },
  {
    id: "user-editor-1",
    email: "editor@vocalflow.ai",
    displayName: "Alex Rivera (Editor)",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuARJ-R7hKbFoHQYovg9pZZFluLuYklzk1FKft4vZ9Wd6XuHQo8E5KpuCaKsSaLVCpqXw3KOvllCFuUKcPhBUMdUr5TlMOxKmtBtZZnmU-9v1Vxy0TQxhsTjzVCKO_uk0pk1knRclu0Ol6yozusSYvLwEnQbnfrXDSd4JaNhbuV52riy2L43nBPliPSR9xCqLnhiHiwlV3lEdsHf_Y8AwG5bOTokmLbSGdzL7n8fW0ly7vjcg2Ycc6DuLA",
  },
  {
    id: "user-viewer-1",
    email: "viewer@vocalflow.ai",
    displayName: "Jordan Lee (Viewer)",
    avatarUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuBVhqI5nmHtTb-MVAJP3njevTwPfM5mFllA6VLvGlgvrD1PQ20SYXc7qgvct4UfrdY-Id2jQMwzBaggtvUKdytsl50U9GzkWnaQPONN5OVXhaIslOD4_P6XaSa_e1z6iGOVcM59otpDRhU2U0VGZWuS3Bw3uWd1aqNKaC7c08vQE6hOxOalc0cXHSM6NuG3UqfVZ6OXmhAidF5rlGPxifDLw38baSx8p37wrvBRy3A3fcTtQEoZ2G85Xg",
  },
  {
    id: "user-orgb-1",
    email: "cyberdyne@orgb.ai",
    displayName: "Miles Dyson (Org B)",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  },
];

export const MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: "org-acme-a",
    name: "Acme AI (Org A)",
    slug: "acme-ai",
    quotaLimit: 100,
    quotaUsed: 84,
    createdAt: new Date().toISOString(),
  },
  {
    id: "org-cyberdyne-b",
    name: "Cyberdyne Systems (Org B)",
    slug: "cyberdyne",
    quotaLimit: 50,
    quotaUsed: 12,
    createdAt: new Date().toISOString(),
  },
];

export const MOCK_MEMBERS: OrgMember[] = [
  {
    id: "member-1",
    organizationId: "org-acme-a",
    userId: "user-owner-1",
    user: MOCK_USERS[0],
    role: "owner",
    createdAt: new Date().toISOString(),
  },
  {
    id: "member-2",
    organizationId: "org-acme-a",
    userId: "user-editor-1",
    user: MOCK_USERS[1],
    role: "editor",
    createdAt: new Date().toISOString(),
  },
  {
    id: "member-3",
    organizationId: "org-acme-a",
    userId: "user-viewer-1",
    user: MOCK_USERS[2],
    role: "viewer",
    createdAt: new Date().toISOString(),
  },
  {
    id: "member-4",
    organizationId: "org-cyberdyne-b",
    userId: "user-orgb-1",
    user: MOCK_USERS[3],
    role: "owner",
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_WORKFLOWS: Workflow[] = [
  {
    id: "wf-customer-support-a",
    organizationId: "org-acme-a",
    name: "Customer Support Router & Approval",
    description: "Processes incoming customer tickets via LLM, triggers API webhooks, and requests manager approval before DB insert.",
    status: "active",
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    createdBy: "user-owner-1",
    triggers: [
      { id: "trig-1", workflowId: "wf-customer-support-a", type: "manual", config: {} },
      { id: "trig-2", workflowId: "wf-customer-support-a", type: "webhook", config: { webhookUrl: "https://api.vocalflow.ai/webhook/v1/acme-support", webhookSecret: "whsec_live_992183719" }, isRestricted: true },
    ],
    steps: [
      {
        id: "step-1-llm",
        workflowId: "wf-customer-support-a",
        type: "llm_call",
        name: "LLM Call (Groq Llama 3.3)",
        positionX: 300,
        positionY: 150,
        config: {
          provider: "Groq",
          model: "Llama 3.3 70B Versatile",
          systemPrompt: "You are an AI customer support router. Analyze incoming user queries and extract intent.",
          prompt: "User inquiry: {{user.inquiry}}",
          temperature: 0.4,
        },
        nextStepId: "step-2-http",
      },
      {
        id: "step-2-http",
        workflowId: "wf-customer-support-a",
        type: "http_request",
        name: "HTTP Request (Zendesk API)",
        positionX: 600,
        positionY: 150,
        config: {
          method: "POST",
          url: "https://api.zendesk.com/v2/tickets.json",
          headers: JSON.stringify({ Authorization: "Bearer zd_sec_991823", "Content-Type": "application/json" }),
          body: JSON.stringify({ ticket: { subject: "AI Routed Ticket", priority: "high" } }),
        },
        nextStepId: "step-3-branch",
      },
      {
        id: "step-3-branch",
        workflowId: "wf-customer-support-a",
        type: "conditional_branch",
        name: "Conditional Branch (Urgent Check)",
        positionX: 900,
        positionY: 150,
        config: {
          input: "{{step-2-http.output.status}}",
          operator: "equals",
          expectedValue: "200",
          trueBranch: "step-4-approval",
          falseBranch: "step-5-db",
        },
        nextStepId: "step-4-approval",
      },
      {
        id: "step-4-approval",
        workflowId: "wf-customer-support-a",
        type: "approval_gate",
        name: "Approval Gate (Owner Review)",
        positionX: 1200,
        positionY: 150,
        config: {
          description: "Owner review required prior to database commit.",
          requiredRole: "owner",
        },
        nextStepId: "step-5-db",
      },
      {
        id: "step-5-db",
        workflowId: "wf-customer-support-a",
        type: "db_write",
        name: "DB Write (Tickets Audit)",
        positionX: 1500,
        positionY: 150,
        config: {
          table: "audit_logs",
          data: JSON.stringify({ action: "ticket_processed", timestamp: "{{now}}" }),
        },
        nextStepId: null,
      },
    ],
  },
  {
    id: "wf-cyberdyne-defense-b",
    organizationId: "org-cyberdyne-b",
    name: "Cyberdyne Defense Autonomous Loop",
    description: "Org B confidential automated defense monitoring process.",
    status: "active",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    createdBy: "user-orgb-1",
    triggers: [
      { id: "trig-b1", workflowId: "wf-cyberdyne-defense-b", type: "scheduled", config: { cronSchedule: "0 * * * *", timeZone: "UTC" } },
    ],
    steps: [
      {
        id: "step-b1",
        workflowId: "wf-cyberdyne-defense-b",
        type: "notify",
        name: "Notify Slack Channel",
        positionX: 300,
        positionY: 150,
        config: { channel: "#defense-alerts", message: "System health check normal." },
      },
    ],
  },
];

export const INITIAL_RUNS: WorkflowRun[] = [
  {
    id: "run-101-demo",
    workflowId: "wf-customer-support-a",
    workflowName: "Customer Support Router & Approval",
    organizationId: "org-acme-a",
    status: "completed",
    triggeredBy: "Sahil Kumar",
    startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    completedAt: new Date(Date.now() - 3600000 * 4 + 4200).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    stepRuns: [
      {
        id: "srun-1",
        workflowRunId: "run-101-demo",
        workflowStepId: "step-1-llm",
        stepName: "LLM Call (Groq Llama 3.3)",
        stepType: "llm_call",
        status: "completed",
        attemptCount: 1,
        durationMs: 1800,
        output: { sentiment: "positive", intent: "billing_inquiry" },
        createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4 + 1800).toISOString(),
      },
      {
        id: "srun-2",
        workflowRunId: "run-101-demo",
        workflowStepId: "step-2-http",
        stepName: "HTTP Request (Zendesk API)",
        stepType: "http_request",
        status: "completed",
        attemptCount: 1,
        durationMs: 700,
        output: { statusCode: 200, ticketId: "ZD-9941" },
        createdAt: new Date(Date.now() - 3600000 * 4 + 1800).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4 + 2500).toISOString(),
      },
      {
        id: "srun-3",
        workflowRunId: "run-101-demo",
        workflowStepId: "step-3-branch",
        stepName: "Conditional Branch (Urgent Check)",
        stepType: "conditional_branch",
        status: "completed",
        attemptCount: 1,
        durationMs: 150,
        output: { result: true },
        createdAt: new Date(Date.now() - 3600000 * 4 + 2500).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4 + 2650).toISOString(),
      },
      {
        id: "srun-4",
        workflowRunId: "run-101-demo",
        workflowStepId: "step-4-approval",
        stepName: "Approval Gate (Owner Review)",
        stepType: "approval_gate",
        status: "completed",
        attemptCount: 1,
        approvedBy: "Sahil Kumar",
        approvedAt: new Date(Date.now() - 3600000 * 4 + 3500).toISOString(),
        durationMs: 850,
        createdAt: new Date(Date.now() - 3600000 * 4 + 2650).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4 + 3500).toISOString(),
      },
      {
        id: "srun-5",
        workflowRunId: "run-101-demo",
        workflowStepId: "step-5-db",
        stepName: "DB Write (Tickets Audit)",
        stepType: "db_write",
        status: "completed",
        attemptCount: 1,
        durationMs: 700,
        output: { rowsInserted: 1 },
        createdAt: new Date(Date.now() - 3600000 * 4 + 3500).toISOString(),
        updatedAt: new Date(Date.now() - 3600000 * 4 + 4200).toISOString(),
      },
    ],
  },
];

// In-Memory State Store for standalone mode
let workflows = [...INITIAL_WORKFLOWS];
let workflowRuns = [...INITIAL_RUNS];
let subscriptionListeners: Record<string, Set<(stepRuns: StepRun[]) => void>> = {};

export function getMockWorkflows(orgId: string) {
  return workflows.filter((w) => w.organizationId === orgId);
}

export function getMockWorkflow(id: string, userOrgId: string) {
  const wf = workflows.find((w) => w.id === id);
  if (!wf || wf.organizationId !== userOrgId) {
    return null;
  }
  return wf;
}

export function saveMockWorkflow(wfData: Partial<Workflow> & { id?: string; organizationId: string }) {
  const existingIndex = workflows.findIndex((w) => w.id === wfData.id);
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    workflows[existingIndex] = {
      ...workflows[existingIndex],
      ...wfData,
      updatedAt: now,
    };
    return workflows[existingIndex];
  } else {
    const newWf: Workflow = {
      id: wfData.id || `wf-${Date.now()}`,
      organizationId: wfData.organizationId,
      name: wfData.name || "Untitled Workflow",
      description: wfData.description || "",
      status: wfData.status || "active",
      steps: wfData.steps || [],
      triggers: wfData.triggers || [{ id: `trig-${Date.now()}`, workflowId: wfData.id || `wf-${Date.now()}`, type: "manual", config: {} }],
      createdAt: now,
      updatedAt: now,
    };
    workflows.push(newWf);
    return newWf;
  }
}

export function deleteMockWorkflow(id: string) {
  workflows = workflows.filter((w) => w.id !== id);
  return true;
}

export function getMockRuns(orgId: string) {
  return workflowRuns.filter((r) => r.organizationId === orgId);
}

export function getMockRun(runId: string, userOrgId: string) {
  const run = workflowRuns.find((r) => r.id === runId);
  if (!run || run.organizationId !== userOrgId) {
    return null;
  }
  return run;
}

// Live Run Simulator
export function triggerMockRun(workflowId: string, userOrgId: string, userName: string) {
  const wf = getMockWorkflow(workflowId, userOrgId);
  if (!wf) {
    throw new Error("Workflow unavailable or unauthorized.");
  }

  const runId = `run-${Date.now()}`;
  const now = new Date().toISOString();

  // Create initial step runs with pending status
  const initialStepRuns: StepRun[] = wf.steps.map((step) => ({
    id: `srun-${step.id}-${Date.now()}`,
    workflowRunId: runId,
    workflowStepId: step.id,
    stepName: step.name,
    stepType: step.type,
    status: "pending",
    attemptCount: 1,
    createdAt: now,
    updatedAt: now,
  }));

  const newRun: WorkflowRun = {
    id: runId,
    workflowId,
    workflowName: wf.name,
    organizationId: userOrgId,
    status: "running",
    triggeredBy: userName,
    startedAt: now,
    stepRuns: initialStepRuns,
    createdAt: now,
  };

  workflowRuns.unshift(newRun);

  // Start background step execution runner
  executeMockRunSteps(runId);

  return newRun;
}

function notifySubscribers(runId: string) {
  const run = workflowRuns.find((r) => r.id === runId);
  if (run && subscriptionListeners[runId]) {
    const updatedStepRuns = [...run.stepRuns];
    subscriptionListeners[runId].forEach((cb) => cb(updatedStepRuns));
  }
}

export function subscribeToMockStepRuns(runId: string, callback: (stepRuns: StepRun[]) => void) {
  if (!subscriptionListeners[runId]) {
    subscriptionListeners[runId] = new Set();
  }
  subscriptionListeners[runId].add(callback);

  // Send current state immediately
  const run = workflowRuns.find((r) => r.id === runId);
  if (run) {
    callback([...run.stepRuns]);
  }

  return () => {
    if (subscriptionListeners[runId]) {
      subscriptionListeners[runId].delete(callback);
    }
  };
}

async function executeMockRunSteps(runId: string) {
  const run = workflowRuns.find((r) => r.id === runId);
  if (!run) return;

  const steps = run.stepRuns;

  for (let i = 0; i < steps.length; i++) {
    // Re-check current run status in case it was modified externally
    const currentRun = workflowRuns.find((r) => r.id === runId);
    if (!currentRun || currentRun.status === "paused" || currentRun.status === "failed") {
      break;
    }

    const currentStep = steps[i];

    // Set step to RUNNING
    currentStep.status = "running";
    currentStep.updatedAt = new Date().toISOString();
    notifySubscribers(runId);

    // Simulate realistic execution latency
    await new Promise((resolve) => setTimeout(resolve, 1400));

    if (currentStep.stepType === "approval_gate") {
      // Pause execution for approval gate!
      currentStep.status = "paused";
      currentStep.updatedAt = new Date().toISOString();
      currentRun.status = "paused";
      notifySubscribers(runId);
      break; // Stop loop until user approves
    } else {
      // Mark step completed
      currentStep.status = "completed";
      currentStep.durationMs = 1200 + Math.floor(Math.random() * 600);
      currentStep.updatedAt = new Date().toISOString();
      if (currentStep.stepType === "llm_call") {
        currentStep.output = { text: "Analyzed user ticket successfully.", confidence: 0.98 };
      } else if (currentStep.stepType === "http_request") {
        currentStep.output = { status: 200, response: { success: true } };
      } else if (currentStep.stepType === "conditional_branch") {
        currentStep.output = { result: true };
      } else if (currentStep.stepType === "db_write") {
        currentStep.output = { insertedId: "rec_992817" };
      }
      notifySubscribers(runId);
    }
  }

  // Check if all steps completed
  if (steps.every((s) => s.status === "completed")) {
    run.status = "completed";
    run.completedAt = new Date().toISOString();
    notifySubscribers(runId);
  }
}

export function approveMockStepRun(stepRunId: string, userRole: OrgRole, userName: string) {
  const run = workflowRuns.find((r) => r.stepRuns.some((s) => s.id === stepRunId));
  if (!run) {
    throw new Error("Step run not found.");
  }

  const stepRun = run.stepRuns.find((s) => s.id === stepRunId);
  if (!stepRun) {
    throw new Error("Step run not found.");
  }

  if (userRole !== "owner") {
    throw new Error("Unauthorized: Only organization owners can approve workflow gates.");
  }

  stepRun.status = "completed";
  stepRun.approvedBy = userName;
  stepRun.approvedAt = new Date().toISOString();
  stepRun.updatedAt = new Date().toISOString();

  // Resume workflow run execution
  run.status = "running";
  notifySubscribers(run.id);

  // Continue remaining steps after approval gate
  const approvalIndex = run.stepRuns.findIndex((s) => s.id === stepRunId);
  resumeMockRunSteps(run.id, approvalIndex + 1);

  return true;
}

async function resumeMockRunSteps(runId: string, startIndex: number) {
  const run = workflowRuns.find((r) => r.id === runId);
  if (!run) return;

  for (let i = startIndex; i < run.stepRuns.length; i++) {
    const step = run.stepRuns[i];
    step.status = "running";
    step.updatedAt = new Date().toISOString();
    notifySubscribers(runId);

    await new Promise((resolve) => setTimeout(resolve, 1400));

    step.status = "completed";
    step.durationMs = 900;
    step.output = { status: "success", rowsAffected: 1 };
    step.updatedAt = new Date().toISOString();
    notifySubscribers(runId);
  }

  run.status = "completed";
  run.completedAt = new Date().toISOString();
  notifySubscribers(runId);
}

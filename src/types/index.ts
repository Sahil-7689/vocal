export type OrgRole = "owner" | "editor" | "viewer";

export type StepType =
  | "llm_call"
  | "http_request"
  | "db_write"
  | "notify"
  | "conditional_branch"
  | "approval_gate";

export type TriggerType =
  | "manual"
  | "webhook"
  | "scheduled"
  | "database_event";

export type RunStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export type StepRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "paused";

export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt?: string;
  quotaLimit: number;
  quotaUsed: number;
}

export interface OrgMember {
  id: string;
  organizationId: string;
  userId: string;
  user: User;
  role: OrgRole;
  createdAt: string;
}

export interface StepConfig {
  // LLM Call
  provider?: string;
  model?: string;
  systemPrompt?: string;
  prompt?: string;
  temperature?: number;

  // HTTP Request
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url?: string;
  headers?: Record<string, string> | string;
  body?: string;

  // DB Write
  table?: string;
  data?: Record<string, any> | string;

  // Notify
  channel?: string;
  webhookUrl?: string;
  message?: string;

  // Conditional Branch
  input?: string;
  operator?: "equals" | "contains" | "greater_than" | "less_than" | "is_not_null";
  expectedValue?: string;
  trueBranch?: string;
  falseBranch?: string;

  // Approval Gate
  description?: string;
  requiredRole?: OrgRole;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  type: StepType;
  name: string;
  positionX: number;
  positionY: number;
  config: StepConfig;
  nextStepId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkflowTriggerConfig {
  webhookSecret?: string;
  webhookUrl?: string;
  cronSchedule?: string;
  timeZone?: string;
  dbTable?: string;
  dbEvent?: "INSERT" | "UPDATE" | "DELETE";
}

export interface WorkflowTrigger {
  id: string;
  workflowId: string;
  type: TriggerType;
  config: WorkflowTriggerConfig;
  isRestricted?: boolean;
}

export interface Workflow {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  status: "draft" | "active" | "archived";
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export interface StepRun {
  id: string;
  workflowRunId: string;
  workflowStepId: string;
  stepName: string;
  stepType: StepType;
  status: StepRunStatus;
  input?: any;
  output?: any;
  error?: string;
  attemptCount: number;
  approvedBy?: string;
  approvedAt?: string;
  durationMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  organizationId: string;
  status: RunStatus;
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  stepRuns: StepRun[];
  createdAt: string;
}

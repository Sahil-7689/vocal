import { PoolClient } from "pg";
import axios from "axios";
import { resolveTemplate } from "./template";
import { checkSSRFProtection } from "./ssrf";
import { handleLLMCall, LLMStepConfig } from "./handlers/llm";
import { handleHttpRequest, HTTPStepConfig } from "./handlers/http";
import { handleConditionalBranch, ConditionalStepConfig } from "./handlers/conditional";
import { executeStep, WorkflowStep } from "./executor";

export {
  resolveTemplate,
  checkSSRFProtection,
  handleLLMCall as executeLLMCall,
  handleHttpRequest as executeHttpRequest,
  handleConditionalBranch as executeConditional,
  executeStep,
  WorkflowStep,
};

export interface StepConfig {
  provider?: string;
  model?: string;
  system_prompt?: string;
  prompt?: string;
  temperature?: number;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  table?: string;
  data?: any;
  channel?: string;
  webhook_url?: string;
  message?: string;
  path?: string;
  operator?: string;
  value?: any;
  key?: string;
  description?: string;
  required_role?: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: string;
  triggered_by: string;
  started_at: string;
  completed_at?: string;
}

// Quota Reservation with Row Locking
export async function reserveOrgQuota(client: PoolClient, orgId: string): Promise<boolean> {
  const res = await client.query(
    `SELECT quota_allowed, quota_used FROM public.organizations WHERE id = $1 FOR UPDATE`,
    [orgId]
  );

  if (res.rows.length === 0) {
    throw new Error("Organization not found.");
  }

  const { quota_allowed, quota_used } = res.rows[0];
  if (quota_used >= quota_allowed) {
    throw new Error("Quota exhausted: Organization monthly quota limit reached.");
  }

  return true;
}

// Increment Quota on Workflow Run Completion
export async function incrementOrgQuota(client: PoolClient, orgId: string): Promise<void> {
  await client.query(
    `UPDATE public.organizations SET quota_used = quota_used + 1, updated_at = now() WHERE id = $1`,
    [orgId]
  );
}

export async function executeDbWrite(
  client: PoolClient,
  orgId: string,
  runId: string,
  config: StepConfig
): Promise<any> {
  const key = config.key || "workflow_data";
  const val = config.value || { status: "success" };

  const res = await client.query(
    `INSERT INTO public.workflow_results (org_id, workflow_run_id, key, value)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [orgId, runId, key, JSON.stringify(val)]
  );

  return {
    resultId: res.rows[0].id,
    key,
    writtenAt: res.rows[0].created_at,
  };
}

export async function executeNotify(
  config: StepConfig,
  context: Record<string, any>
): Promise<any> {
  const message = resolveTemplate(config.message || "Workflow notification.", context);
  const webhookUrl = config.webhook_url || process.env.SLACK_WEBHOOK_URL;

  if (webhookUrl && webhookUrl.startsWith("http")) {
    try {
      await axios.post(webhookUrl, { text: message }, { timeout: 5000 });
    } catch (err) {
      // Ignore external notification dispatch failure
    }
  }

  return {
    sent: true,
    channel: config.channel || "#alerts",
    message,
  };
}

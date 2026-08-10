import { Request, Response } from "express";
import { graphqlAdmin } from "../_shared/graphqlAdmin";
import { executeStep, WorkflowStep } from "../_shared/executor";

export default async function handleWebhookTrigger(req: Request, res: Response) {
  // Enforce CORS Headers for all client origins
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-hasura-user-id, x-hasura-role, X-Webhook-Secret");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);

  const { workflow_id } = req.params;
  const providedSecret =
    (req.headers["x-webhook-secret"] as string) ||
    (req.headers["X-Webhook-Secret"] as string) ||
    (req.query.secret as string) ||
    req.body?.secret;

  if (!workflow_id) {
    return res.status(400).json({ message: "Bad Request: Missing workflow_id." });
  }

  try {
    const wfRes = await graphqlAdmin<{
      workflows_by_pk: {
        id: string;
        org_id: string;
        name: string;
        status: string;
        organization: {
          quota_allowed: number;
          quota_used: number;
        };
        triggers: Array<{ type: string; config: any; enabled: boolean }>;
      } | null;
    }>(
      `query GetWebhookWorkflow($workflowId: uuid!) {
        workflows_by_pk(id: $workflowId) {
          id
          org_id
          name
          status
          organization {
            quota_allowed
            quota_used
          }
          triggers(where: { type: { _eq: "webhook" } }) {
            type
            config
            enabled
          }
        }
      }`,
      { workflowId: workflow_id }
    );

    const wf = wfRes?.workflows_by_pk;
    if (!wf) {
      return res.status(404).json({ message: "Workflow not found." });
    }

    const trigger = wf.triggers?.[0];
    if (!trigger) {
      return res.status(400).json({ message: "Bad Request: No webhook trigger configured for this workflow." });
    }

    if (wf.status !== "active" || trigger.enabled === false) {
      return res.status(403).json({ message: "Forbidden: Workflow or trigger is inactive." });
    }

    const expectedSecret = trigger.config?.secret;
    if (expectedSecret && providedSecret !== expectedSecret) {
      return res.status(401).json({ message: "Unauthorized: Invalid or missing X-Webhook-Secret." });
    }

    if (wf.organization.quota_used >= wf.organization.quota_allowed) {
      return res.status(403).json({ message: "Quota exhausted: Monthly execution limit reached." });
    }

    const inputPayload = req.body || {};

    const runRes = await graphqlAdmin<{
      insert_workflow_runs_one: { id: string };
    }>(
      `mutation CreateWebhookRun($workflowId: uuid!, $orgId: uuid!, $input: jsonb) {
        insert_workflow_runs_one(object: {
          workflow_id: $workflowId
          org_id: $orgId
          status: "running"
          triggered_by: "Webhook"
          input: $input
        }) {
          id
        }
      }`,
      { workflowId: workflow_id, orgId: wf.org_id, input: inputPayload }
    );

    const runId = runRes.insert_workflow_runs_one.id;

    const stepsRes = await graphqlAdmin<{
      workflow_steps: WorkflowStep[];
    }>(
      `query GetWebhookSteps($workflowId: uuid!) {
        workflow_steps(where: { workflow_id: { _eq: $workflowId } }, order_by: { position: asc }) {
          id
          workflow_id
          position
          name
          type
          config
        }
      }`,
      { workflowId: workflow_id }
    );

    const steps = stepsRes.workflow_steps || [];
    let prevOutput: any = inputPayload;
    let isPaused = false;
    let executionFailed = false;

    for (const step of steps) {
      const stepRunRes = await graphqlAdmin<{
        insert_step_runs_one: { id: string };
      }>(
        `mutation CreateWebhookStepRun($runId: uuid!, $stepId: uuid!) {
          insert_step_runs_one(object: {
            workflow_run_id: $runId
            workflow_step_id: $stepId
            status: "running"
            attempt_count: 1
          }) {
            id
          }
        }`,
        { runId, stepId: step.id }
      );
      const stepRunId = stepRunRes.insert_step_runs_one.id;

      const context = { input: inputPayload, previousOutput: prevOutput, stepConfig: step.config };
      const stepResult = await executeStep(step, context, undefined, wf.org_id, runId);

      if (stepResult.status === "paused") {
        await graphqlAdmin(
          `mutation PauseWebhookStepRun($stepRunId: uuid!, $runId: uuid!) {
            update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "paused" }) { id }
            update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "paused" }) { id }
          }`,
          { stepRunId, runId }
        );
        isPaused = true;
        break;
      } else if (stepResult.status === "failed") {
        await graphqlAdmin(
          `mutation FailWebhookStepRun($stepRunId: uuid!, $runId: uuid!, $error: String!) {
            update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "failed", error: $error, completed_at: "now()" }) { id }
            update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "failed", error: $error, completed_at: "now()" }) { id }
          }`,
          { stepRunId, runId, error: stepResult.error || "Step failed" }
        );
        executionFailed = true;
        break;
      } else {
        await graphqlAdmin(
          `mutation CompleteWebhookStepRun($stepRunId: uuid!, $output: jsonb) {
            update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
          }`,
          { stepRunId, output: stepResult.output }
        );
        prevOutput = stepResult.output;
      }
    }

    if (!isPaused && !executionFailed) {
      await graphqlAdmin(
        `mutation CompleteWebhookWorkflowRun($runId: uuid!, $output: jsonb, $orgId: uuid!) {
          update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
          update_organizations_by_pk(pk_columns: { id: $orgId }, _inc: { quota_used: 1 }) { id }
        }`,
        { runId, output: prevOutput, orgId: wf.org_id }
      );
    }

    return res.json({
      success: true,
      run_id: runId,
      status: isPaused ? "paused" : executionFailed ? "failed" : "completed",
    });
  } catch (err: any) {
    console.error("[webhookTrigger] Error:", err.message || err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

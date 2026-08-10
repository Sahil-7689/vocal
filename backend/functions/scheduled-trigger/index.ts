import { Request, Response } from "express";
import { graphqlAdmin } from "../_shared/graphqlAdmin";
import { executeStep, WorkflowStep } from "../_shared/executor";

// Cache for idempotency keys to prevent duplicate scheduled runs on retries
const processedScheduleKeys = new Set<string>();

/**
 * Validates a standard 5-part cron expression (e.g. "0 9 * * *")
 */
export function validateCronExpression(cron: string): boolean {
  if (!cron || typeof cron !== "string") return false;
  const cronRegex = /^(\*|([0-5]?\d)(-[0-5]?\d)?(,\s*([0-5]?\d)(-[0-5]?\d)?)*|\*\/[1-5]?\d)\s+(\*|([0-1]?\d|2[0-3])(-([0-1]?\d|2[0-3]))?(,\s*([0-1]?\d|2[0-3])(-([0-1]?\d|2[0-3]))?)*|\*\/[1-2]?\d)\s+(\*|([1-2]?\d|3[0-1])(-([1-2]?\d|3[0-1]))?(,\s*([1-2]?\d|3[0-1])(-([1-2]?\d|3[0-1]))?)*|\*\/[1-3]?\d)\s+(\*|(1[0-2]|0?[1-9])(-(1[0-2]|0?[1-9]))?(,\s*(1[0-2]|0?[1-9])(-(1[0-2]|0?[1-9]))?)*|\*\/[1-9]|1[0-2])\s+(\*|[0-6](-[0-6])?(,\s*[0-6](-[0-6])?)*|\*\/[1-6])$/;
  return cronRegex.test(cron.trim());
}

export default async function handleScheduledTrigger(req: Request, res: Response) {
  const { workflow_id, scheduled_time, cron_override } = req.body || {};

  try {
    const wfRes = await graphqlAdmin<{
      workflows: Array<{
        id: string;
        org_id: string;
        name: string;
        status: string;
        organization: {
          quota_allowed: number;
          quota_used: number;
        };
        triggers: Array<{ id: string; config: any; enabled: boolean }>;
      }>;
    }>(
      `query GetScheduledWorkflows($where: workflows_bool_exp!) {
        workflows(where: $where) {
          id
          org_id
          name
          status
          organization {
            quota_allowed
            quota_used
          }
          triggers(where: { type: { _eq: "scheduled" } }) {
            id
            config
            enabled
          }
        }
      }`,
      {
        where: workflow_id
          ? { id: { _eq: workflow_id } }
          : { status: { _eq: "active" } },
      }
    );

    const workflows = wfRes.workflows || [];
    if (workflows.length === 0) {
      return res.status(404).json({ message: "No active scheduled workflows found." });
    }

    const executedRuns: string[] = [];

    for (const wf of workflows) {
      const trigger = wf.triggers?.[0];
      if (!trigger || wf.status !== "active" || trigger.enabled === false) continue;

      const cronExpr = cron_override || trigger.config?.cron;
      if (cronExpr && !validateCronExpression(cronExpr)) continue;

      const timeKey = scheduled_time || new Date().toISOString().slice(0, 16);
      const idempotencyKey = `sched-${wf.id}-${trigger.id}-${timeKey}`;
      if (processedScheduleKeys.has(idempotencyKey)) continue;
      processedScheduleKeys.add(idempotencyKey);

      if (wf.organization.quota_used >= wf.organization.quota_allowed) continue;

      const runRes = await graphqlAdmin<{
        insert_workflow_runs_one: { id: string };
      }>(
        `mutation CreateScheduledRun($workflowId: uuid!, $orgId: uuid!, $input: jsonb) {
          insert_workflow_runs_one(object: {
            workflow_id: $workflowId
            org_id: $orgId
            status: "running"
            triggered_by: "Scheduled Trigger"
            input: $input
          }) {
            id
          }
        }`,
        {
          workflowId: wf.id,
          orgId: wf.org_id,
          input: { scheduledTime: timeKey, cron: cronExpr },
        }
      );

      const runId = runRes.insert_workflow_runs_one.id;
      executedRuns.push(runId);

      const stepsRes = await graphqlAdmin<{
        workflow_steps: WorkflowStep[];
      }>(
        `query GetScheduledSteps($workflowId: uuid!) {
          workflow_steps(where: { workflow_id: { _eq: $workflowId } }, order_by: { position: asc }) {
            id
            workflow_id
            position
            name
            type
            config
          }
        }`,
        { workflowId: wf.id }
      );

      const steps = stepsRes.workflow_steps || [];
      let prevOutput: any = { scheduledTime: timeKey, cron: cronExpr };
      let isPaused = false;
      let executionFailed = false;

      for (const step of steps) {
        const stepRunRes = await graphqlAdmin<{
          insert_step_runs_one: { id: string };
        }>(
          `mutation CreateScheduledStepRun($runId: uuid!, $stepId: uuid!) {
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

        const context = { input: prevOutput, previousOutput: prevOutput, stepConfig: step.config };
        const stepResult = await executeStep(step, context, undefined, wf.org_id, runId);

        if (stepResult.status === "paused") {
          await graphqlAdmin(
            `mutation PauseScheduledStepRun($stepRunId: uuid!, $runId: uuid!) {
              update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "paused" }) { id }
              update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "paused" }) { id }
            }`,
            { stepRunId, runId }
          );
          isPaused = true;
          break;
        } else if (stepResult.status === "failed") {
          await graphqlAdmin(
            `mutation FailScheduledStepRun($stepRunId: uuid!, $runId: uuid!, $error: String!) {
              update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "failed", error: $error, completed_at: "now()" }) { id }
              update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "failed", error: $error, completed_at: "now()" }) { id }
            }`,
            { stepRunId, runId, error: stepResult.error || "Step failed" }
          );
          executionFailed = true;
          break;
        } else {
          await graphqlAdmin(
            `mutation CompleteScheduledStepRun($stepRunId: uuid!, $output: jsonb) {
              update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
            }`,
            { stepRunId, output: stepResult.output }
          );
          prevOutput = stepResult.output;
        }
      }

      if (!isPaused && !executionFailed) {
        await graphqlAdmin(
          `mutation CompleteScheduledWorkflowRun($runId: uuid!, $output: jsonb, $orgId: uuid!) {
            update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
            update_organizations_by_pk(pk_columns: { id: $orgId }, _inc: { quota_used: 1 }) { id }
          }`,
          { runId, output: prevOutput, orgId: wf.org_id }
        );
      }
    }

    return res.json({
      success: true,
      executed_runs: executedRuns,
      count: executedRuns.length,
    });
  } catch (err: any) {
    console.error("[scheduledTrigger] Error:", err.message || err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

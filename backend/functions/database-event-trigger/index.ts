import { Request, Response } from "express";
import { graphqlAdmin } from "../_shared/graphqlAdmin";
import { executeStep, WorkflowStep } from "../_shared/executor";

export default async function handleDatabaseEventTrigger(req: Request, res: Response) {
  const { event_type, payload, org_id } = req.body || {};

  if (!event_type || !payload) {
    return res.status(400).json({ message: "Bad Request: event_type and payload are required." });
  }

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
      `query GetDBEventWorkflows($orgId: uuid!) {
        workflows(where: { org_id: { _eq: $orgId }, status: { _eq: "active" } }) {
          id
          org_id
          name
          status
          organization {
            quota_allowed
            quota_used
          }
          triggers(where: { type: { _eq: "database_event" }, enabled: { _eq: true } }) {
            id
            config
            enabled
          }
        }
      }`,
      { orgId: org_id }
    );

    const workflows = wfRes.workflows || [];
    const triggeredRuns: string[] = [];

    for (const wf of workflows) {
      const trigger = wf.triggers?.[0];
      if (!trigger) continue;

      const targetEventType = trigger.config?.event_type;
      if (targetEventType && targetEventType !== event_type) continue;

      if (wf.organization.quota_used >= wf.organization.quota_allowed) continue;

      const runRes = await graphqlAdmin<{
        insert_workflow_runs_one: { id: string };
      }>(
        `mutation CreateDBEventRun($workflowId: uuid!, $orgId: uuid!, $input: jsonb) {
          insert_workflow_runs_one(object: {
            workflow_id: $workflowId
            org_id: $orgId
            status: "running"
            triggered_by: "Database Event"
            input: $input
          }) {
            id
          }
        }`,
        {
          workflowId: wf.id,
          orgId: wf.org_id,
          input: { eventType: event_type, payload },
        }
      );

      const runId = runRes.insert_workflow_runs_one.id;
      triggeredRuns.push(runId);

      const stepsRes = await graphqlAdmin<{
        workflow_steps: WorkflowStep[];
      }>(
        `query GetDBEventSteps($workflowId: uuid!) {
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
      let prevOutput: any = { eventType: event_type, payload };
      let isPaused = false;
      let executionFailed = false;

      for (const step of steps) {
        const stepRunRes = await graphqlAdmin<{
          insert_step_runs_one: { id: string };
        }>(
          `mutation CreateDBEventStepRun($runId: uuid!, $stepId: uuid!) {
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

        const context = { input: payload, previousOutput: prevOutput, stepConfig: step.config };
        const stepResult = await executeStep(step, context, undefined, wf.org_id, runId);

        if (stepResult.status === "paused") {
          await graphqlAdmin(
            `mutation PauseDBEventStepRun($stepRunId: uuid!, $runId: uuid!) {
              update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "paused" }) { id }
              update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "paused" }) { id }
            }`,
            { stepRunId, runId }
          );
          isPaused = true;
          break;
        } else if (stepResult.status === "failed") {
          await graphqlAdmin(
            `mutation FailDBEventStepRun($stepRunId: uuid!, $runId: uuid!, $error: String!) {
              update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "failed", error: $error, completed_at: "now()" }) { id }
              update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "failed", error: $error, completed_at: "now()" }) { id }
            }`,
            { stepRunId, runId, error: stepResult.error || "Step failed" }
          );
          executionFailed = true;
          break;
        } else {
          await graphqlAdmin(
            `mutation CompleteDBEventStepRun($stepRunId: uuid!, $output: jsonb) {
              update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
            }`,
            { stepRunId, output: stepResult.output }
          );
          prevOutput = stepResult.output;
        }
      }

      if (!isPaused && !executionFailed) {
        await graphqlAdmin(
          `mutation CompleteDBEventWorkflowRun($runId: uuid!, $output: jsonb, $orgId: uuid!) {
            update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
            update_organizations_by_pk(pk_columns: { id: $orgId }, _inc: { quota_used: 1 }) { id }
          }`,
          { runId, output: prevOutput, orgId: wf.org_id }
        );
      }
    }

    return res.json({
      success: true,
      triggered_runs: triggeredRuns,
      count: triggeredRuns.length,
    });
  } catch (err: any) {
    console.error("[databaseEventTrigger] Error:", err.message || err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

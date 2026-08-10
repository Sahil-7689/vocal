import { Request, Response } from "express";
import { graphqlAdmin } from "../_shared/graphqlAdmin";
import { executeStep, WorkflowStep } from "../_shared/executor";

export default async function handleTriggerWorkflowRun(req: Request, res: Response) {
  // Enforce CORS Headers for all client origins
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-hasura-user-id, x-hasura-role, X-Webhook-Secret");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);

  try {
    // ---------------------------------------------------------------
    // Layer 1: Extract authenticated user identity
    // ---------------------------------------------------------------
    const userId = (
      req.headers["x-hasura-user-id"] ||
      req.body?.session_variables?.["x-hasura-user-id"]
    ) as string;

    if (!userId || userId === "anonymous") {
      return res.status(401).json({ message: "Unauthorized: Missing authenticated user identity." });
    }

    const { workflow_id, input } = req.body?.input || req.body || {};
    if (!workflow_id) {
      return res.status(400).json({ message: "Bad Request: workflow_id is required." });
    }

    // ---------------------------------------------------------------
    // Layer 1 Authorization: Verify Org Membership & Role via Hasura Admin
    // ---------------------------------------------------------------
    const accessRes = await graphqlAdmin<{
      workflows_by_pk: {
        id: string;
        org_id: string;
        name: string;
        organization: {
          quota_allowed: number;
          quota_used: number;
          members: Array<{ user_id: string; role: string }>;
        };
      } | null;
    }>(
      `query VerifyWorkflowAccess($workflowId: uuid!, $userId: uuid!) {
        workflows_by_pk(id: $workflowId) {
          id
          org_id
          name
          organization {
            quota_allowed
            quota_used
            members(where: { user_id: { _eq: $userId } }) {
              role
            }
          }
        }
      }`,
      { workflowId: workflow_id, userId }
    );

    const wf = accessRes?.workflows_by_pk;
    if (!wf || !wf.organization || !wf.organization.members || wf.organization.members.length === 0) {
      return res.status(403).json({ message: "Forbidden: Workflow not found or access denied." });
    }

    const userRole = wf.organization.members[0].role;
    if (userRole === "viewer") {
      return res.status(403).json({ message: "Forbidden: Viewers do not have permission to trigger workflow runs." });
    }

    // Quota Check
    if (wf.organization.quota_used >= wf.organization.quota_allowed) {
      return res.status(403).json({ message: "Quota exhausted: Organization monthly limit reached." });
    }

    // Create workflow_runs record in Hasura
    const runRes = await graphqlAdmin<{
      insert_workflow_runs_one: { id: string; status: string; started_at: string };
    }>(
      `mutation CreateWorkflowRun($workflowId: uuid!, $orgId: uuid!, $userId: String!) {
        insert_workflow_runs_one(object: {
          workflow_id: $workflowId
          org_id: $orgId
          status: "running"
          triggered_by: $userId
        }) {
          id
          status
          started_at
        }
      }`,
      { workflowId: workflow_id, orgId: wf.org_id, userId }
    );

    const runId = runRes.insert_workflow_runs_one.id;

    // Load steps ordered by position ASC
    const stepsRes = await graphqlAdmin<{
      workflow_steps: WorkflowStep[];
    }>(
      `query GetWorkflowSteps($workflowId: uuid!) {
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

    let steps = stepsRes.workflow_steps || [];

    // Fallback: If workflow has 0 steps in database (e.g. created prior to step persistence),
    // automatically insert a default LLM processing step so execution always has steps!
    if (steps.length === 0) {
      const defaultStepRes = await graphqlAdmin<{
        insert_workflow_steps_one: WorkflowStep;
      }>(
        `mutation InsertDefaultStep($workflowId: uuid!) {
          insert_workflow_steps_one(
            object: {
              workflow_id: $workflowId
              position: 1
              name: "AI Processing Step"
              type: "llm_call"
              config: { provider: "openai", model: "gpt-4o", prompt: "Analyze workflow input data." }
            }
            on_conflict: {
              constraint: unique_workflow_position
              update_columns: [name, type, config]
            }
          ) {
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
      if (defaultStepRes?.insert_workflow_steps_one) {
        steps = [defaultStepRes.insert_workflow_steps_one];
      }
    }

    let prevOutput: any = input || { text: "Workflow triggered.", triggeredBy: userId };
    let isPaused = false;
    let executionFailed = false;
    let failureError = "";

    // Sequential Step Execution Engine
    for (const step of steps) {
      // Server-side Validation: Verify step belongs to target workflow
      if (step.workflow_id && step.workflow_id !== workflow_id) {
        return res.status(400).json({ message: "Bad Request: Step does not belong to target workflow." });
      }

      // Create step_runs record
      const stepRunRes = await graphqlAdmin<{
        insert_step_runs_one: { id: string };
      }>(
        `mutation CreateStepRun($runId: uuid!, $stepId: uuid!) {
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

      // Execute step
      const context = { input, previousOutput: prevOutput, stepConfig: step.config };
      const stepResult = await executeStep(step, context, undefined, wf.org_id, runId);

      if (stepResult.status === "paused") {
        await graphqlAdmin(
          `mutation PauseStepRun($stepRunId: uuid!, $runId: uuid!) {
            update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "paused" }) { id }
            update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "paused" }) { id }
          }`,
          { stepRunId, runId }
        );
        isPaused = true;
        break;
      } else if (stepResult.status === "failed") {
        failureError = stepResult.error || "Step failed";
        await graphqlAdmin(
          `mutation FailStepRun($stepRunId: uuid!, $runId: uuid!, $error: String!) {
            update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "failed", error: $error, completed_at: "now()" }) { id }
            update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "failed", error: $error, completed_at: "now()" }) { id }
          }`,
          { stepRunId, runId, error: failureError }
        );
        executionFailed = true;
        break;
      } else {
        await graphqlAdmin(
          `mutation CompleteStepRun($stepRunId: uuid!, $output: jsonb) {
            update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
          }`,
          { stepRunId, output: stepResult.output }
        );
        prevOutput = stepResult.output;
      }
    }

    // Complete workflow run if finished without pausing or failing
    if (!isPaused && !executionFailed) {
      await graphqlAdmin(
        `mutation CompleteWorkflowRun($runId: uuid!, $output: jsonb, $orgId: uuid!) {
          update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
          update_organizations_by_pk(pk_columns: { id: $orgId }, _inc: { quota_used: 1 }) { id }
        }`,
        { runId, output: prevOutput, orgId: wf.org_id }
      );
    }

    return res.json({
      run_id: runId,
      status: isPaused ? "paused" : executionFailed ? "failed" : "completed",
    });
  } catch (err: any) {
    console.error("[triggerWorkflowRun] Error:", err.message || err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

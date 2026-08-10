import { Request, Response } from "express";
import { graphqlAdmin } from "../_shared/graphqlAdmin";
import { executeStep, WorkflowStep } from "../_shared/executor";

export default async function handleApproveStep(req: Request, res: Response) {
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

    const { step_run_id } = req.body?.input || req.body || {};
    if (!step_run_id) {
      return res.status(400).json({ message: "Bad Request: step_run_id is required." });
    }

    // ---------------------------------------------------------------
    // Layer 1 Authorization: Verify org membership & step run state
    // ---------------------------------------------------------------
    const stepRunRes = await graphqlAdmin<{
      step_runs_by_pk: {
        id: string;
        status: string;
        workflow_run: {
          id: string;
          status: string;
          workflow_id: string;
          org_id: string;
          workflow: {
            organization: {
              members: Array<{ user_id: string; role: string }>;
            };
          };
        };
        workflow_step: {
          position: number;
          type: string;
          config: any;
        };
      } | null;
    }>(
      `query GetStepRunDetails($stepRunId: uuid!, $userId: uuid!) {
        step_runs_by_pk(id: $stepRunId) {
          id
          status
          workflow_run {
            id
            status
            workflow_id
            org_id
            workflow {
              organization {
                members(where: { user_id: { _eq: $userId } }) {
                  role
                }
              }
            }
          }
          workflow_step {
            position
            type
            config
          }
        }
      }`,
      { stepRunId: step_run_id, userId }
    );

    const sr = stepRunRes?.step_runs_by_pk;
    if (!sr || !sr.workflow_run || !sr.workflow_run.workflow?.organization?.members?.length) {
      return res.status(403).json({ message: "Forbidden: Step run not found or access denied." });
    }

    const userRole = sr.workflow_run.workflow.organization.members[0].role;
    const stepPosition = sr.workflow_step.position;
    const stepType = sr.workflow_step.type;
    const stepConfig = sr.workflow_step.config || {};
    const runId = sr.workflow_run.id;
    const workflowId = sr.workflow_run.workflow_id;
    const orgId = sr.workflow_run.org_id;

    if (stepType !== "approval_gate") {
      return res.status(400).json({ message: `Bad Request: Step is not an approval_gate (type: ${stepType}).` });
    }

    if (sr.status !== "paused") {
      return res.status(400).json({ message: `Bad Request: Step is not in paused state (current: ${sr.status}).` });
    }

    const requiredRole: string = stepConfig?.required_role || "owner";

    if (userRole === "viewer") {
      return res.status(403).json({ message: "Forbidden: Viewers cannot approve workflow steps." });
    }

    if (requiredRole === "owner" && userRole !== "owner") {
      return res.status(403).json({
        message: `Forbidden: This approval gate requires the 'owner' role. Caller has role '${userRole}'.`,
      });
    }

    // Mark step_run completed & workflow_run running
    await graphqlAdmin(
      `mutation ApproveStepGate($stepRunId: uuid!, $runId: uuid!, $userId: uuid!) {
        update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "completed", approved_by: $userId, completed_at: "now()" }) { id }
        update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "running" }) { id }
      }`,
      { stepRunId: step_run_id, runId, userId }
    );

    // Resume execution of remaining steps
    const remainingRes = await graphqlAdmin<{
      workflow_steps: WorkflowStep[];
    }>(
      `query GetRemainingSteps($workflowId: uuid!, $position: Int!) {
        workflow_steps(where: { workflow_id: { _eq: $workflowId }, position: { _gt: $position } }, order_by: { position: asc }) {
          id
          workflow_id
          position
          name
          type
          config
        }
      }`,
      { workflowId, position: stepPosition }
    );

    const remainingSteps = remainingRes.workflow_steps || [];
    let prevOutput: any = { status: "approved", approvedBy: userId };
    let pausedAgain = false;
    let executionFailed = false;

    for (const step of remainingSteps) {
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
      const newStepRunId = stepRunRes.insert_step_runs_one.id;

      const context = { previousOutput: prevOutput, stepConfig: step.config };
      const stepResult = await executeStep(step, context, undefined, orgId, runId);

      if (stepResult.status === "paused") {
        await graphqlAdmin(
          `mutation PauseStepRun($stepRunId: uuid!, $runId: uuid!) {
            update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "paused" }) { id }
            update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "paused" }) { id }
          }`,
          { stepRunId: newStepRunId, runId }
        );
        pausedAgain = true;
        break;
      } else if (stepResult.status === "failed") {
        await graphqlAdmin(
          `mutation FailStepRun($stepRunId: uuid!, $runId: uuid!, $error: String!) {
            update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "failed", error: $error, completed_at: "now()" }) { id }
            update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "failed", error: $error, completed_at: "now()" }) { id }
          }`,
          { stepRunId: newStepRunId, runId, error: stepResult.error || "Step failed" }
        );
        executionFailed = true;
        break;
      } else {
        await graphqlAdmin(
          `mutation CompleteStepRun($stepRunId: uuid!, $output: jsonb) {
            update_step_runs_by_pk(pk_columns: { id: $stepRunId }, _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
          }`,
          { stepRunId: newStepRunId, output: stepResult.output }
        );
        prevOutput = stepResult.output;
      }
    }

    if (!pausedAgain && !executionFailed) {
      await graphqlAdmin(
        `mutation CompleteWorkflowRun($runId: uuid!, $output: jsonb, $orgId: uuid!) {
          update_workflow_runs_by_pk(pk_columns: { id: $runId }, _set: { status: "completed", output: $output, completed_at: "now()" }) { id }
          update_organizations_by_pk(pk_columns: { id: $orgId }, _inc: { quota_used: 1 }) { id }
        }`,
        { runId, output: prevOutput, orgId }
      );
    }

    return res.json({
      success: true,
      status: pausedAgain ? "paused" : executionFailed ? "failed" : "completed",
    });
  } catch (err: any) {
    console.error("[approveStep] Error:", err.message || err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

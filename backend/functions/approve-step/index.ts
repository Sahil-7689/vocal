import { Request, Response } from "express";
import { Pool } from "pg";
import { executeStep, WorkflowStep } from "../_shared/executor";
import { incrementOrgQuota } from "../_shared/workflowEngine";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vocalflow",
});

export default async function handleApproveStep(req: Request, res: Response) {
  // Enforce CORS Headers for all client origins
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-hasura-user-id, x-hasura-role, X-Webhook-Secret");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);

  // ---------------------------------------------------------------
  // Layer 1: Extract authenticated user identity
  // Must come from X-Hasura-User-Id header set by Hasura from JWT.
  // Never trust user_id, org_id, or role from the request body.
  // ---------------------------------------------------------------
  const userId = (
    req.headers["x-hasura-user-id"] ||
    req.body?.session_variables?.["x-hasura-user-id"]
  ) as string;

  if (!userId || userId === "anonymous") {
    return res.status(401).json({ message: "Unauthorized: Missing authenticated user identity." });
  }

  const { step_run_id } = req.body?.input || {};
  if (!step_run_id) {
    return res.status(400).json({ message: "Bad Request: step_run_id is required." });
  }

  const client = await pool.connect();

  try {
    // ---------------------------------------------------------------
    // Layer 1 Authorization: Verify org membership via JOIN
    // ---------------------------------------------------------------
    const queryRes = await client.query(
      `SELECT
          sr.id            AS step_run_id,
          sr.status        AS step_run_status,
          wr.id            AS run_id,
          wr.status        AS run_status,
          ws.position      AS step_position,
          ws.type          AS step_type,
          ws.config        AS step_config,
          w.id             AS workflow_id,
          w.org_id,
          m.role           AS user_role
       FROM public.step_runs sr
       JOIN public.workflow_runs wr  ON wr.id  = sr.workflow_run_id
       JOIN public.workflow_steps ws ON ws.id  = sr.workflow_step_id
       JOIN public.workflows w       ON w.id   = wr.workflow_id
       JOIN public.org_members m     ON m.org_id = w.org_id AND m.user_id = $2
       WHERE sr.id = $1`,
      [step_run_id, userId]
    );

    if (queryRes.rows.length === 0) {
      return res.status(403).json({
        message: "Forbidden: Step run not found or access denied.",
      });
    }

    const {
      run_id:           runId,
      step_run_status:  stepRunStatus,
      step_position:    stepPosition,
      step_type:        stepType,
      step_config:      stepConfig,
      workflow_id:      workflowId,
      org_id:           orgId,
      user_role:        userRole,
    } = queryRes.rows[0];

    // State Validation
    if (stepType !== "approval_gate") {
      return res.status(400).json({
        message: `Bad Request: Step is not an approval_gate (type: ${stepType}).`,
      });
    }

    if (stepRunStatus !== "paused") {
      return res.status(400).json({
        message: `Bad Request: Step is not in paused state (current: ${stepRunStatus}).`,
      });
    }

    // ---------------------------------------------------------------
    // Layer 2: Runtime Approver Role Check against step config
    // ---------------------------------------------------------------
    const requiredRole: string = stepConfig?.required_role || "owner";

    if (userRole === "viewer") {
      return res.status(403).json({
        message: "Forbidden: Viewers cannot approve workflow steps.",
      });
    }

    if (requiredRole === "owner" && userRole !== "owner") {
      return res.status(403).json({
        message: `Forbidden: This approval gate requires the 'owner' role. Caller has role '${userRole}'.`,
      });
    }

    // ---------------------------------------------------------------
    // Mark approval_gate step_run as completed with approval audit fields
    // ---------------------------------------------------------------
    await client.query(
      `UPDATE public.step_runs
       SET status       = 'completed',
           approved_by  = $1,
           approved_at  = now(),
           completed_at = now()
       WHERE id = $2`,
      [userId, step_run_id]
    );

    await client.query(
      `UPDATE public.workflow_runs SET status = 'running' WHERE id = $1`,
      [runId]
    );

    // ---------------------------------------------------------------
    // Resume execution of remaining steps AFTER approval gate (position > stepPosition)
    // ---------------------------------------------------------------
    const remainingStepsRes = await client.query(
      `SELECT id, workflow_id, position, name, type, config
       FROM public.workflow_steps
       WHERE workflow_id = $1 AND position > $2
       ORDER BY position ASC`,
      [workflowId, stepPosition]
    );

    const remainingSteps: WorkflowStep[] = remainingStepsRes.rows;
    let prevOutput: any = { status: "approved", approvedBy: userId };
    let pausedAgain = false;
    let executionFailed = false;

    for (const step of remainingSteps) {
      const stepRunRes = await client.query(
        `INSERT INTO public.step_runs
           (workflow_run_id, workflow_step_id, status, input, attempt_count, started_at)
         VALUES ($1, $2, 'running', $3, 1, now())
         RETURNING id`,
        [runId, step.id, JSON.stringify(prevOutput)]
      );
      const newStepRunId = stepRunRes.rows[0].id;

      const context = { previousOutput: prevOutput, stepConfig: step.config };
      const stepResult = await executeStep(step, context, client, orgId, runId);

      if (stepResult.status === "paused") {
        await client.query(`UPDATE public.step_runs SET status = 'paused' WHERE id = $1`, [newStepRunId]);
        await client.query(`UPDATE public.workflow_runs SET status = 'paused' WHERE id = $1`, [runId]);
        pausedAgain = true;
        break;
      } else if (stepResult.status === "failed") {
        await client.query(
          `UPDATE public.step_runs SET status = 'failed', error = $1, attempt_count = $2, completed_at = now() WHERE id = $3`,
          [stepResult.error, stepResult.attempts, newStepRunId]
        );
        await client.query(
          `UPDATE public.workflow_runs SET status = 'failed', error = $1, completed_at = now() WHERE id = $2`,
          [stepResult.error, runId]
        );
        executionFailed = true;
        break;
      } else {
        await client.query(
          `UPDATE public.step_runs SET status = 'completed', output = $1, attempt_count = $2, completed_at = now() WHERE id = $3`,
          [JSON.stringify(stepResult.output), stepResult.attempts, newStepRunId]
        );
        prevOutput = stepResult.output;
      }
    }

    // Mark workflow completed if finished without pausing or failing
    if (!pausedAgain && !executionFailed) {
      await client.query(
        `UPDATE public.workflow_runs SET status = 'completed', output = $1, completed_at = now() WHERE id = $2`,
        [JSON.stringify(prevOutput), runId]
      );
      await incrementOrgQuota(client, orgId);
    }

    return res.json({
      success: true,
      status: pausedAgain ? "paused" : executionFailed ? "failed" : "completed",
    });
  } catch (err: any) {
    console.error("[approveStep] Error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  } finally {
    client.release();
  }
}

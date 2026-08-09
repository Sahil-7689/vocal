import { Request, Response } from "express";
import { Pool } from "pg";
import { executeStep, WorkflowStep } from "../_shared/executor";
import { reserveOrgQuota } from "../_shared/workflowEngine";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vocalflow",
});

export default async function handleTriggerWorkflowRun(req: Request, res: Response) {
  // ---------------------------------------------------------------
  // Layer 1: Extract authenticated user identity from Hasura header.
  // Injected by Hasura from Nhost JWT — cannot be forged by client.
  // ---------------------------------------------------------------
  const userId = (
    req.headers["x-hasura-user-id"] ||
    req.body?.session_variables?.["x-hasura-user-id"]
  ) as string;

  if (!userId || userId === "anonymous") {
    return res.status(401).json({ message: "Unauthorized: Missing authenticated user identity." });
  }

  const { workflow_id, input } = req.body?.input || {};
  if (!workflow_id) {
    return res.status(400).json({ message: "Bad Request: workflow_id is required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ---------------------------------------------------------------
    // Layer 1 Authorization: Verify Org Membership & Role
    // ---------------------------------------------------------------
    const wfRes = await client.query(
      `SELECT w.id, w.org_id, w.name, m.role AS user_role
       FROM public.workflows w
       JOIN public.org_members m ON m.org_id = w.org_id AND m.user_id = $2
       WHERE w.id = $1`,
      [workflow_id, userId]
    );

    if (wfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Forbidden: Workflow not found or access denied.",
      });
    }

    const { org_id: orgId, name: wfName, user_role: userRole } = wfRes.rows[0];

    // Viewer role is denied workflow execution
    if (userRole === "viewer") {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Forbidden: Viewers do not have permission to trigger workflow runs.",
      });
    }

    // Atomic Quota Check (Row locking FOR UPDATE)
    await reserveOrgQuota(client, orgId);

    // Create workflow_runs record
    const runRes = await client.query(
      `INSERT INTO public.workflow_runs (workflow_id, org_id, trigger_type, status, input, triggered_by, started_at)
       VALUES ($1, $2, 'manual', 'running', $3, $4, now())
       RETURNING id, status, started_at`,
      [workflow_id, orgId, JSON.stringify(input || {}), userId]
    );

    const runId = runRes.rows[0].id;
    await client.query("COMMIT");

    // Load steps ordered by position ASC
    const stepsRes = await pool.query(
      `SELECT id, workflow_id, position, name, type, config
       FROM public.workflow_steps
       WHERE workflow_id = $1
       ORDER BY position ASC`,
      [workflow_id]
    );

    const steps: WorkflowStep[] = stepsRes.rows;
    let prevOutput: any = input || { text: "Workflow triggered.", triggeredBy: userId };
    let isPaused = false;
    let executionFailed = false;

    // Sequential Step Execution Engine
    for (const step of steps) {
      const stepRunRes = await pool.query(
        `INSERT INTO public.step_runs
           (workflow_run_id, workflow_step_id, status, input, attempt_count, started_at)
         VALUES ($1, $2, 'running', $3, 1, now())
         RETURNING id`,
        [runId, step.id, JSON.stringify(prevOutput)]
      );
      const stepRunId = stepRunRes.rows[0].id;

      // Dispatch step execution to modular handlers (with retry logic)
      const context = { input, previousOutput: prevOutput, stepConfig: step.config };
      const stepResult = await executeStep(step, context, client, orgId, runId);

      if (stepResult.status === "paused") {
        await pool.query(
          `UPDATE public.step_runs SET status = 'paused' WHERE id = $1`,
          [stepRunId]
        );
        await pool.query(
          `UPDATE public.workflow_runs SET status = 'paused' WHERE id = $1`,
          [runId]
        );
        isPaused = true;
        break; // Pause execution loop
      } else if (stepResult.status === "failed") {
        await pool.query(
          `UPDATE public.step_runs
           SET status = 'failed', error = $1, attempt_count = $2, completed_at = now()
           WHERE id = $3`,
          [stepResult.error, stepResult.attempts, stepRunId]
        );
        await pool.query(
          `UPDATE public.workflow_runs
           SET status = 'failed', error = $1, completed_at = now()
           WHERE id = $2`,
          [stepResult.error, runId]
        );
        executionFailed = true;
        break; // Halt execution loop on failure
      } else {
        // Step completed successfully
        await pool.query(
          `UPDATE public.step_runs
           SET status = 'completed', output = $1, attempt_count = $2, completed_at = now()
           WHERE id = $3`,
          [JSON.stringify(stepResult.output), stepResult.attempts, stepRunId]
        );
        prevOutput = stepResult.output;
      }
    }

    // Complete workflow run if finished without pausing or failing
    if (!isPaused && !executionFailed) {
      await pool.query(
        `UPDATE public.workflow_runs
         SET status = 'completed', output = $1, completed_at = now()
         WHERE id = $2`,
        [JSON.stringify(prevOutput), runId]
      );
    }

    return res.json({
      run_id: runId,
      status: isPaused ? "paused" : executionFailed ? "failed" : "completed",
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[triggerWorkflowRun] Error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  } finally {
    client.release();
  }
}

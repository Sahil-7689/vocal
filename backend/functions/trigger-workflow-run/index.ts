import { Request, Response } from "express";
import { Pool } from "pg";
import {
  reserveOrgQuota,
  incrementOrgQuota,
  executeLLMCall,
  executeHttpRequest,
  executeConditional,
  executeDbWrite,
  executeNotify,
  WorkflowStep,
} from "../_shared/workflowEngine";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vocalflow",
});

export default async function handleTriggerWorkflowRun(req: Request, res: Response) {
  // ---------------------------------------------------------------
  // Layer 1: Extract authenticated user identity from Hasura header.
  // This header is injected by Hasura from the Nhost JWT — the
  // client CANNOT forge it. Never read user_id from req.body.
  // ---------------------------------------------------------------
  const userId = (
    req.headers["x-hasura-user-id"] ||
    req.body?.session_variables?.["x-hasura-user-id"]
  ) as string;

  if (!userId || userId === "anonymous") {
    return res.status(401).json({ message: "Unauthorized: Missing authenticated user identity." });
  }

  const { workflow_id } = req.body?.input || {};
  if (!workflow_id) {
    return res.status(400).json({ message: "Bad Request: workflow_id is required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ---------------------------------------------------------------
    // Layer 1: Org membership verification
    // JOIN through org_members guarantees:
    //   - The caller is a member of the org that owns this workflow
    //   - An Org B user can never trigger an Org A workflow
    //   - The caller's role is loaded from the database, not the client
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
      // Return 403 regardless of whether the workflow exists —
      // do not reveal whether the workflow ID is valid to unauthorized callers.
      return res.status(403).json({
        message: "Forbidden: Workflow not found or you do not have access.",
      });
    }

    const { org_id: orgId, name: wfName, user_role: userRole } = wfRes.rows[0];

    // ---------------------------------------------------------------
    // Layer 2: Role-level trigger authorization
    // viewer — read-only, cannot trigger runs under any circumstances
    // editor — can trigger
    // owner  — can trigger
    // ---------------------------------------------------------------
    if (userRole === "viewer") {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "Forbidden: Viewers do not have permission to trigger workflow runs.",
      });
    }

    // ---------------------------------------------------------------
    // Atomic quota reservation with row locking (FOR UPDATE)
    // Prevents race conditions when multiple editors trigger simultaneously
    // ---------------------------------------------------------------
    await reserveOrgQuota(client, orgId);

    // Create the workflow run record
    const runRes = await client.query(
      `INSERT INTO public.workflow_runs (workflow_id, status, triggered_by, started_at)
       VALUES ($1, 'running', $2, now())
       RETURNING id, status, started_at`,
      [workflow_id, userId]
    );

    const runId = runRes.rows[0].id;
    await client.query("COMMIT");

    // ---------------------------------------------------------------
    // Load ordered steps and execute sequentially
    // ---------------------------------------------------------------
    const stepsRes = await pool.query(
      `SELECT id, workflow_id, position, name, type, config
       FROM public.workflow_steps
       WHERE workflow_id = $1
       ORDER BY position ASC`,
      [workflow_id]
    );

    const steps: WorkflowStep[] = stepsRes.rows;
    let prevOutput: any = { text: "Workflow triggered.", triggeredBy: userId };
    let isPaused = false;
    let executionFailed = false;

    for (const step of steps) {
      const stepRunRes = await pool.query(
        `INSERT INTO public.step_runs
           (workflow_run_id, workflow_step_id, status, input, attempt_count, started_at)
         VALUES ($1, $2, 'running', $3, 1, now())
         RETURNING id`,
        [runId, step.id, JSON.stringify(prevOutput)]
      );
      const stepRunId = stepRunRes.rows[0].id;

      try {
        let output: any = null;

        if (step.type === "llm_call") {
          output = await executeLLMCall(step.config, { input: prevOutput });
        } else if (step.type === "http_request") {
          output = await executeHttpRequest(step.config, { input: prevOutput });
        } else if (step.type === "conditional_branch") {
          output = await executeConditional(step.config, prevOutput);
        } else if (step.type === "approval_gate") {
          // Pause here — execution will resume via approveStep Action
          await pool.query(
            `UPDATE public.step_runs SET status = 'paused' WHERE id = $1`,
            [stepRunId]
          );
          await pool.query(
            `UPDATE public.workflow_runs SET status = 'paused' WHERE id = $1`,
            [runId]
          );
          isPaused = true;
          break;
        } else if (step.type === "db_write") {
          // db_write: restricted step — only reachable because Layer 1 Hasura
          // permissions already blocked editors from adding this step type.
          // The execution handler has no additional role check here because
          // the restriction was already enforced at step creation time.
          const dbClient = await pool.connect();
          try {
            output = await executeDbWrite(dbClient, orgId, runId, step.config);
          } finally {
            dbClient.release();
          }
        } else if (step.type === "notify") {
          output = await executeNotify(step.config, { input: prevOutput });
        }

        await pool.query(
          `UPDATE public.step_runs
           SET status = 'completed', output = $1, completed_at = now()
           WHERE id = $2`,
          [JSON.stringify(output), stepRunId]
        );

        prevOutput = output;
      } catch (stepErr: any) {
        await pool.query(
          `UPDATE public.step_runs
           SET status = 'failed', error = $1, completed_at = now()
           WHERE id = $2`,
          [stepErr.message, stepRunId]
        );
        await pool.query(
          `UPDATE public.workflow_runs
           SET status = 'failed', error = $1, completed_at = now()
           WHERE id = $2`,
          [stepErr.message, runId]
        );
        executionFailed = true;
        break;
      }
    }

    // Mark completed and increment quota if run finished without pausing/failing
    if (!isPaused && !executionFailed) {
      const finalCheck = await pool.query(
        `SELECT status FROM public.workflow_runs WHERE id = $1`,
        [runId]
      );
      if (finalCheck.rows[0]?.status === "running") {
        await pool.query(
          `UPDATE public.workflow_runs SET status = 'completed', completed_at = now() WHERE id = $1`,
          [runId]
        );
        const qClient = await pool.connect();
        try {
          await incrementOrgQuota(qClient, orgId);
        } finally {
          qClient.release();
        }
      }
    }

    return res.json({
      run_id: runId,
      status: isPaused ? "paused" : executionFailed ? "failed" : "completed",
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[triggerWorkflowRun] Unexpected error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  } finally {
    client.release();
  }
}

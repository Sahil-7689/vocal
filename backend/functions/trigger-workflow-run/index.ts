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
  const userId = req.headers["x-hasura-user-id"] as string;
  const { workflow_id } = req.body.input || {};

  if (!userId) {
    return res.status(403).json({ message: "Unauthorized: Missing authenticated user header." });
  }

  if (!workflow_id) {
    return res.status(400).json({ message: "Bad Request: Missing workflow_id." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Load workflow & verify organization membership + role (Layer 1 + Layer 2 Security)
    const wfRes = await client.query(
      `SELECT w.id, w.org_id, w.name, m.role
       FROM public.workflows w
       JOIN public.org_members m ON m.org_id = w.org_id
       WHERE w.id = $1 AND m.user_id = $2`,
      [workflow_id, userId]
    );

    if (wfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Unauthorized: You don't have permission to access this workflow." });
    }

    const { org_id: orgId, name: wfName, role: userRole } = wfRes.rows[0];

    if (userRole === "viewer") {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Unauthorized: Viewers are not permitted to trigger workflow runs." });
    }

    // Atomic Quota Reservation with Row Locking
    await reserveOrgQuota(client, orgId);

    // Insert Workflow Run
    const runRes = await client.query(
      `INSERT INTO public.workflow_runs (workflow_id, status, triggered_by, started_at)
       VALUES ($1, 'running', $2, now())
       RETURNING id, status, started_at`,
      [workflow_id, userId]
    );

    const runId = runRes.rows[0].id;
    await client.query("COMMIT");

    // Load Steps ordered by position ASC
    const stepsRes = await pool.query(
      `SELECT id, workflow_id, position, name, type, config
       FROM public.workflow_steps
       WHERE workflow_id = $1
       ORDER BY position ASC`,
      [workflow_id]
    );

    const steps: WorkflowStep[] = stepsRes.rows;
    let prevOutput: any = { text: "Workflow run initiated." };
    let isPaused = false;

    for (const step of steps) {
      const stepRunRes = await pool.query(
        `INSERT INTO public.step_runs (workflow_run_id, workflow_step_id, status, input, attempt_count, started_at)
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
          // Pause execution for approval gate!
          await pool.query(
            `UPDATE public.step_runs SET status = 'paused' WHERE id = $1`,
            [stepRunId]
          );
          await pool.query(
            `UPDATE public.workflow_runs SET status = 'paused' WHERE id = $1`,
            [runId]
          );
          isPaused = true;
          break; // Exit execution loop
        } else if (step.type === "db_write") {
          const dbClient = await pool.connect();
          try {
            output = await executeDbWrite(dbClient, orgId, runId, step.config);
          } finally {
            dbClient.release();
          }
        } else if (step.type === "notify") {
          output = await executeNotify(step.config, { input: prevOutput });
        }

        // Mark step completed
        await pool.query(
          `UPDATE public.step_runs
           SET status = 'completed', output = $1, completed_at = now()
           WHERE id = $2`,
          [JSON.stringify(output), stepRunId]
        );

        prevOutput = output;
      } catch (stepErr: any) {
        // Step failed after retries
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
        break;
      }
    }

    // Check if workflow fully completed
    if (!isPaused) {
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
      status: isPaused ? "paused" : "running",
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: err.message || "Failed to trigger workflow run." });
  } finally {
    client.release();
  }
}

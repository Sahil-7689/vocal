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

export default async function handleWebhookTrigger(req: Request, res: Response) {
  const { workflow_id } = req.params;
  const providedSecret = (req.headers["x-webhook-secret"] as string) || (req.query.secret as string) || req.body?.secret;

  if (!workflow_id) {
    return res.status(400).json({ message: "Bad Request: Missing workflow_id." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Load workflow & webhook trigger config
    const wfRes = await client.query(
      `SELECT w.id, w.org_id, w.name, w.status AS wf_status,
              t.config AS trigger_config, t.enabled AS trigger_enabled
       FROM public.workflows w
       JOIN public.workflow_triggers t ON t.workflow_id = w.id
       WHERE w.id = $1 AND t.type = 'webhook'`,
      [workflow_id]
    );

    if (wfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Workflow or webhook trigger not found." });
    }

    const { org_id: orgId, name: wfName, wf_status: wfStatus, trigger_config: triggerConfig, trigger_enabled: triggerEnabled } = wfRes.rows[0];

    if (wfStatus !== "active" || !triggerEnabled) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Workflow or trigger is currently disabled." });
    }

    // Secret Verification
    const expectedSecret = triggerConfig?.secret || process.env.WEBHOOK_SECRET;
    if (expectedSecret && providedSecret !== expectedSecret) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Unauthorized: Invalid webhook secret." });
    }

    // Reserve Quota
    await reserveOrgQuota(client, orgId);

    // Create Run
    const runRes = await client.query(
      `INSERT INTO public.workflow_runs (workflow_id, status, triggered_by, started_at)
       VALUES ($1, 'running', 'Webhook Trigger', now())
       RETURNING id`,
      [workflow_id]
    );

    const runId = runRes.rows[0].id;
    await client.query("COMMIT");

    // Execute steps asynchronously
    const stepsRes = await pool.query(
      `SELECT id, workflow_id, position, name, type, config
       FROM public.workflow_steps
       WHERE workflow_id = $1
       ORDER BY position ASC`,
      [workflow_id]
    );

    const steps: WorkflowStep[] = stepsRes.rows;
    let prevOutput: any = { payload: req.body || {} };
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
          await pool.query(`UPDATE public.step_runs SET status = 'paused' WHERE id = $1`, [stepRunId]);
          await pool.query(`UPDATE public.workflow_runs SET status = 'paused' WHERE id = $1`, [runId]);
          isPaused = true;
          break;
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

        await pool.query(
          `UPDATE public.step_runs SET status = 'completed', output = $1, completed_at = now() WHERE id = $2`,
          [JSON.stringify(output), stepRunId]
        );

        prevOutput = output;
      } catch (err: any) {
        await pool.query(
          `UPDATE public.step_runs SET status = 'failed', error = $1, completed_at = now() WHERE id = $2`,
          [err.message, stepRunId]
        );
        await pool.query(
          `UPDATE public.workflow_runs SET status = 'failed', error = $1, completed_at = now() WHERE id = $2`,
          [err.message, runId]
        );
        break;
      }
    }

    if (!isPaused) {
      const finalCheck = await pool.query(`SELECT status FROM public.workflow_runs WHERE id = $1`, [runId]);
      if (finalCheck.rows[0]?.status === "running") {
        await pool.query(`UPDATE public.workflow_runs SET status = 'completed', completed_at = now() WHERE id = $1`, [runId]);
        const qClient = await pool.connect();
        try {
          await incrementOrgQuota(qClient, orgId);
        } finally {
          qClient.release();
        }
      }
    }

    return res.status(200).json({
      run_id: runId,
      status: isPaused ? "paused" : "running",
      message: "Webhook workflow run triggered successfully.",
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    return res.status(500).json({ message: err.message || "Failed to process webhook trigger." });
  } finally {
    client.release();
  }
}

import { Request, Response } from "express";
import { Pool } from "pg";
import { executeStep, WorkflowStep } from "../_shared/executor";
import { reserveOrgQuota } from "../_shared/workflowEngine";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vocalflow",
});

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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Resolve workflow & webhook trigger configuration
    const wfRes = await client.query(
      `SELECT w.id, w.org_id, w.name, w.status AS wf_status,
              t.config AS trigger_config, t.enabled AS trigger_enabled
       FROM public.workflows w
       LEFT JOIN public.workflow_triggers t ON t.workflow_id = w.id AND t.type = 'webhook'
       WHERE w.id = $1`,
      [workflow_id]
    );

    if (wfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Workflow not found." });
    }

    const {
      org_id: orgId,
      wf_status: wfStatus,
      trigger_config: triggerConfig,
      trigger_enabled: triggerEnabled,
    } = wfRes.rows[0];

    if (!triggerConfig) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Bad Request: No webhook trigger configured for this workflow." });
    }

    if (wfStatus !== "active" || triggerEnabled === false) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Conflict: Webhook trigger is currently disabled." });
    }

    // 2. Webhook Secret Validation
    const expectedSecret = triggerConfig?.secret || process.env.WEBHOOK_SECRET;
    if (!providedSecret || (expectedSecret && providedSecret !== expectedSecret)) {
      await client.query("ROLLBACK");
      return res.status(401).json({ message: "Unauthorized: Invalid or missing webhook secret." });
    }

    // 3. Server-Side Atomic Quota Reservation with Row Lock
    try {
      await reserveOrgQuota(client, orgId);
    } catch (quotaErr: any) {
      await client.query("ROLLBACK");
      return res.status(429).json({
        error: "QUOTA_EXCEEDED",
        message: quotaErr.message || "Quota exhausted: Organization monthly limit reached.",
      });
    }

    // 4. Input Payload Extraction (sanitize out any client attempt to forge auth context)
    const payload = { ...(req.body || {}) };
    delete payload.user_id;
    delete payload.org_id;
    delete payload.role;

    // 5. Create workflow_runs record
    const runRes = await client.query(
      `INSERT INTO public.workflow_runs (workflow_id, org_id, trigger_type, status, input, triggered_by, started_at)
       VALUES ($1, $2, 'webhook', 'running', $3, 'Webhook Trigger', now())
       RETURNING id, status`,
      [workflow_id, orgId, JSON.stringify(payload)]
    );

    const runId = runRes.rows[0].id;
    await client.query("COMMIT");

    // 6. Asynchronously execute workflow steps using modular execution engine
    executeWorkflowStepsAsync(workflow_id, orgId, runId, payload);

    return res.status(200).json({
      success: true,
      workflow_run_id: runId,
      status: "running",
      message: "Webhook workflow run created and started successfully.",
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[handleWebhookTrigger] Error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  } finally {
    client.release();
  }
}

/**
 * Asynchronous Step Execution Routine for Inbound Webhook Runs
 */
async function executeWorkflowStepsAsync(
  workflowId: string,
  orgId: string,
  runId: string,
  initialInput: any
) {
  try {
    const stepsRes = await pool.query(
      `SELECT id, workflow_id, position, name, type, config
       FROM public.workflow_steps
       WHERE workflow_id = $1
       ORDER BY position ASC`,
      [workflowId]
    );

    const steps: WorkflowStep[] = stepsRes.rows;
    let prevOutput: any = initialInput;
    let isPaused = false;
    let executionFailed = false;

    for (const step of steps) {
      const stepRunRes = await pool.query(
        `INSERT INTO public.step_runs (workflow_run_id, workflow_step_id, status, input, attempt_count, started_at)
         VALUES ($1, $2, 'running', $3, 1, now())
         RETURNING id`,
        [runId, step.id, JSON.stringify(prevOutput)]
      );
      const stepRunId = stepRunRes.rows[0].id;

      const dbClient = await pool.connect();
      try {
        const context = { input: initialInput, previousOutput: prevOutput, stepConfig: step.config };
        const stepResult = await executeStep(step, context, dbClient, orgId, runId);

        if (stepResult.status === "paused") {
          await pool.query(`UPDATE public.step_runs SET status = 'paused' WHERE id = $1`, [stepRunId]);
          await pool.query(`UPDATE public.workflow_runs SET status = 'paused' WHERE id = $1`, [runId]);
          isPaused = true;
          break;
        } else if (stepResult.status === "failed") {
          await pool.query(
            `UPDATE public.step_runs SET status = 'failed', error = $1, attempt_count = $2, completed_at = now() WHERE id = $3`,
            [stepResult.error, stepResult.attempts, stepRunId]
          );
          await pool.query(
            `UPDATE public.workflow_runs SET status = 'failed', error = $1, completed_at = now() WHERE id = $2`,
            [stepResult.error, runId]
          );
          executionFailed = true;
          break;
        } else {
          await pool.query(
            `UPDATE public.step_runs SET status = 'completed', output = $1, attempt_count = $2, completed_at = now() WHERE id = $3`,
            [JSON.stringify(stepResult.output), stepResult.attempts, stepRunId]
          );
          prevOutput = stepResult.output;
        }
      } finally {
        dbClient.release();
      }
    }

    if (!isPaused && !executionFailed) {
      await pool.query(
        `UPDATE public.workflow_runs SET status = 'completed', output = $1, completed_at = now() WHERE id = $2`,
        [JSON.stringify(prevOutput), runId]
      );
    }
  } catch (err: any) {
    console.error("[executeWorkflowStepsAsync] Error:", err);
  }
}

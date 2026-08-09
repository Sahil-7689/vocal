import { Request, Response } from "express";
import { Pool } from "pg";
import { executeStep, WorkflowStep } from "../_shared/executor";
import { reserveOrgQuota } from "../_shared/workflowEngine";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vocalflow",
});

// Cache for idempotency keys to prevent duplicate scheduled runs on retries
const processedScheduleKeys = new Set<string>();

/**
 * Validates a standard 5-part cron expression (e.g. "0 9 * * *")
 * Rejects invalid syntax and arbitrary JavaScript / shell code injections.
 */
export function validateCronExpression(cron: string): boolean {
  if (!cron || typeof cron !== "string") return false;
  const cronRegex = /^(\*|([0-5]?\d)(-[0-5]?\d)?(,\s*([0-5]?\d)(-[0-5]?\d)?)*|\*\/[1-5]?\d)\s+(\*|([0-1]?\d|2[0-3])(-([0-1]?\d|2[0-3]))?(,\s*([0-1]?\d|2[0-3])(-([0-1]?\d|2[0-3]))?)*|\*\/[1-2]?\d)\s+(\*|([1-2]?\d|3[0-1])(-([1-2]?\d|3[0-1]))?(,\s*([1-2]?\d|3[0-1])(-([1-2]?\d|3[0-1]))?)*|\*\/[1-3]?\d)\s+(\*|(1[0-2]|0?[1-9])(-(1[0-2]|0?[1-9]))?(,\s*(1[0-2]|0?[1-9])(-(1[0-2]|0?[1-9]))?)*|\*\/[1-9]|1[0-2])\s+(\*|[0-6](-[0-6])?(,\s*[0-6](-[0-6])?)*|\*\/[1-6])$/;
  return cronRegex.test(cron.trim());
}

export default async function handleScheduledTrigger(req: Request, res: Response) {
  const { workflow_id, scheduled_time, cron_override } = req.body || {};

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Query workflow and scheduled trigger
    const queryStr = workflow_id
      ? `SELECT w.id, w.org_id, w.name, w.status AS wf_status,
                t.id AS trigger_id, t.config AS trigger_config, t.enabled AS trigger_enabled
         FROM public.workflows w
         JOIN public.workflow_triggers t ON t.workflow_id = w.id
         WHERE w.id = $1 AND t.type = 'scheduled'`
      : `SELECT w.id, w.org_id, w.name, w.status AS wf_status,
                t.id AS trigger_id, t.config AS trigger_config, t.enabled AS trigger_enabled
         FROM public.workflows w
         JOIN public.workflow_triggers t ON t.workflow_id = w.id
         WHERE w.status = 'active' AND t.type = 'scheduled' AND t.enabled = true`;

    const params = workflow_id ? [workflow_id] : [];
    const wfRes = await client.query(queryStr, params);

    if (wfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No active scheduled workflows found." });
    }

    const executedRuns: string[] = [];

    for (const row of wfRes.rows) {
      const {
        id: wfId,
        org_id: orgId,
        wf_status: wfStatus,
        trigger_id: triggerId,
        trigger_config: triggerConfig,
        trigger_enabled: triggerEnabled,
      } = row;

      if (wfStatus !== "active" || triggerEnabled === false) {
        continue; // Skip disabled
      }

      // Cron validation
      const cronExpr = cron_override || triggerConfig?.cron || "0 9 * * *";
      if (!validateCronExpression(cronExpr)) {
        console.warn(`[ScheduledTrigger] Invalid cron expression '${cronExpr}' for workflow ${wfId}. Skipping.`);
        continue;
      }

      // Idempotency / Duplicate Schedule Protection
      const executionTimestamp = scheduled_time || new Date().toISOString().slice(0, 16); // Minute resolution
      const idempotencyKey = `${wfId}:${triggerId}:${executionTimestamp}`;

      if (processedScheduleKeys.has(idempotencyKey)) {
        console.log(`[ScheduledTrigger] Duplicate schedule execution blocked by idempotency key (${idempotencyKey}).`);
        continue;
      }

      // Server-side Atomic Quota Check & Reservation
      try {
        await reserveOrgQuota(client, orgId);
      } catch (quotaErr: any) {
        console.warn(`[ScheduledTrigger] Quota exceeded for org ${orgId}. Skipping workflow ${wfId}.`);
        continue;
      }

      // Mark idempotency key as processed
      processedScheduleKeys.add(idempotencyKey);

      // Create workflow_runs record
      const scheduledInput = {
        trigger: "scheduled",
        cron: cronExpr,
        timezone: triggerConfig?.timezone || "Asia/Kolkata",
        triggered_at: executionTimestamp,
        ...(triggerConfig?.input || {}),
      };

      const runRes = await client.query(
        `INSERT INTO public.workflow_runs (workflow_id, org_id, trigger_type, status, input, triggered_by, started_at)
         VALUES ($1, $2, 'scheduled', 'running', $3, 'Scheduled Trigger', now())
         RETURNING id`,
        [wfId, orgId, JSON.stringify(scheduledInput)]
      );

      const runId = runRes.rows[0].id;
      executedRuns.push(runId);

      // Async step execution via core execution engine
      executeScheduledRunAsync(wfId, orgId, runId, scheduledInput);
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      executed_runs_count: executedRuns.length,
      run_ids: executedRuns,
      message: "Scheduled trigger processing completed successfully.",
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[handleScheduledTrigger] Error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  } finally {
    client.release();
  }
}

async function executeScheduledRunAsync(workflowId: string, orgId: string, runId: string, input: any) {
  try {
    const stepsRes = await pool.query(
      `SELECT id, workflow_id, position, name, type, config
       FROM public.workflow_steps
       WHERE workflow_id = $1
       ORDER BY position ASC`,
      [workflowId]
    );

    const steps: WorkflowStep[] = stepsRes.rows;
    let prevOutput: any = input;
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
        const context = { input, previousOutput: prevOutput, stepConfig: step.config };
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
    console.error("[executeScheduledRunAsync] Error:", err);
  }
}

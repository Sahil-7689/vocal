import { Request, Response } from "express";
import { Pool } from "pg";
import { executeStep, WorkflowStep } from "../_shared/executor";
import { reserveOrgQuota } from "../_shared/workflowEngine";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vocalflow",
});

export default async function handleDatabaseEventTrigger(req: Request, res: Response) {
  // Extract event payload (supports Hasura Event Trigger structure & direct API trigger)
  const eventData = req.body?.event?.data?.new || req.body?.data || req.body;
  const eventTable = req.body?.table?.name || req.body?.table || "workflow_events";
  const eventOp = req.body?.event?.op || req.body?.operation || "INSERT";

  const eventOrgId = eventData?.org_id;
  const eventType = eventData?.event_type || "INSERT";
  const depth = Number(req.body?.event_depth || 0);

  // 1. Recursion / Infinite Loop Safeguard
  if (eventTable === "workflow_results" || eventTable === "workflow_runs" || eventTable === "step_runs") {
    console.warn(`[DatabaseEventTrigger] Blocked potential recursive loop on system table '${eventTable}'.`);
    return res.status(200).json({ message: "Ignored system table event to prevent recursion." });
  }

  if (depth > 3) {
    console.warn(`[DatabaseEventTrigger] Event depth threshold exceeded (${depth}). Halting event propagation.`);
    return res.status(200).json({ message: "Event depth threshold exceeded. Loop prevented." });
  }

  if (!eventOrgId) {
    return res.status(400).json({ message: "Bad Request: Missing org_id on database event record." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 2. Query matching workflows for this organization
    // Cross-Org Security: ONLY select workflows belonging to the exact SAME org_id as the event!
    const wfRes = await client.query(
      `SELECT w.id, w.org_id, w.name, w.status AS wf_status,
              t.id AS trigger_id, t.config AS trigger_config, t.enabled AS trigger_enabled
       FROM public.workflows w
       JOIN public.workflow_triggers t ON t.workflow_id = w.id
       WHERE w.org_id = $1 AND w.status = 'active' AND t.type = 'database_event' AND t.enabled = true`,
      [eventOrgId]
    );

    if (wfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(200).json({ message: "No matching database event triggers found for this organization." });
    }

    const executedRuns: string[] = [];

    for (const row of wfRes.rows) {
      const { id: wfId, org_id: orgId, trigger_config: triggerConfig } = row;

      // Filter by table/operation/event_type configuration if specified
      if (triggerConfig?.table && triggerConfig.table !== eventTable) continue;
      if (triggerConfig?.operation && triggerConfig.operation !== eventOp) continue;
      if (triggerConfig?.event_type && triggerConfig.event_type !== eventType) continue;

      // Server-side Atomic Quota Check & Reservation
      try {
        await reserveOrgQuota(client, orgId);
      } catch (quotaErr: any) {
        console.warn(`[DatabaseEventTrigger] Quota exceeded for org ${orgId}. Skipping event trigger.`);
        continue;
      }

      // Construct Event Input Context
      const eventInput = {
        trigger: "database_event",
        event: {
          operation: eventOp,
          table: eventTable,
          event_type: eventType,
          data: eventData?.payload || eventData,
        },
      };

      const runRes = await client.query(
        `INSERT INTO public.workflow_runs (workflow_id, org_id, trigger_type, status, input, triggered_by, started_at)
         VALUES ($1, $2, 'database_event', 'running', $3, 'Database Event Trigger', now())
         RETURNING id`,
        [wfId, orgId, JSON.stringify(eventInput)]
      );

      const runId = runRes.rows[0].id;
      executedRuns.push(runId);

      // Async step execution
      executeDbEventRunAsync(wfId, orgId, runId, eventInput, depth + 1);
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      executed_runs_count: executedRuns.length,
      run_ids: executedRuns,
      message: "Database event trigger processing completed successfully.",
    });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[handleDatabaseEventTrigger] Error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  } finally {
    client.release();
  }
}

async function executeDbEventRunAsync(workflowId: string, orgId: string, runId: string, input: any, depth: number) {
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
        const context = { input, previousOutput: prevOutput, stepConfig: step.config, eventDepth: depth };
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
    console.error("[executeDbEventRunAsync] Error:", err);
  }
}

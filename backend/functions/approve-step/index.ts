import { Request, Response } from "express";
import { Pool } from "pg";
import {
  incrementOrgQuota,
  executeDbWrite,
  executeNotify,
  executeLLMCall,
  executeHttpRequest,
  executeConditional,
  WorkflowStep,
} from "../_shared/workflowEngine";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/vocalflow",
});

export default async function handleApproveStep(req: Request, res: Response) {
  const userId = req.headers["x-hasura-user-id"] as string;
  const { step_run_id } = req.body.input || {};

  if (!userId) {
    return res.status(403).json({ message: "Unauthorized: Missing authenticated user header." });
  }

  if (!step_run_id) {
    return res.status(400).json({ message: "Bad Request: Missing step_run_id." });
  }

  const client = await pool.connect();

  try {
    // Load step run, workflow run, workflow step, and org membership (Layer 1 + Layer 2 Verification)
    const queryRes = await client.query(
      `SELECT sr.id AS step_run_id, sr.status AS step_run_status,
              wr.id AS run_id, wr.status AS run_status,
              ws.position AS step_position, ws.type AS step_type, ws.config AS step_config,
              w.id AS workflow_id, w.org_id,
              m.role AS user_role
       FROM public.step_runs sr
       JOIN public.workflow_runs wr ON wr.id = sr.workflow_run_id
       JOIN public.workflow_steps ws ON ws.id = sr.workflow_step_id
       JOIN public.workflows w ON w.id = wr.workflow_id
       JOIN public.org_members m ON m.org_id = w.org_id
       WHERE sr.id = $1 AND m.user_id = $2`,
      [step_run_id, userId]
    );

    if (queryRes.rows.length === 0) {
      return res.status(403).json({ message: "Unauthorized: Access denied or step run unavailable." });
    }

    const {
      run_id: runId,
      step_run_status: stepRunStatus,
      step_position: stepPosition,
      step_type: stepType,
      step_config: stepConfig,
      workflow_id: workflowId,
      org_id: orgId,
      user_role: userRole,
    } = queryRes.rows[0];

    // Verify step is approval_gate and currently paused
    if (stepType !== "approval_gate") {
      return res.status(400).json({ message: "Bad Request: Step is not an approval gate." });
    }

    if (stepRunStatus !== "paused") {
      return res.status(400).json({ message: `Bad Request: Step is not paused (Current status: ${stepRunStatus}).` });
    }

    // Verify required approver role
    const requiredRole = stepConfig.required_role || "owner";
    if (requiredRole === "owner" && userRole !== "owner") {
      return res.status(403).json({ message: "Unauthorized: Only organization owners can approve this step." });
    }

    if (userRole === "viewer") {
      return res.status(403).json({ message: "Unauthorized: Viewers cannot approve workflow steps." });
    }

    // Mark step run as approved & completed
    await client.query(
      `UPDATE public.step_runs
       SET status = 'completed', approved_by = $1, approved_at = now(), completed_at = now()
       WHERE id = $2`,
      [userId, step_run_id]
    );

    // Update workflow run status to running
    await client.query(
      `UPDATE public.workflow_runs SET status = 'running' WHERE id = $1`,
      [runId]
    );

    // Resume execution of remaining steps (position > stepPosition)
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

    for (const step of remainingSteps) {
      const stepRunRes = await client.query(
        `INSERT INTO public.step_runs (workflow_run_id, workflow_step_id, status, input, attempt_count, started_at)
         VALUES ($1, $2, 'running', $3, 1, now())
         RETURNING id`,
        [runId, step.id, JSON.stringify(prevOutput)]
      );
      const newStepRunId = stepRunRes.rows[0].id;

      try {
        let output: any = null;

        if (step.type === "llm_call") {
          output = await executeLLMCall(step.config, { input: prevOutput });
        } else if (step.type === "http_request") {
          output = await executeHttpRequest(step.config, { input: prevOutput });
        } else if (step.type === "conditional_branch") {
          output = await executeConditional(step.config, prevOutput);
        } else if (step.type === "approval_gate") {
          await client.query(`UPDATE public.step_runs SET status = 'paused' WHERE id = $1`, [newStepRunId]);
          await client.query(`UPDATE public.workflow_runs SET status = 'paused' WHERE id = $1`, [runId]);
          pausedAgain = true;
          break;
        } else if (step.type === "db_write") {
          output = await executeDbWrite(client, orgId, runId, step.config);
        } else if (step.type === "notify") {
          output = await executeNotify(step.config, { input: prevOutput });
        }

        await client.query(
          `UPDATE public.step_runs
           SET status = 'completed', output = $1, completed_at = now()
           WHERE id = $2`,
          [JSON.stringify(output), newStepRunId]
        );

        prevOutput = output;
      } catch (err: any) {
        await client.query(
          `UPDATE public.step_runs SET status = 'failed', error = $1, completed_at = now() WHERE id = $2`,
          [err.message, newStepRunId]
        );
        await client.query(
          `UPDATE public.workflow_runs SET status = 'failed', error = $1, completed_at = now() WHERE id = $2`,
          [err.message, runId]
        );
        break;
      }
    }

    // Complete workflow run and update quota
    if (!pausedAgain) {
      const runCheck = await client.query(
        `SELECT status FROM public.workflow_runs WHERE id = $1`,
        [runId]
      );
      if (runCheck.rows[0]?.status === "running") {
        await client.query(
          `UPDATE public.workflow_runs SET status = 'completed', completed_at = now() WHERE id = $1`,
          [runId]
        );
        await incrementOrgQuota(client, orgId);
      }
    }

    return res.json({
      success: true,
      status: pausedAgain ? "paused" : "resumed",
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message || "Failed to approve step." });
  } finally {
    client.release();
  }
}

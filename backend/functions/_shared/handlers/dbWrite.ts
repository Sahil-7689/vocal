import { PoolClient } from "pg";

export interface DBWriteStepConfig {
  key?: string;
  value?: any;
}

export interface DBWriteStepOutput {
  resultId: string;
  key: string;
  writtenAt: string;
}

/**
 * Modular DB Write Step Handler (Phase 4)
 * Writes structured data safely into public.workflow_results table.
 * Does NOT accept or execute raw SQL queries — only controlled result persistence.
 */
export async function handleDbWrite(
  client: PoolClient,
  orgId: string,
  runId: string,
  config: DBWriteStepConfig,
  context: Record<string, any>
): Promise<DBWriteStepOutput> {
  const key = config.key || "workflow_result";
  const val = config.value !== undefined ? config.value : (context.previousOutput || { status: "success" });

  const res = await client.query(
    `INSERT INTO public.workflow_results (org_id, workflow_run_id, key, value)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [orgId, runId, key, JSON.stringify(val)]
  );

  return {
    resultId: res.rows[0].id,
    key,
    writtenAt: res.rows[0].created_at,
  };
}

import { PoolClient } from "pg";
import { graphqlAdmin } from "../graphqlAdmin";

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
 * Modular DB Write Step Handler
 * Writes structured data safely into public.workflow_results table.
 * Supports both pg PoolClient AND Hasura GraphQL Admin fallback.
 */
export async function handleDbWrite(
  client: PoolClient | undefined,
  orgId: string,
  runId: string,
  config: DBWriteStepConfig,
  context: Record<string, any>
): Promise<DBWriteStepOutput> {
  const key = config?.key || "workflow_result";
  const val = config?.value !== undefined ? config.value : (context?.previousOutput || { status: "success" });

  if (client) {
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

  // Fallback to Hasura GraphQL Admin API when pg client is undefined
  const res = await graphqlAdmin<{
    insert_workflow_results_one: { id: string; created_at: string };
  }>(
    `mutation InsertWorkflowResult($orgId: uuid!, $runId: uuid!, $key: String!, $value: jsonb) {
      insert_workflow_results_one(object: {
        org_id: $orgId
        workflow_run_id: $runId
        key: $key
        value: $value
      }) {
        id
        created_at
      }
    }`,
    { orgId, runId, key, value: val }
  );

  return {
    resultId: res.insert_workflow_results_one.id,
    key,
    writtenAt: res.insert_workflow_results_one.created_at,
  };
}

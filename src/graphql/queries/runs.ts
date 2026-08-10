import { gql } from "@apollo/client";

export const GET_RUNS = gql`
  query GetRuns($orgId: uuid!) {
    workflow_runs(where: { org_id: { _eq: $orgId } }, order_by: { created_at: desc }) {
      id
      workflow_id
      org_id
      status
      triggered_by
      started_at
      completed_at
      created_at
      step_runs {
        id
        workflow_run_id
        workflow_step_id
        status
        attempt_count
        created_at
        workflow_step {
          id
          name
          type
          position
        }
      }
    }
  }
`;

export const GET_RUN = gql`
  query GetRun($runId: uuid!) {
    workflow_runs_by_pk(id: $runId) {
      id
      workflow_id
      org_id
      status
      triggered_by
      started_at
      completed_at
      created_at
      workflow {
        id
        name
        steps(order_by: { position: asc }) {
          id
          workflow_id
          position
          name
          type
          config
        }
      }
      step_runs(order_by: { created_at: asc }) {
        id
        workflow_run_id
        workflow_step_id
        status
        input
        output
        error
        attempt_count
        approved_by
        approved_at
        started_at
        completed_at
        created_at
        workflow_step {
          id
          name
          type
          position
        }
      }
    }
  }
`;

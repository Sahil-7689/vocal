import { gql } from "@apollo/client";

export const STEP_RUNS_SUBSCRIPTION = gql`
  subscription StepRunsSubscription($workflowRunId: uuid!) {
    step_runs(
      where: { workflow_run_id: { _eq: $workflowRunId } }
      order_by: { created_at: asc }
    ) {
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
    }
  }
`;

import { gql } from "@apollo/client";

export const STEP_RUNS_SUBSCRIPTION = gql`
  subscription StepRunsSubscription($workflowRunId: String!) {
    step_runs(
      where: { workflow_run_id: { _eq: $workflowRunId } }
      order_by: { created_at: asc }
    ) {
      id
      workflow_run_id
      workflow_step_id
      stepName
      stepType
      status
      input
      output
      error
      attemptCount
      approvedBy
      approvedAt
      durationMs
      createdAt
      updatedAt
    }
  }
`;

import { gql } from "@apollo/client";

export const GET_RUNS = gql`
  query GetRuns($orgId: String!) {
    workflow_runs(where: { organizationId: { _eq: $orgId } }, order_by: { createdAt: desc }) {
      id
      workflowId
      workflowName
      organizationId
      status
      triggeredBy
      startedAt
      completedAt
      createdAt
      stepRuns {
        id
        workflowRunId
        workflowStepId
        stepName
        stepType
        status
        attemptCount
        durationMs
        createdAt
      }
    }
  }
`;

export const GET_RUN = gql`
  query GetRun($runId: String!, $userOrgId: String!) {
    workflow_run_by_pk(id: $runId) {
      id
      workflowId
      workflowName
      organizationId
      status
      triggeredBy
      startedAt
      completedAt
      createdAt
      stepRuns {
        id
        workflowRunId
        workflowStepId
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
  }
`;

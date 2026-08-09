import { gql } from "@apollo/client";

export const TRIGGER_WORKFLOW_RUN = gql`
  mutation TriggerWorkflowRun($workflow_id: String!, $userOrgId: String!, $userName: String!) {
    triggerWorkflowRun(workflow_id: $workflow_id, userOrgId: $userOrgId, userName: $userName) {
      id
    }
  }
`;

export const APPROVE_STEP = gql`
  mutation ApproveStep($step_run_id: String!, $userRole: String!, $userName: String!) {
    approveStep(step_run_id: $step_run_id, userRole: $userRole, userName: $userName) {
      success
    }
  }
`;

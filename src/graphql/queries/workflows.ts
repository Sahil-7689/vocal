import { gql } from "@apollo/client";

export const GET_WORKFLOWS = gql`
  query GetWorkflows($orgId: uuid!) {
    workflows(where: { org_id: { _eq: $orgId } }, order_by: { updated_at: desc }) {
      id
      org_id
      name
      description
      status
      created_at
      updated_at
      created_by
      steps {
        id
        workflow_id
        position
        name
        type
        config
      }
      triggers {
        id
        workflow_id
        type
        config
        enabled
      }
    }
  }
`;

export const GET_WORKFLOW = gql`
  query GetWorkflow($id: uuid!) {
    workflows_by_pk(id: $id) {
      id
      org_id
      name
      description
      status
      created_at
      updated_at
      created_by
      steps(order_by: { position: asc }) {
        id
        workflow_id
        position
        name
        type
        config
      }
      triggers {
        id
        workflow_id
        type
        config
        enabled
      }
    }
  }
`;

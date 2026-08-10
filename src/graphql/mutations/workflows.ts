import { gql } from "@apollo/client";

export const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow($orgId: uuid!, $name: String!, $description: String) {
    insert_workflows_one(
      object: {
        org_id: $orgId
        name: $name
        description: $description
        status: "draft"
      }
    ) {
      id
      org_id
      name
      description
      status
      created_at
      updated_at
    }
  }
`;

export const CREATE_WORKFLOW_HASURA = CREATE_WORKFLOW;

export const UPDATE_WORKFLOW_HASURA = gql`
  mutation UpdateWorkflowHasura($id: uuid!, $name: String, $description: String, $status: String) {
    update_workflows_by_pk(
      pk_columns: { id: $id }
      _set: { name: $name, description: $description, status: $status }
    ) {
      id
      org_id
      name
      description
      status
      updated_at
    }
  }
`;

export const SAVE_WORKFLOW = UPDATE_WORKFLOW_HASURA;

export const DELETE_WORKFLOW = gql`
  mutation DeleteWorkflow($id: uuid!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`;

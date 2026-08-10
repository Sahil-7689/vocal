import { gql } from "@apollo/client";

export const CREATE_WORKFLOW_HASURA = gql`
  mutation CreateWorkflowHasura(
    $org_id: uuid!
    $name: String!
    $description: String
    $status: String!
    $steps: [workflow_steps_insert_input!]!
    $triggers: [workflow_triggers_insert_input!]!
  ) {
    insert_workflows_one(
      object: {
        org_id: $org_id
        name: $name
        description: $description
        status: $status
        steps: { data: $steps }
        triggers: { data: $triggers }
      }
    ) {
      id
      org_id
      name
      description
      status
    }
  }
`;

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

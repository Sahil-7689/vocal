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

export const SAVE_WORKFLOW = gql`
  mutation SaveWorkflow($input: SaveWorkflowInput!) {
    saveWorkflow(input: $input) {
      id
      organizationId
      name
      description
      status
      updatedAt
      steps {
        id
        type
        name
        positionX
        positionY
        config
      }
      triggers {
        id
        type
        config
      }
    }
  }
`;

export const DELETE_WORKFLOW = gql`
  mutation DeleteWorkflow($id: String!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`;

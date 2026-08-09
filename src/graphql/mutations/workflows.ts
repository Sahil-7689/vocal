import { gql } from "@apollo/client";

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

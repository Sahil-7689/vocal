import { gql } from "@apollo/client";

export const GET_WORKFLOWS = gql`
  query GetWorkflows($orgId: String!) {
    workflows(where: { organizationId: { _eq: $orgId } }, order_by: { updatedAt: desc }) {
      id
      organizationId
      name
      description
      status
      createdAt
      updatedAt
      createdBy
      steps {
        id
        workflowId
        type
        name
        positionX
        positionY
        config
        nextStepId
      }
      triggers {
        id
        workflowId
        type
        config
        isRestricted
      }
    }
  }
`;

export const GET_WORKFLOW = gql`
  query GetWorkflow($id: String!, $userOrgId: String!) {
    workflow_by_pk(id: $id) {
      id
      organizationId
      name
      description
      status
      createdAt
      updatedAt
      createdBy
      steps {
        id
        workflowId
        type
        name
        positionX
        positionY
        config
        nextStepId
      }
      triggers {
        id
        workflowId
        type
        config
        isRestricted
      }
    }
  }
`;

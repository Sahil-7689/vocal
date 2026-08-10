import { gql } from "@apollo/client";

export const CREATE_WORKFLOW = gql`
  mutation CreateWorkflow($orgId: uuid!, $name: String!, $description: String) {
    insert_workflows_one(
      object: {
        org_id: $orgId
        name: $name
        description: $description
        status: "draft"
        steps: {
          data: [
            {
              position: 1
              name: "AI Processing Step"
              type: "llm_call"
              config: { provider: "openai", model: "gpt-4o", prompt: "Analyze workflow input data and generate structured output." }
            }
          ]
        }
        triggers: {
          data: [
            {
              type: "manual"
              enabled: true
              config: {}
            }
          ]
        }
      }
    ) {
      id
      org_id
      name
      description
      status
      created_at
      updated_at
      steps {
        id
        name
        type
        position
      }
    }
  }
`;

export const CREATE_WORKFLOW_HASURA = CREATE_WORKFLOW;

export const SAVE_WORKFLOW = gql`
  mutation SaveWorkflow($id: uuid!, $name: String!, $status: String!, $steps: [workflow_steps_insert_input!]!) {
    update_workflows_by_pk(
      pk_columns: { id: $id }
      _set: { name: $name, status: $status }
    ) {
      id
    }
    delete_workflow_steps(where: { workflow_id: { _eq: $id } }) {
      affected_rows
    }
    insert_workflow_steps(objects: $steps) {
      affected_rows
    }
  }
`;

export const UPDATE_WORKFLOW_HASURA = SAVE_WORKFLOW;

export const DELETE_WORKFLOW = gql`
  mutation DeleteWorkflow($id: uuid!) {
    delete_workflows_by_pk(id: $id) {
      id
    }
  }
`;

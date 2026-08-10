import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, split, Observable } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";
import { getAccessToken } from "./auth";
import {
  getMockWorkflows,
  getMockWorkflow,
  saveMockWorkflow,
  deleteMockWorkflow,
  getMockRuns,
  getMockRun,
  triggerMockRun,
  approveMockStepRun,
  subscribeToMockStepRuns,
} from "./mockBackend";

const graphqlUrl = (process.env.NEXT_PUBLIC_GRAPHQL_URL || "").trim();
const nhostSubdomain = (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim();
const nhostRegion = (process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1").trim();

const httpUri =
  graphqlUrl ||
  (nhostSubdomain
    ? `https://${nhostSubdomain}.graphql.${nhostRegion}.nhost.run/v1/graphql`
    : "http://localhost:4000/v1/graphql");

const httpLink = new HttpLink({
  uri: httpUri,
});

const authLink = new ApolloLink((operation, forward) => {
  const token = getAccessToken();
  operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }));
  return forward(operation);
});

// Custom Mock Link to serve workflows seamlessly if local backend is empty or unavailable
const mockApolloLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    const { operationName, variables } = operation;

    setTimeout(() => {
      try {
        if (operationName === "GetWorkflows") {
          const workflows = getMockWorkflows(variables.orgId || "org-acme-a");
          observer.next({ data: { workflows } });
        } else if (operationName === "GetWorkflow") {
          const workflow = getMockWorkflow(variables.id, variables.userOrgId || "org-acme-a");
          if (!workflow) {
            observer.next({ errors: [{ message: "Workflow unavailable: You don't have permission to access this workflow." }] });
          } else {
            observer.next({ data: { workflow_by_pk: workflow } });
          }
        } else if (operationName === "SaveWorkflow") {
          const saved = saveMockWorkflow(variables.input);
          observer.next({ data: { saveWorkflow: saved } });
        } else if (operationName === "DeleteWorkflow") {
          deleteMockWorkflow(variables.id);
          observer.next({ data: { delete_workflows_by_pk: { id: variables.id } } });
        } else if (operationName === "GetRuns") {
          const runs = getMockRuns(variables.orgId || "org-acme-a");
          observer.next({ data: { workflow_runs: runs } });
        } else if (operationName === "GetRun") {
          const run = getMockRun(variables.runId, variables.userOrgId || "org-acme-a");
          if (!run) {
            observer.next({ errors: [{ message: "Workflow run unavailable or access denied." }] });
          } else {
            observer.next({ data: { workflow_run_by_pk: run } });
          }
        } else if (operationName === "TriggerWorkflowRun") {
          const newRun = triggerMockRun(variables.workflow_id, variables.userOrgId, variables.userName);
          observer.next({ data: { triggerWorkflowRun: { id: newRun.id } } });
        } else if (operationName === "ApproveStep") {
          approveMockStepRun(variables.step_run_id, variables.userRole, variables.userName);
          observer.next({ data: { approveStep: { success: true } } });
        } else if (operationName === "StepRunsSubscription") {
          const unsubscribe = subscribeToMockStepRuns(variables.workflowRunId, (stepRuns) => {
            observer.next({ data: { step_runs: stepRuns } });
          });
          return () => unsubscribe();
        } else {
          observer.next({ data: {} });
        }
        observer.complete();
      } catch (err: any) {
        observer.error(err);
      }
    }, 100);
  });
});

// Derive WebSocket URL for Real-Time GraphQL Subscriptions
const wsUri = graphqlUrl
  ? graphqlUrl.replace(/^http/, "ws")
  : nhostSubdomain
  ? `wss://${nhostSubdomain}.graphql.${nhostRegion}.nhost.run/v1/graphql`
  : "";

const wsLink =
  typeof window !== "undefined" && wsUri
    ? new GraphQLWsLink(
        createClient({
          url: wsUri,
          connectionParams: () => {
            const token = getAccessToken();
            return {
              headers: {
                ...(token ? { authorization: `Bearer ${token}` } : {}),
              },
            };
          },
        })
      )
    : null;

const isLiveConfigured = Boolean(graphqlUrl || nhostSubdomain);

const liveLink = wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === "OperationDefinition" &&
          definition.operation === "subscription"
        );
      },
      wsLink,
      authLink.concat(httpLink)
    )
  : authLink.concat(httpLink);

// Hybrid link: Routes live backend when configured, with mock backend fallback for instant creation
const hybridLink = split(
  () => !isLiveConfigured,
  mockApolloLink,
  liveLink
);

export const apolloClient = new ApolloClient({
  link: hybridLink,
  cache: new InMemoryCache(),
});

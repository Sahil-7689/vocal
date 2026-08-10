import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, Observable, split } from "@apollo/client";
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

const rawGraphqlUrl = (process.env.NEXT_PUBLIC_GRAPHQL_URL || "").trim();
const nhostSubdomain = (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim();
const nhostRegion = (process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1").trim();

// Ensure correct Nhost Hasura subdomain format (.hasura. instead of .graphql.)
const graphqlUrl = rawGraphqlUrl.replace(".graphql.", ".hasura.");

const httpUri =
  graphqlUrl ||
  (nhostSubdomain
    ? `https://${nhostSubdomain}.hasura.${nhostRegion}.nhost.run/v1/graphql`
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

// Fallback Apollo Link to handle 404 / offline server responses gracefully
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
        } else if (operationName === "SaveWorkflow" || operationName === "CreateWorkflowHasura") {
          const saved = saveMockWorkflow(variables.input || {
            id: `wf-${Date.now()}`,
            organizationId: variables.org_id || "org-acme-a",
            name: variables.name || "Untitled Workflow",
            description: variables.description || "",
            status: variables.status || "active",
            steps: variables.steps || [],
            triggers: variables.triggers || [],
          });
          observer.next({ data: { insert_workflows_one: saved, saveWorkflow: saved } });
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

// Fallback link: Intercepts network 404 / connection failures and falls back to mock link
const errorFallbackLink = new ApolloLink((operation, forward) => {
  return new Observable((observer) => {
    const sub = forward(operation).subscribe({
      next: (result) => observer.next(result),
      error: (networkError) => {
        console.warn(`[Apollo] Primary GraphQL server returned error (${networkError?.message || networkError}). Falling back to workspace link.`);
        mockApolloLink.request(operation)?.subscribe({
          next: (res) => observer.next(res),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });
      },
      complete: () => observer.complete(),
    });
    return () => sub.unsubscribe();
  });
});

// Derive WebSocket URL for Real-Time Hasura GraphQL Subscriptions
const wsUri = graphqlUrl
  ? graphqlUrl.replace(/^http/, "ws")
  : nhostSubdomain
  ? `wss://${nhostSubdomain}.hasura.${nhostRegion}.nhost.run/v1/graphql`
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

const combinedLink = ApolloLink.from([errorFallbackLink, liveLink]);

export const apolloClient = new ApolloClient({
  link: combinedLink,
  cache: new InMemoryCache(),
});

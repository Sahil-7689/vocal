import { ApolloClient, InMemoryCache, HttpLink, ApolloLink, split } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";
import { getAccessToken, getCurrentUser } from "./auth";

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
  const user = getCurrentUser();
  operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(user?.id
        ? {
            "x-hasura-user-id": user.id,
            "x-hasura-role": "user",
          }
        : {}),
    },
  }));
  return forward(operation);
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

export const apolloClient = new ApolloClient({
  link: liveLink,
  cache: new InMemoryCache(),
});

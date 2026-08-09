import axios from "axios";

/**
 * Execute a GraphQL mutation/query against the Nhost Hasura endpoint
 * using the admin secret header. This bypasses all row-level permissions
 * and is ONLY for use in trusted server-side Action handlers — never
 * expose the admin secret to the frontend.
 */
export async function graphqlAdmin<T = any>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const endpoint =
    process.env.HASURA_GRAPHQL_ENDPOINT ||
    `https://${process.env.NHOST_SUBDOMAIN}.graphql.${process.env.NHOST_REGION}.nhost.run/v1/graphql`;

  const adminSecret = process.env.HASURA_GRAPHQL_ADMIN_SECRET;

  if (!adminSecret) {
    throw new Error(
      "HASURA_GRAPHQL_ADMIN_SECRET is not set. " +
        "Add it to backend/.env before running the server."
    );
  }

  const res = await axios.post(
    endpoint,
    { query, variables },
    {
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": adminSecret,
      },
      timeout: 10000,
    }
  );

  if (res.data.errors) {
    const msg = res.data.errors.map((e: any) => e.message).join("; ");
    throw new Error(`GraphQL Error: ${msg}`);
  }

  return res.data.data as T;
}

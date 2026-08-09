import { NhostClient } from "@nhost/react";

const subdomain = (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim();
const region = (process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1").trim();

export const nhost = new NhostClient({
  ...(subdomain
    ? { subdomain, region }
    : {
        authUrl: "http://localhost:4000/v1/auth",
        graphqlUrl: "http://localhost:4000/v1/graphql",
        autoSignIn: false,
        autoRefreshToken: false,
      }),
});

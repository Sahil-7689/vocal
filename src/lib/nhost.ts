import { NhostClient } from "@nhost/react";

const subdomain = (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim();
const region = (process.env.NEXT_PUBLIC_NHOST_REGION || "us-east-1").trim();

export const nhost = new NhostClient({
  subdomain: subdomain || "local",
  region: region || "us-east-1",
  autoSignIn: Boolean(subdomain),
  autoRefreshToken: Boolean(subdomain),
});

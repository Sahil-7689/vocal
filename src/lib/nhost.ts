import { NhostClient } from "@nhost/react";

const subdomain = (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim() || "vocalflow-prod";
const region = (process.env.NEXT_PUBLIC_NHOST_REGION || "").trim() || "us-east-1";

export const nhost = new NhostClient({
  subdomain,
  region,
  autoSignIn: Boolean((process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim()),
  autoRefreshToken: Boolean((process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim()),
});

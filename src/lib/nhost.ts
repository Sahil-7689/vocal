import { NhostClient } from "@nhost/react";

const subdomain = (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim() || "demo";
const region = (process.env.NEXT_PUBLIC_NHOST_REGION || "").trim() || "us-east-1";

export const nhost = new NhostClient({
  subdomain,
  region,
});

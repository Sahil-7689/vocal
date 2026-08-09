import { NhostClient } from "@nhost/react";

const subdomain = (process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "").trim();
const region = (process.env.NEXT_PUBLIC_NHOST_REGION || "").trim();

if (!subdomain || !region) {
  console.warn(
    "[nhost] NEXT_PUBLIC_NHOST_SUBDOMAIN or NEXT_PUBLIC_NHOST_REGION is not set. " +
      "Authentication will not work. Please check your .env.local file."
  );
}

export const nhost = new NhostClient({
  subdomain: subdomain || "localhost",
  region: region || "local",
  autoSignIn: true,
  autoRefreshToken: true,
});

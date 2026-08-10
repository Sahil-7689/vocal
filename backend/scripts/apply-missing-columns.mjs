#!/usr/bin/env node
/**
 * VocalFlow — Apply Missing Columns & Schema Sync to Nhost PostgreSQL via Hasura SQL API
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";

const __dirname = dirname(fileURLToPath(import.meta.url));

let env = {};
function loadEnvFile(path) {
  try {
    const lines = readFileSync(path, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (key) env[key] = val;
    }
  } catch {}
}
loadEnvFile(resolve(__dirname, "../../.env.local"));
loadEnvFile(resolve(__dirname, "../.env"));

const graphqlUrl = env["NEXT_PUBLIC_GRAPHQL_URL"] || process.env.NEXT_PUBLIC_GRAPHQL_URL || "";
const adminSecret =
  env["HASURA_ADMIN_SECRET"] ||
  env["HASURA_GRAPHQL_ADMIN_SECRET"] ||
  process.env.HASURA_ADMIN_SECRET ||
  process.env.HASURA_GRAPHQL_ADMIN_SECRET ||
  "";
const nhostSubdomain = env["NHOST_SUBDOMAIN"] || env["NEXT_PUBLIC_NHOST_SUBDOMAIN"] || "";
const nhostRegion = env["NHOST_REGION"] || env["NEXT_PUBLIC_NHOST_REGION"] || "ap-south-1";

const hasuraBase = graphqlUrl
  ? graphqlUrl.replace("/v1/graphql", "")
  : `https://${nhostSubdomain}.hasura.${nhostRegion}.nhost.run`;

if (!adminSecret) {
  console.error("❌ HASURA_GRAPHQL_ADMIN_SECRET not set in backend/.env");
  process.exit(1);
}

console.log(`\n🔧 Running SQL Migration on Hasura: ${hasuraBase}\n`);

function runSql(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      type: "run_sql",
      args: {
        source: "default",
        sql,
      },
    });
    const urlObj = new URL(`${hasuraBase}/v1/query`);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-Hasura-Admin-Secret": adminSecret,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function reloadMetadata() {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      type: "reload_metadata",
      args: {
        reload_providers: true,
      },
    });
    const urlObj = new URL(`${hasuraBase}/v1/metadata`);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-Hasura-Admin-Secret": adminSecret,
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const sqlCommands = `
    ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS input JSONB;
    ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS output JSONB;
    ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS trigger_type TEXT;
    ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

    ALTER TABLE public.step_runs ADD COLUMN IF NOT EXISTS input JSONB;
    ALTER TABLE public.step_runs ADD COLUMN IF NOT EXISTS output JSONB;
    ALTER TABLE public.step_runs ADD COLUMN IF NOT EXISTS error TEXT;
    ALTER TABLE public.step_runs ADD COLUMN IF NOT EXISTS attempt_count INTEGER DEFAULT 1;
    ALTER TABLE public.step_runs ADD COLUMN IF NOT EXISTS approved_by UUID;
    ALTER TABLE public.step_runs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
  `;

  console.log("📋 Executing SQL column additions...");
  const res = await runSql(sqlCommands);
  if (res.status === 200) {
    console.log("✅ SQL migration succeeded!");
  } else {
    console.error("❌ SQL migration error:", res.body);
  }

  console.log("\n📋 Reloading Hasura metadata to track new columns...");
  const reloadRes = await reloadMetadata();
  if (reloadRes.status === 200) {
    console.log("✅ Hasura metadata reloaded successfully!");
  } else {
    console.error("❌ Metadata reload error:", reloadRes.body);
  }
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});

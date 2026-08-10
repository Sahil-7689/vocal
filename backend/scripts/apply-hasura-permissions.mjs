#!/usr/bin/env node
/**
 * VocalFlow — Full Hasura Metadata Setup
 * Applies: table tracking + relationships + permissions
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

console.log(`\n🔧 Hasura: ${hasuraBase}\n`);

function httpsPost(path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const urlObj = new URL(hasuraBase);
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path,
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

async function apply(payload, label) {
  const res = await httpsPost("/v1/metadata", payload);
  if (res.status === 200) {
    console.log(`   ✓ ${label}`);
    return true;
  }
  const msg = typeof res.body === "object"
    ? res.body.error || res.body.message || JSON.stringify(res.body)
    : res.body;
  if (msg.includes("already exists") || msg.includes("already defined") || msg.includes("already tracked")) {
    console.log(`   ℹ  ${label} (already exists)`);
    return true;
  }
  console.error(`   ✗ ${label}: ${msg}`);
  return false;
}

// ── Tables ────────────────────────────────────────────────────────────────
const tables = [
  "organizations",
  "org_members",
  "workflows",
  "workflow_steps",
  "workflow_triggers",
  "workflow_runs",
  "step_runs",
  "workflow_results",
  "workflow_events",
  "organization_monthly_usage",
];

async function trackTables() {
  console.log("📋 Tracking tables...");
  for (const name of tables) {
    await apply({
      type: "pg_track_table",
      args: {
        source: "default",
        table: { schema: "public", name },
      },
    }, `track ${name}`);
  }
}

// ── Relationships ─────────────────────────────────────────────────────────
async function applyRelationships() {
  console.log("\n📋 Applying relationships...");

  // organizations.members (array)
  await apply({
    type: "pg_create_array_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "organizations" },
      name: "members",
      using: { foreign_key_constraint_on: { table: { schema: "public", name: "org_members" }, column: "org_id" } },
    },
  }, "organizations.members");

  // organizations.workflows (array)
  await apply({
    type: "pg_create_array_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "organizations" },
      name: "workflows",
      using: { foreign_key_constraint_on: { table: { schema: "public", name: "workflows" }, column: "org_id" } },
    },
  }, "organizations.workflows");

  // org_members.organization (object)
  await apply({
    type: "pg_create_object_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "org_members" },
      name: "organization",
      using: { foreign_key_constraint_on: "org_id" },
    },
  }, "org_members.organization");

  // workflows.organization (object)
  await apply({
    type: "pg_create_object_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "workflows" },
      name: "organization",
      using: { foreign_key_constraint_on: "org_id" },
    },
  }, "workflows.organization");

  // workflows.steps (array)
  await apply({
    type: "pg_create_array_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "workflows" },
      name: "steps",
      using: { foreign_key_constraint_on: { table: { schema: "public", name: "workflow_steps" }, column: "workflow_id" } },
    },
  }, "workflows.steps");

  // workflows.triggers (array)
  await apply({
    type: "pg_create_array_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "workflows" },
      name: "triggers",
      using: { foreign_key_constraint_on: { table: { schema: "public", name: "workflow_triggers" }, column: "workflow_id" } },
    },
  }, "workflows.triggers");

  // workflows.runs (array)
  await apply({
    type: "pg_create_array_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "workflows" },
      name: "runs",
      using: { foreign_key_constraint_on: { table: { schema: "public", name: "workflow_runs" }, column: "workflow_id" } },
    },
  }, "workflows.runs");

  // workflow_steps.workflow (object)
  await apply({
    type: "pg_create_object_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "workflow_steps" },
      name: "workflow",
      using: { foreign_key_constraint_on: "workflow_id" },
    },
  }, "workflow_steps.workflow");

  // workflow_triggers.workflow (object)
  await apply({
    type: "pg_create_object_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "workflow_triggers" },
      name: "workflow",
      using: { foreign_key_constraint_on: "workflow_id" },
    },
  }, "workflow_triggers.workflow");

  // workflow_runs.workflow (object)
  await apply({
    type: "pg_create_object_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "workflow_runs" },
      name: "workflow",
      using: { foreign_key_constraint_on: "workflow_id" },
    },
  }, "workflow_runs.workflow");

  // workflow_runs.organization (object)
  await apply({
    type: "pg_create_object_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "workflow_runs" },
      name: "organization",
      using: { foreign_key_constraint_on: "org_id" },
    },
  }, "workflow_runs.organization");

  // workflow_runs.step_runs (array)
  await apply({
    type: "pg_create_array_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "workflow_runs" },
      name: "step_runs",
      using: { foreign_key_constraint_on: { table: { schema: "public", name: "step_runs" }, column: "workflow_run_id" } },
    },
  }, "workflow_runs.step_runs");

  // step_runs.workflow_run (object)
  await apply({
    type: "pg_create_object_relationship",
    args: {
      source: "default",
      table: { schema: "public", name: "step_runs" },
      name: "workflow_run",
      using: { foreign_key_constraint_on: "workflow_run_id" },
    },
  }, "step_runs.workflow_run");
}

// ── Permissions ───────────────────────────────────────────────────────────
const orgMemberFilter = {
  organization: { members: { user_id: { _eq: "X-Hasura-User-Id" } } },
};

async function applyPermissions() {
  console.log("\n📋 Applying permissions...");

  // organizations SELECT
  for (const role of ["user", "owner", "editor", "viewer"]) {
    await apply({
      type: "pg_create_select_permission",
      args: {
        source: "default",
        table: { schema: "public", name: "organizations" },
        role,
        permission: {
          columns: ["id", "name", "quota_allowed", "quota_used", "created_at"],
          filter: { members: { user_id: { _eq: "X-Hasura-User-Id" } } },
        },
      },
    }, `organizations:${role} SELECT`);
  }

  // org_members SELECT
  for (const role of ["user", "owner"]) {
    await apply({
      type: "pg_create_select_permission",
      args: {
        source: "default",
        table: { schema: "public", name: "org_members" },
        role,
        permission: {
          columns: ["id", "org_id", "user_id", "role", "created_at"],
          filter: orgMemberFilter,
        },
      },
    }, `org_members:${role} SELECT`);
  }
  for (const role of ["editor", "viewer"]) {
    await apply({
      type: "pg_create_select_permission",
      args: {
        source: "default",
        table: { schema: "public", name: "org_members" },
        role,
        permission: {
          columns: ["id", "org_id", "user_id", "role", "created_at"],
          filter: { user_id: { _eq: "X-Hasura-User-Id" } },
        },
      },
    }, `org_members:${role} SELECT`);
  }

  // workflows SELECT/INSERT/UPDATE/DELETE
  const wfCols = ["id", "org_id", "name", "description", "status", "created_at", "updated_at", "created_by"];
  for (const role of ["user", "owner", "editor", "viewer"]) {
    await apply({
      type: "pg_create_select_permission",
      args: {
        source: "default",
        table: { schema: "public", name: "workflows" },
        role,
        permission: { columns: wfCols, filter: orgMemberFilter },
      },
    }, `workflows:${role} SELECT`);
  }
  for (const role of ["user", "owner", "editor"]) {
    await apply({
      type: "pg_create_insert_permission",
      args: {
        source: "default",
        table: { schema: "public", name: "workflows" },
        role,
        permission: {
          columns: ["org_id", "name", "description", "status", "created_by"],
          check: orgMemberFilter,
          set: {},
        },
      },
    }, `workflows:${role} INSERT`);
    await apply({
      type: "pg_create_update_permission",
      args: {
        source: "default",
        table: { schema: "public", name: "workflows" },
        role,
        permission: {
          columns: ["name", "description", "status"],
          filter: orgMemberFilter,
        },
      },
    }, `workflows:${role} UPDATE`);
  }
  for (const role of ["user", "owner"]) {
    await apply({
      type: "pg_create_delete_permission",
      args: {
        source: "default",
        table: { schema: "public", name: "workflows" },
        role,
        permission: { filter: orgMemberFilter },
      },
    }, `workflows:${role} DELETE`);
  }

  // workflow_runs SELECT
  const wrFilter = { workflow: orgMemberFilter };
  const wrCols = ["id", "workflow_id", "org_id", "status", "triggered_by", "started_at", "completed_at", "created_at", "error"];
  for (const role of ["user", "owner", "editor", "viewer"]) {
    await apply({
      type: "pg_create_select_permission",
      args: {
        source: "default",
        table: { schema: "public", name: "workflow_runs" },
        role,
        permission: { columns: wrCols, filter: wrFilter },
      },
    }, `workflow_runs:${role} SELECT`);
  }

  // step_runs SELECT
  const srFilter = { workflow_run: { workflow: orgMemberFilter } };
  const srCols = ["id", "workflow_run_id", "workflow_step_id", "status", "started_at", "completed_at", "input", "output", "error", "attempt_count", "approved_by", "approved_at", "created_at"];
  for (const role of ["user", "owner", "editor", "viewer"]) {
    await apply({
      type: "pg_create_select_permission",
      args: {
        source: "default",
        table: { schema: "public", name: "step_runs" },
        role,
        permission: { columns: srCols, filter: srFilter },
      },
    }, `step_runs:${role} SELECT`);
  }
}

async function main() {
  // Health check
  await new Promise((resolve, reject) => {
    const urlObj = new URL(hasuraBase);
    const req = https.request({ hostname: urlObj.hostname, port: 443, path: "/healthz", method: "GET" }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        if (res.statusCode === 200) { console.log("✅ Hasura: reachable"); resolve(); }
        else reject(new Error(`Health ${res.statusCode}: ${d}`));
      });
    });
    req.on("error", reject);
    req.end();
  });

  await trackTables();
  await applyRelationships();
  await applyPermissions();

  console.log("\n✅ Done! Workflow creation should now work for authenticated users.\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal:", err.message || err);
  process.exit(1);
});

import express from "express";
import handleTriggerWorkflowRun from "./trigger-workflow-run/index";
import handleApproveStep from "./approve-step/index";
import handleWebhookTrigger from "./webhook-trigger/index";
import handleCreateOrganization from "./create-organization/index";
import handleScheduledTrigger from "./scheduled-trigger/index";
import handleDatabaseEventTrigger from "./database-event-trigger/index";

const app = express();
app.use(express.json());

// CORS headers for development
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Hasura Action & Nhost Function Handlers
app.post("/v1/trigger-workflow-run", handleTriggerWorkflowRun);
app.post("/v1/approve-step", handleApproveStep);
app.post("/v1/create-organization", handleCreateOrganization);
app.post("/v1/scheduled-trigger", handleScheduledTrigger);
app.post("/v1/database-event-trigger", handleDatabaseEventTrigger);
app.post("/webhook/:workflow_id", handleWebhookTrigger);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "VocalFlow Backend Engine", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 VocalFlow Backend Engine running at http://localhost:${PORT}`);
  console.log(`   - Trigger Action:          POST http://localhost:${PORT}/v1/trigger-workflow-run`);
  console.log(`   - Approve Action:          POST http://localhost:${PORT}/v1/approve-step`);
  console.log(`   - Create Org Action:       POST http://localhost:${PORT}/v1/create-organization`);
  console.log(`   - Scheduled Trigger:       POST http://localhost:${PORT}/v1/scheduled-trigger`);
  console.log(`   - Database Event Trigger:  POST http://localhost:${PORT}/v1/database-event-trigger`);
  console.log(`   - Webhook Trigger:         POST http://localhost:${PORT}/webhook/:workflow_id\n`);
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.log(`\n✅ Port ${PORT} is already in use by an active VocalFlow server process.`);
    console.log(`   The VocalFlow Backend Engine is ALREADY running and healthy at http://localhost:${PORT}/health\n`);
    process.exit(0);
  } else {
    throw err;
  }
});

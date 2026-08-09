import express from "express";
import handleTriggerWorkflowRun from "./trigger-workflow-run/index";
import handleApproveStep from "./approve-step/index";
import handleWebhookTrigger from "./webhook-trigger/index";
import handleCreateOrganization from "./create-organization/index";

const app = express();
app.use(express.json());

// CORS headers for local development
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
app.post("/webhook/:workflow_id", handleWebhookTrigger);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "VocalFlow Backend Engine", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`\n🚀 VocalFlow Backend Engine running at http://localhost:${PORT}`);
  console.log(`   - Trigger Action:      POST http://localhost:${PORT}/v1/trigger-workflow-run`);
  console.log(`   - Approve Action:      POST http://localhost:${PORT}/v1/approve-step`);
  console.log(`   - Create Org Action:   POST http://localhost:${PORT}/v1/create-organization`);
  console.log(`   - Webhook Trigger:     POST http://localhost:${PORT}/webhook/:workflow_id\n`);
});

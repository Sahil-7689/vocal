# VocalFlow Backend (Nhost + Hasura + PostgreSQL)

This directory contains the production-ready backend for **VocalFlow**, an AI workflow automation platform.

---

## 1. System Architecture

```text
Next.js Frontend (GraphQL Client)
       │
       ▼
Hasura GraphQL Engine (Nhost)
   ├── Real-Time Subscriptions (step_runs, workflow_runs)
   ├── Layer 1 Row-Level Permissions (Org Isolation)
   └── Hasura Actions (triggerWorkflowRun, approveStep)
       │
       ▼
Nhost Serverless Functions / Node.js Engine
   ├── Atomic Quota Reservation (PostgreSQL Transactions FOR UPDATE)
   ├── Workflow Step Execution Engine
   │   ├── LLM Call (Groq / OpenRouter API)
   │   ├── HTTP Request (SSRF Protection & Exponential Backoff Retries)
   │   ├── Conditional Branch Routing
   │   ├── Approval Gate Pause / Resume
   │   ├── DB Write (workflow_results)
   │   └── Notify (Slack Webhooks)
   └── Webhook Non-Manual Trigger Endpoint
       │
       ▼
PostgreSQL Database
   ├── public.organizations
   ├── public.org_members
   ├── public.workflows
   ├── public.workflow_steps
   ├── public.workflow_triggers
   ├── public.workflow_runs
   ├── public.step_runs
   └── public.workflow_results
```

---

## 2. Directory Structure

```text
backend/
├── functions/
│   ├── _shared/
│   │   └── workflowEngine.ts        # Reusable execution engine & quota locker
│   ├── trigger-workflow-run/
│   │   └── index.ts                 # Action handler for triggering runs
│   ├── approve-step/
│   │   └── index.ts                 # Action handler for resuming paused gates
│   └── webhook-trigger/
│       └── index.ts                 # Non-manual external POST webhook handler
│
├── migrations/
│   └── default/
│       ├── 001_schema.sql           # PostgreSQL table schemas & constraints
│       └── 002_indexes_and_views.sql# Indexes & organization_monthly_usage view
│
├── metadata/
│   ├── actions.yaml                 # Hasura Action definitions & types
│   ├── permissions.yaml             # Layer 1 org isolation & role rules
│   └── relationships.yaml           # Table array & object relationships
│
├── seeds/
│   └── demo.sql                     # Seed script for Org A & Org B evaluation
│
├── tests/
│   ├── security.test.ts             # Org isolation & permission tests
│   └── execution.test.ts            # SSRF, LLM, and execution engine tests
│
├── package.json
└── README.md
```

---

## 3. Security Model

VocalFlow enforces **Two Independent Security Layers**:

### Layer 1 — Hasura Organization + Role Row Permissions
Every GraphQL query, mutation, and subscription enforces:
```sql
org_members.user_id = X-Hasura-User-Id
AND org_members.org_id = workflow.org_id
```
This guarantees that users belonging to **Organization B** can **never** query, mutate, or subscribe to **Organization A** workflows, step runs, or usage data.

### Layer 2 — Action-Level Step & Role Verification
Hasura Actions (`triggerWorkflowRun` & `approveStep`) independently verify server-side:
1. `X-Hasura-User-Id` header presence.
2. Authenticated user's membership in `workflow.org_id`.
3. User role (`owner` vs `editor` vs `viewer`).
4. Restricted step enforcement: Only `owner` role can configure `db_write`, `notify`, or `webhook` triggers.
5. `approval_gate` verification: Only `owner` role can approve gates specifying `required_role = owner`.
6. State validation: Only currently `paused` step runs can be approved.

---

## 4. Quota Enforcement & PostgreSQL Row Locking

Server-side quota reservation prevents race conditions during concurrent execution requests:
```sql
BEGIN;
SELECT quota_allowed, quota_used FROM public.organizations WHERE id = $1 FOR UPDATE;
-- Check: quota_used < quota_allowed
-- If valid: Reserve execution & commit transaction
COMMIT;
```
Upon successful workflow execution completion, `quota_used` is atomically incremented by 1.

---

## 5. Setup & Local Development

### Prerequisites
- Node.js >= 18
- Nhost CLI or local PostgreSQL + Hasura GraphQL Engine

### Environment Variables (`backend/.env`)
```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/vocalflow
LLM_API_KEY=gsk_your_groq_api_key_here
LLM_PROVIDER=groq
WEBHOOK_SECRET=whsec_live_acme_991823
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
```

### Local Database Setup & Migrations
```bash
# Apply schema and indexes
psql $DATABASE_URL -f migrations/default/001_schema.sql
psql $DATABASE_URL -f migrations/default/002_indexes_and_views.sql

# Seed demonstration data
psql $DATABASE_URL -f seeds/demo.sql
```

### Run Automated Security & Execution Test Suite
```bash
cd backend
npm install
npm test
```

---

## 6. Pre-Configured Demo Accounts

| Organization | User ID | Email | Role | Accessible Workflows |
|---|---|---|---|---|
| **Org A (Acme AI)** | `11111111-1111-1111-1111-111111111111` | `sahil@vocalflow.ai` | **Owner** | Full access to Org A workflows & runs |
| **Org A (Acme AI)** | `22222222-2222-2222-2222-222222222222` | `editor@vocalflow.ai` | **Editor** | Can build & run; restricted from member management |
| **Org A (Acme AI)** | `33333333-3333-3333-3333-333333333333` | `viewer@vocalflow.ai` | **Viewer** | Read-only access |
| **Org B (Beta AI)** | `44444444-4444-4444-4444-444444444444` | `cyberdyne@orgb.ai` | **Owner** | Restricted to Org B; blocked from Org A |

---

## 7. Approval Gate Execution State Lifecycle

```text
[triggerWorkflowRun]
        │
        ▼
   LLM Call → COMPLETED
        │
   HTTP Request → COMPLETED
        │
   Conditional Branch → COMPLETED
        │
   Approval Gate → PAUSED (persisted in workflow_runs & step_runs)
        │
 [Hasura Subscription emits live UI update]
        │
 [Owner clicks "Approve & Continue"]
        │
        ▼
   [approveStep Action]
        │
   DB Write → COMPLETED
        │
   Workflow → COMPLETED
        │
   [Quota Incremented]
```

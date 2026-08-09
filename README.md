# VocalFlow — Enterprise AI Workflow Automation Platform

VocalFlow is a production-ready **AI Agent Workflow Builder** built with **Next.js 14 (App Router)**, **Nhost Auth**, **Hasura GraphQL Engine**, **PostgreSQL**, **Nhost Node.js Serverless Functions**, and **Groq AI (Llama 3.3)**.

---

## 🌐 Live Demo & Production Architecture

- **Vercel Frontend URL**: `https://<your-vercel-domain>.vercel.app`
- **Nhost Backend Services**: `https://<nhost-subdomain>.graphql.<region>.nhost.run/v1/graphql`

```text
User Browser (Vercel Next.js App Router + Apollo Client)
       │
       ├── Nhost Auth (JWT Authentication & Session Headers)
       │
       ├── Hasura GraphQL Engine (Row-Level Security & Real-Time Subscriptions)
       │       │
       │       └── PostgreSQL (Organizations, Workflows, Runs, Step Runs, Audit Logs)
       │
       └── Hasura Actions & Nhost Functions (Serverless Action Engine)
               │
               ├── Groq LLM API (Llama 3.3 70B Versatile Model)
               ├── SSRF-Protected HTTP Client
               ├── Atomic Quota Locking (SELECT ... FOR UPDATE)
               └── External Webhook Endpoint (POST /webhook/:workflow_id)
```

---

## 🚀 Local Setup & Installation

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/Sahil-7689/vocal.git
cd vocal
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### 3. Run Development Servers
Open two terminal windows:

#### Terminal 1 (Frontend)
```bash
npm run dev
```
*Runs Next.js development server at [http://localhost:3000](http://localhost:3000)*

#### Terminal 2 (Backend Functions)
```bash
cd backend
npm run dev
```
*Runs Express / Nhost Functions server at [http://localhost:4000](http://localhost:4000)*

---

## 🔑 Environment Variables

### Frontend Public Variables (Configured in Vercel / `.env.local`)
Only safe public client configuration is exposed to the browser:
```env
NEXT_PUBLIC_NHOST_SUBDOMAIN=vocalflow-prod
NEXT_PUBLIC_NHOST_REGION=us-east-1
NEXT_PUBLIC_GRAPHQL_URL=https://vocalflow-prod.graphql.us-east-1.nhost.run/v1/graphql
NEXT_PUBLIC_API_URL=https://vocalflow-prod.functions.us-east-1.nhost.run
```

### Server-Side Secrets (Configured strictly in Nhost Function Settings)
*Never exposed to the client-side browser bundle:*
```env
DATABASE_URL=postgres://postgres:...@.../vocalflow
LLM_API_KEY=gsk_...
NHOST_ADMIN_SECRET=<your-hasura-admin-secret>
WEBHOOK_SECRET=vf_sec_99881122
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
```

---

## 🔐 Authentication & Session Protection

- **Provider**: Nhost Auth (`@nhost/react`).
- **Session Protection**: Wrapped in a reusable `<AuthGuard>` component.
- **Protected Routes**: `/dashboard`, `/workflows`, `/workflows/*`, `/usage`, `/settings`.
- **Public Routes**: `/login`. Unauthenticated requests redirect automatically to `/login`.

---

## 🛡️ Authorization & Role Security

VocalFlow implements a **Two-Layer Security Architecture**:

1. **Layer 1 — Hasura Row-Level Security (RLS)**: Enforces table permissions using `org_id` and user headers (`X-Hasura-User-Id`, `X-Hasura-Org-Id`).
2. **Layer 2 — Action Verification**: Serverless functions inspect the authenticated `X-Hasura-User-Id` header, verify organization membership in PostgreSQL, and validate role privileges.

### Permission Matrix

| Operation / Feature | Owner 👑 | Editor ✏️ | Viewer 👁️ |
|---|:---:|:---:|:---:|
| Read Workflows, Runs & Usage | ✅ | ✅ | ✅ |
| Build & Edit Workflows | ✅ | ✅ | ❌ |
| Manual Run Execution | ✅ | ✅ | ❌ |
| Approve Paused Gate Steps | ✅ | ✅ *(if allowed)* | ❌ |
| Add Restricted Steps (`db_write`, `notify`) | ✅ | ❌ | ❌ |
| Add Webhook Trigger | ✅ | ❌ | ❌ |
| Organization Member Administration | ✅ | ❌ | ❌ |

---

## 🤖 Workflow Engine & Step Types

1. **`llm_call`**: Executes AI text processing using Groq API (`llama-3.3-70b-versatile`). Secrets are kept strictly server-side.
2. **`http_request`**: Performs GET/POST/PUT/PATCH/DELETE API requests with strict **SSRF Protection** blocking internal/private IP ranges (`127.0.0.1`, `localhost`, `169.254.169.254`, `10.0.0.0/8`, etc.).
3. **`conditional_branch`**: Evaluates JSON path logic on previous step output (`sentiment == negative` or `status == 200`) and routes execution branch.
4. **`approval_gate`**: Pauses execution state in PostgreSQL (`step_runs.status = 'paused'`, `workflow_runs.status = 'paused'`) and streams live state update to frontend via WebSocket subscription. Resumes only when an authorized role calls `approveStep`.
5. **`db_write`**: Performs controlled inserts into `workflow_results` without raw SQL injection risk.
6. **`notify`**: Dispatches external Slack or Webhook notification payload.

---

## ⚡ Triggers

- **Manual Trigger**: Executed via **Run Workflow** button in the UI.
- **Webhook Trigger**: Triggered externally via HTTP POST `POST /webhook/:workflow_id` with `X-Webhook-Secret` verification. Does not require UI interaction.

---

## 🧪 Real Security & Quota Controls

- **Cross-Organization Isolation**: Users in Org B attempting to access Org A's workflow ID receive a `Workflow unavailable` alert and `403 Unauthorized` GraphQL error.
- **Atomic Quota Reservation**: Uses PostgreSQL `SELECT ... FOR UPDATE` row locking to check `quota_used < quota_allowed` transactionally before initiating workflow execution.
- **Exponential Backoff Retries**: Step failures automatically attempt retries using exponential backoff tracking `attempt_count`.

---

## 📋 Evaluation Demo Instructions for Reviewers

Reviewers can verify the complete assignment end-to-end using these steps:

1. **Login & Session Check**: Open `/dashboard` in Incognito ➔ verify automatic redirect to `/login`. Sign in using an Org A account (`sahil@vocalflow.ai`).
2. **Workflow Builder Inspection**: Open `Customer Support Agent Workflow` to view the visual step graph (`LLM` ➔ `HTTP` ➔ `Conditional` ➔ `Approval Gate` ➔ `DB Write`).
3. **Live Run & Subscription Test**: Click **Run Workflow**. Observe the execution progress live via GraphQL WebSocket subscriptions (`LLM` completed ➔ `HTTP` completed ➔ `Conditional` completed ➔ `Approval Gate` **PAUSED**).
4. **Approval Gate & Resumption**: Note that downstream `DB Write` remains in `WAITING` state. Click **Approve & Continue** as Owner. Observe status transition live to `COMPLETED`.
5. **Cross-Org Isolation Test**: Log in as Org B (`cyberdyne@orgb.ai`) and attempt to open `/workflows/f0000000-0000-0000-0000-000000000001` directly. Verify access is blocked with `Workflow unavailable` (403).
6. **External Webhook Test**: Send a cURL request:
   ```bash
   curl -X POST "http://localhost:4000/webhook/f0000000-0000-0000-0000-000000000001" \
     -H "Content-Type: application/json" \
     -H "X-Webhook-Secret: vf_sec_99881122" \
     -d '{"text":"Urgent refund request"}'
   ```
   Verify `200 OK` is returned and a new workflow run is created automatically.

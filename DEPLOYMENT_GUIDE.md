# VocalFlow — Complete Master Production Deployment Guide (Nhost + Hasura + Vercel)

This guide provides step-by-step instructions to deploy VocalFlow end-to-end.

---

## 🏗️ Architecture Overview

```text
User Browser (Vercel Frontend: Next.js + Apollo + Nhost Auth)
       ↓
  Nhost Auth (Authentication & JWT Issuance)
       ↓
  Hasura GraphQL Engine (PostgreSQL Data & Real-time Subscriptions)
       ↓
  Nhost Functions (Node.js Serverless Actions & Webhooks)
       ↓
  Groq LLM API / Database / External HTTP APIs
```

---

## PHASE 1: Nhost Project & Database Setup

### Step 1.1 — Create Nhost Project
1. Log in to [app.nhost.io](https://app.nhost.io).
2. Click **Create Project**.
3. Fill in details:
   - **Project Name**: `vocalflow-prod`
   - **Region**: Choose closest region (e.g. `us-east-1` or `eu-central-1`)
4. Wait for deployment (~1 minute).
5. Open your project dashboard and locate your **Subdomain** (e.g., `vocalflow-prod`) and **Region** (e.g., `us-east-1`).

---

### Step 1.2 — Database Migration & Tables
1. In Nhost Dashboard, click **Database** ➔ **SQL Editor** (or click **Hasura Console** in top navigation).
2. Open the SQL Editor tab.
3. Copy the entire contents of [`backend/migrations/default/001_schema.sql`](file:///d:/stitch_vocalflow_ai_workflow_builder/backend/migrations/default/001_schema.sql) and click **Run**.
4. *(Optional Seed Data)*: Copy the contents of [`backend/seeds/demo.sql`](file:///d:/stitch_vocalflow_ai_workflow_builder/backend/seeds/demo.sql) and click **Run**.

---

### Step 1.3 — Track Tables & Foreign Keys in Hasura
1. Open **Hasura Console** ➔ **Data** tab.
2. Under `public` schema, click **Track All** for untracked tables:
   - `organizations`
   - `org_members`
   - `workflows`
   - `workflow_steps`
   - `workflow_triggers`
   - `workflow_runs`
   - `step_runs`
   - `workflow_results`
3. Under **Foreign Key Relationships**, click **Track All**.

---

### Step 1.4 — Configure Hasura Actions
In Hasura Console ➔ **Actions** tab ➔ **Create**:

#### Action 1: `triggerWorkflowRun`
- **Action Definition**:
  ```graphql
  type Mutation {
    triggerWorkflowRun(input: TriggerWorkflowRunInput!): TriggerWorkflowRunOutput
  }
  ```
- **New Types Definition**:
  ```graphql
  input TriggerWorkflowRunInput {
    workflow_id: String!
  }
  type TriggerWorkflowRunOutput {
    run_id: String!
    status: String!
  }
  ```
- **Webhook Handler**:
  `https://<nhost-subdomain>.functions.<region>.nhost.run/v1/trigger-workflow-run`

#### Action 2: `approveStep`
- **Action Definition**:
  ```graphql
  type Mutation {
    approveStep(input: ApproveStepInput!): ApproveStepOutput
  }
  ```
- **New Types Definition**:
  ```graphql
  input ApproveStepInput {
    step_run_id: String!
  }
  type ApproveStepOutput {
    success: Boolean!
    status: String!
  }
  ```
- **Webhook Handler**:
  `https://<nhost-subdomain>.functions.<region>.nhost.run/v1/approve-step`

---

### Step 1.5 — Configure Nhost Environment Variables
In Nhost Dashboard ➔ **Project Settings** ➔ **Environment Variables**, add:

| Key | Example Value | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:...@.../vocalflow` | (Auto-populated by Nhost) |
| `LLM_API_KEY` | `gsk_...` | Groq Llama 3.3 API key |
| `NHOST_ADMIN_SECRET` | `<your-hasura-admin-secret>` | Hasura admin token |
| `WEBHOOK_SECRET` | `vf_sec_99881122` | Secret key for external webhook triggers |

---

## PHASE 2: Deploy Frontend on Vercel

### Step 2.1 — Import Repository
1. Log in to [vercel.com](https://vercel.com) and click **Add New... ➔ Project**.
2. Select repository: **`Sahil-7689/vocal`**.

### Step 2.2 — Configure Project Settings
- **Framework Preset**: `Next.js`
- **Root Directory**: `./` (Default)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### Step 2.3 — Add Vercel Environment Variables
In the **Environment Variables** panel, add the following 4 variables:

```env
NEXT_PUBLIC_NHOST_SUBDOMAIN=vocalflow-prod
NEXT_PUBLIC_NHOST_REGION=us-east-1
NEXT_PUBLIC_GRAPHQL_URL=https://vocalflow-prod.graphql.us-east-1.nhost.run/v1/graphql
NEXT_PUBLIC_API_URL=https://vocalflow-prod.functions.us-east-1.nhost.run
```

*(Replace `vocalflow-prod` and `us-east-1` with your actual Nhost project values).*

### Step 2.4 — Deploy!
1. Click **Deploy**.
2. Wait ~1 minute for Vercel to compile Next.js pages.
3. Copy your assigned Vercel URL (e.g. `https://vocal-six.vercel.app`).

---

## PHASE 3: Connect Nhost Auth & CORS to Vercel

1. Open **Nhost Dashboard** ➔ **Settings** ➔ **Auth**.
2. Set **Client URL**:
   `https://<your-vercel-domain>.vercel.app`
3. Add to **Allowed Redirect URLs**:
   `https://<your-vercel-domain>.vercel.app/*`
4. Click **Save**.

---

## PHASE 4: End-to-End Verification Test

After deployment, perform these tests on your live Vercel URL:

1. **Unauthenticated Check**:
   - Open `/dashboard` in Incognito.
   - Verified result: Redirects to `/login`.

2. **Login & Session Persistence**:
   - Log in with Nhost Auth. Refresh page.
   - Verified result: User remains logged in.

3. **Workflow Execution & Live Subscriptions**:
   - Open workflow builder and click **Run Workflow**.
   - Verified result: Step statuses update live via GraphQL subscriptions without browser refresh.

4. **Approval Gate Pause & Resume**:
   - Run workflow containing an Approval Gate node.
   - Verified result: Execution pauses (`PAUSED`), clicking **Approve & Continue** as Owner resumes execution to `COMPLETED`.

5. **Cross-Organization Security Isolation**:
   - Switch to Org B user and navigate to `/workflows/<ORG_A_WORKFLOW_ID>`.
   - Verified result: Displays `Workflow unavailable: You don't have permission to access this workflow.`.

6. **External Webhook Execution**:
   - Send cURL POST to `https://<nhost-subdomain>.functions.<region>.nhost.run/webhook/<WORKFLOW_ID>` with header `X-Webhook-Secret: vf_sec_99881122`.
   - Verified result: Returns `200 OK` and creates a new run in VocalFlow.

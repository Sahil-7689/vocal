# VocalFlow Assignment Demo — 5–7 Minute Video Recording Script

This script provides a precise time-coded narration and action breakdown for recording your VocalFlow assignment video.

---

## ⏱️ Video Overview & Timing Budget

| Scene | Section Title | Target Time | Key Focus |
|---|---|---|---|
| **Scene 1** | Introduction | 0:00 – 0:30 (30s) | Dashboard & Assignment Proof Overview |
| **Scene 2** | Organization & Workflow Builder | 0:30 – 1:30 (60s) | Acme AI Org, Workflow Nodes & Step Config |
| **Scene 3** | Manual Workflow Execution | 1:30 – 2:30 (60s) | Live execution: LLM ➔ HTTP ➔ Conditional Branch |
| **Scene 4** | Approval Gate Paused State | 2:30 – 3:30 (60s) | Paused execution, persisted state, role requirements |
| **Scene 5** | Step Approval & Resumption | 3:30 – 4:30 (60s) | Approve & Continue, backend action, status completion |
| **Scene 6** | Cross-Organization Isolation | 4:30 – 5:30 (60s) | Beta AI attempt on Org A URL, 403 / Access Guard |
| **Scene 7** | Webhook Trigger Demo | 5:30 – 6:30 (60s) | External cURL trigger without UI click |
| **Scene 8** | Conclusion & Technical Summary | 6:30 – 7:00 (30s) | Final recap of complete assignment requirements |

---

## 🎬 Detailed Scene Breakdown

### SCENE 1 — INTRODUCTION (0:00 – 0:30)

* **Visual**: VocalFlow Dashboard with active user context visible.
* **Action**: Start recording at main `/dashboard` page.
* **Narration**:
  > *"Hi, I'm Sahil. This is my implementation of the AI Agent Workflow Builder assignment. In this demo, I'll show the complete workflow execution, live step updates, approval gate, webhook trigger, quota and cross-organization security."*

---

### SCENE 2 — ORGANIZATION AND WORKFLOW BUILDER (0:30 – 1:30)

* **Visual**: Navigate to **Organization: Acme AI** ➔ Open **Customer Support Agent** workflow builder canvas.
* **Action**:
  1. Show canvas containing nodes: `Manual Trigger` ➔ `LLM Call` ➔ `HTTP Request` ➔ `Conditional Branch` ➔ `Approval Gate` ➔ `DB Write`.
  2. Click `LLM Call` node to reveal configuration panel (`Groq / Llama 3.3-70b-versatile`).
  3. Click `HTTP Request` node to reveal request configuration.
  4. Click `Conditional Branch` node to show condition: `sentiment == negative`.
  5. Click `Approval Gate` node showing owner role requirement.
* **Narration**:
  > *"This workflow contains multiple step types required by the assignment: an LLM call, HTTP request, conditional branch, approval gate and database write. It can be started manually or through a webhook."*

---

### SCENE 3 — START WORKFLOW (1:30 – 2:30)

* **Visual**: Live Workflow Execution Timeline (`/workflows/<ID>/runs/<RUN_ID>`).
* **Action**:
  1. Click **Run Workflow**.
  2. Do **NOT** refresh the page. Keep screen steady to showcase real-time subscription.
  3. Observe statuses transition live:
     - `LLM Call`: `RUNNING` ➔ `COMPLETED`
     - `HTTP Request`: `RUNNING` ➔ `COMPLETED`
     - `Conditional Branch`: `RUNNING` ➔ `COMPLETED` (`sentiment == negative` ➔ `TRUE`).
* **Narration**:
  > *"The workflow is executing sequentially. The LLM produces the classification, the HTTP step executes, and the conditional branch evaluates the LLM output."*

---

### SCENE 4 — APPROVAL GATE (2:30 – 3:30)

* **Visual**: Execution Timeline paused at **Approval Gate**.
* **Action**:
  1. Highlight `Approval Gate`: **PAUSED** (`Awaiting approval`).
  2. Highlight downstream step: `DB Write`: **WAITING**.
  3. Point out the **Approval Required** UI card: `Required Role: Owner` with **Approve & Continue** button.
* **Narration**:
  > *"The workflow has now reached the approval gate. The run is persisted as paused, so execution stops here and the later steps have not executed."*
  > *"The frontend receives this state through a live GraphQL subscription, so no page refresh is required."*

---

### SCENE 5 — APPROVE THE WORKFLOW (3:30 – 4:30)

* **Visual**: Active Org A Owner user viewing the paused run.
* **Action**:
  1. Click **Approve & Continue**.
  2. Keep screen steady as live state transitions occur:
     - `Approval Gate`: `COMPLETED`
     - `DB Write`: `RUNNING` ➔ `COMPLETED`
     - Overall status: `✓ Workflow Completed`
* **Narration**:
  > *"Approval is handled by a separate backend Action. The Action verifies the user's organization membership and role before allowing the workflow to resume."*

---

### SCENE 6 — CROSS-ORGANIZATION SECURITY (4:30 – 5:30)

* **Visual**: Org B (**Beta AI**) session interface.
* **Action**:
  1. Copy Org A Workflow ID (`w0000000-0000-0000-0000-000000000001`).
  2. Paste direct URL into browser address bar: `/workflows/w0000000-0000-0000-0000-000000000001`.
  3. Verify security alert banner displays:
     ```text
     Workflow unavailable
     You don't have permission to access this workflow.
     ```
  4. Attempt trigger / approval action as Org B user to demonstrate API `403 Unauthorized`.
* **Narration**:
  > *"Now I'll demonstrate the organization isolation. This is a different organization, and I'm attempting to access the Org A workflow directly using its ID."*
  > *"This is enforced at the backend level. Org B cannot access, trigger, or approve Org A resources even when the resource IDs are known."*

---

### SCENE 7 — WEBHOOK TRIGGER (5:30 – 6:30)

* **Visual**: Terminal window next to VocalFlow UI.
* **Action**:
  1. Execute the curl command in terminal:
     ```bash
     curl -X POST "http://localhost:4000/webhook/w0000000-0000-0000-0000-000000000001" \
       -H "Content-Type: application/json" \
       -H "X-Webhook-Secret: vf_sec_99881122" \
       -d '{"text":"I need urgent help with my refund"}'
     ```
  2. Terminal returns `200 OK` with `{ "status": "paused", "run_id": "..." }`.
  3. Switch to VocalFlow runs history tab and watch the new webhook execution appear live.
* **Narration**:
  > *"Finally, the workflow can also be started externally through the webhook trigger. This execution does not require clicking the Run button in the frontend."*

---

### SCENE 8 — FINAL SUMMARY (6:30 – 7:00)

* **Visual**: Completed workflow screen with all metrics and status badges.
* **Action**: Return to completed run screen.
* **Narration**:
  > *"This demonstrates the complete assignment scenario: organization-based access control, role permissions, real LLM and HTTP execution, conditional branching, retry handling, an approval-gate pause and resume, live GraphQL subscriptions, quota enforcement, a webhook trigger, and cross-organization isolation."*

---

## 🛠️ Pre-Flight Verification Checklist

Before hitting record:
- [x] Both servers are running:
  - Frontend: `npm run dev` (`http://localhost:3000`)
  - Backend: `cd backend` && `npm run dev` (`http://localhost:4000`)
- [x] Test suite passes: `npm run test` inside `backend/`
- [x] Browser resolution set to 1080p (1920x1080)
- [x] Environment variable / credentials hidden from view

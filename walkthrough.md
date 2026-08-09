# VocalFlow Product Demonstration Walkthrough & WebP Recording

The end-to-end browser walkthrough for **VocalFlow** has been automatically recorded.

---

## 📽️ Browser Session Video Recording

Below is the complete recorded browser session showing the full demo execution:

![VocalFlow End-to-End Product Demo Video](file:///C:/Users/Dell/.gemini/antigravity-ide/brain/8d791868-e672-4fb6-9244-7b34f189ab15/vocalflow_demo_recording_1786256627661.webp)

---

## 📷 Key Demo Milestones Captured

### 1. Workflow Builder Canvas (Org A — Acme AI)
![Workflow Builder](file:///C:/Users/Dell/.gemini/antigravity-ide/brain/8d791868-e672-4fb6-9244-7b34f189ab15/workflow_builder_page_1786256736011.png)

- **Canvas & Steps**: Interactive drag-and-drop nodes connected in sequence: `LLM Call` ➔ `HTTP Request` ➔ `Conditional Branch` ➔ `Approval Gate` ➔ `DB Write`.
- **Node Selection**: Highlighted node parameters and step library controls.

---

### 2. Live Execution — Approval Gate PAUSED
![Paused Approval Gate](file:///C:/Users/Dell/.gemini/antigravity-ide/brain/8d791868-e672-4fb6-9244-7b34f189ab15/paused_approval_gate_1786256796352.png)

- **Real-Time Subscription**: Sequential execution completed `HTTP Request` and `Conditional Branch` (`result: true`), then paused execution at `Approval Gate (Owner Review)`.
- **Approval Required Card**: Displayed `Target Step`, `Required Role: Owner`, and the interactive **Approve & Continue** button without requiring a browser refresh.

---

### 3. Resumed Execution & Workflow Completion
![Workflow Completed](file:///C:/Users/Dell/.gemini/antigravity-ide/brain/8d791868-e672-4fb6-9244-7b34f189ab15/execution_completed_1786256806715.png)

- **Live Resumption**: Clicking **Approve & Continue** invoked the backend Action, updating status to `COMPLETED` for both the Approval Gate and subsequent `DB Write (Tickets Audit)` step.

---

### 4. Cross-Organization Security Guard (Org B Denial)
![Security Guard Access Denied](file:///C:/Users/Dell/.gemini/antigravity-ide/brain/8d791868-e672-4fb6-9244-7b34f189ab15/security_guard_access_denied_1786256843550.png)

- **Access Enforcement**: Switched organization context to **Cyberdyne Systems (Org B)** and attempted to access Org A's workflow. The Security Guard immediately blocked access with:
  > *"Workflow unavailable: You don't have permission to access this workflow."*

---

### 5. Webhook Trigger Settings
![Webhook Trigger Settings](file:///C:/Users/Dell/.gemini/antigravity-ide/brain/8d791868-e672-4fb6-9244-7b34f189ab15/webhook_trigger_settings_1786256865119.png)

- **Webhook Endpoint**: Displays configured webhook trigger URL and security secret for external triggers.

---

## 🛠️ Verification Summary

- [x] **Scene 1 & 2**: Dashboard & Workflow Builder navigation
- [x] **Scene 3**: Manual execution start & live step progress
- [x] **Scene 4**: Persisted `PAUSED` state at Approval Gate
- [x] **Scene 5**: Owner role approval & live execution completion
- [x] **Scene 6**: Org B isolation enforcement & access denial
- [x] **Scene 7**: Webhook endpoint verification

# VocalFlow — One-Page Architecture Write-Up

## 1. Schema Reasoning & Technical Design

VocalFlow's relational database schema is built on **PostgreSQL** and managed via **Hasura GraphQL Engine**:

```text
organizations
    ├── org_members
    ├── workflows
    │     ├── workflow_steps ──> step_runs
    │     ├── workflow_triggers
    │     └── workflow_runs  ──> step_runs
    ├── workflow_results
    └── workflow_events
```

- **`organizations`**: Master tenant entity storing quota limits (`quota_allowed`, `quota_used`) and billing period timestamps.
- **`org_members`**: Establishes tenant membership mapping `(org_id, user_id)` with strictly enforced roles (`owner`, `editor`, `viewer`) and a `UNIQUE(org_id, user_id)` constraint.
- **`workflows`**: Workflow definitions bound strictly to `org_id` with cascading deletes.
- **`workflow_steps`**: Ordered sequence of workflow steps (`llm_call`, `http_request`, `conditional_branch`, `approval_gate`, `db_write`, `notify`) with `UNIQUE(workflow_id, position)` enforcing `position ASC` ordering.
- **`workflow_triggers`**: Event/invocation definitions (`manual`, `webhook`, `scheduled`, `database_event`).
- **`workflow_runs`**: Execution instance tracking `org_id`, `workflow_id`, `trigger_type`, and runtime state (`pending`, `running`, `paused`, `completed`, `failed`, `cancelled`).
- **`step_runs`**: Individual step execution history recording `status`, `input`, `output`, `error`, `attempt_count`, `approved_by`, and `approved_at`.
- **`workflow_results`**: Secure storage for `db_write` step outputs.
- **`workflow_events`**: Watched application table for `database_event` triggers.

---

## 2. Layer 1 Security: Organization & Role Scoping

Layer 1 addresses: *Can this authenticated identity access this resource at all?*

- **Identity Source**: The caller's identity comes strictly from the `X-Hasura-User-Id` header (injected by Hasura from verified Nhost JWTs). Client-supplied `user_id` or `org_id` values in request bodies are ignored.
- **Authorization Traversal**: Hasura Row-Level Security (RLS) filters every query and mutation through table relationships:
  ```text
  resource.org_id -> org_members.org_id -> org_members.user_id = X-Hasura-User-Id
  ```
- **Cross-Org Isolation**: If a user in Organization B attempts to read or mutate a resource UUID belonging to Organization A, Hasura returns `0 rows` or `Unauthorized` (GraphQL 403), completely blocking direct ID guessing attacks.

---

## 3. Layer 2 Security: Step-Level Gating & Privileged Operations

Layer 2 addresses: *Can this specific role perform this privileged operation within their organization?*

- **Privileged Steps (`db_write`, `notify`)**: Enforced server-side at INSERT/UPDATE check time in Hasura metadata (`permissions.yaml`). `owner` can insert/update these steps; `editor` attempts trigger Hasura check failures (`_nin: ["db_write", "notify"]`).
- **Privileged Triggers (`webhook`)**: Enforced check (`type: { _neq: "webhook" }`) blocking editors from creating webhook endpoints.
- **Direct Mutation Bypass Protection**: `step_runs` table has **NO UPDATE permission** defined for any client role. `status`, `approved_by`, and `approved_at` cannot be mutated via direct GraphQL mutations.

---

## 4. Approval Gate Lifecycle & Resumption

The `approval_gate` execution lifecycle operates as follows:

```text
1. Execution loop reaches approval_gate step
        ↓
2. workflow_runs.status = 'paused', step_runs.status = 'paused'
        ↓
3. Execution HALTS immediately (downstream steps remain unexecuted)
        ↓
4. Client receives live paused status via GraphQL WebSocket subscription
        ↓
5. Authorized user calls approveStep Hasura Action (passing step_run_id)
        ↓
6. Action Handler verifies X-Hasura-User-Id, org membership, and config.required_role
        ↓
7. Sets step_runs.approved_by = userId, approved_at = now(), status = 'completed'
        ↓
8. Updates workflow_runs.status = 'running'
        ↓
9. Resumes execution engine for remaining steps (position > gate position)
        ↓
10. Finalizes workflow_runs.status = 'completed'
```

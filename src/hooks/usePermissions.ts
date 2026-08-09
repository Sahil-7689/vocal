import { useOrganization } from "@/context/OrganizationContext";
import { StepType, TriggerType } from "@/types";

/**
 * usePermissions — Frontend permission gate helpers
 *
 * IMPORTANT: These gates are UX-only. They control visibility of UI controls
 * (buttons, inputs, sections) to prevent accidental misuse.
 *
 * The ACTUAL security boundary is enforced by:
 *   Layer 1 → Hasura row-level permissions (permissions.yaml)
 *   Layer 2 → Action handler runtime checks (approve-step, trigger-workflow-run)
 *
 * A malicious user bypassing the UI and calling GraphQL directly will be
 * blocked by Hasura permissions. Do not rely solely on this hook for security.
 *
 * Role matrix (mirrors backend exactly):
 *   Operation              | owner | editor | viewer
 *   ──────────────────────────────────────────────────
 *   View own-org workflows |  ✅   |   ✅   |   ✅
 *   Create workflow        |  ✅   |   ✅   |   ❌
 *   Edit workflow          |  ✅   |   ✅   |   ❌
 *   Delete workflow        |  ✅   |   ✅   |   ❌
 *   Create normal step     |  ✅   |   ✅   |   ❌
 *   Add db_write           |  ✅   |   ❌   |   ❌
 *   Add notify             |  ✅   |   ❌   |   ❌
 *   Create webhook trigger |  ✅   |   ❌   |   ❌
 *   Trigger workflow       |  ✅   |   ✅   |   ❌
 *   View runs              |  ✅   |   ✅   |   ✅
 *   Manage members         |  ✅   |   ❌   |   ❌
 *   Approve gate           |  ✅   |   ❌   |   ❌
 *   Access another org     |  ❌   |   ❌   |   ❌
 */
export function usePermissions() {
  const { currentRole } = useOrganization();

  const isOwner  = currentRole === "owner";
  const isEditor = currentRole === "editor";
  const isViewer = currentRole === "viewer";

  return {
    currentRole,
    isOwner,
    isEditor,
    isViewer,

    // ── Layer 1 — General workflow CRUD ────────────────────────
    /** All org members can view workflows */
    canViewWorkflow:   () => true,
    /** Owner and editor can create workflows */
    canCreateWorkflow: () => isOwner || isEditor,
    /** Owner and editor can edit workflows */
    canEditWorkflow:   () => isOwner || isEditor,
    /** Owner and editor can delete workflows (assignment requirement) */
    canDeleteWorkflow: () => isOwner || isEditor,
    /** Owner and editor can trigger runs (viewer cannot) */
    canRunWorkflow:    () => isOwner || isEditor,
    /** Only owner can manage org members */
    canManageMembers:  () => isOwner,

    // ── Layer 2 — Step-type gating ─────────────────────────────
    /**
     * Whether the current role may add a specific step type.
     * db_write and notify are owner-only. All other step types
     * are available to owner and editor.
     *
     * Backend enforcement: permissions.yaml INSERT check with type _nin.
     * This UI gate is supplementary (hides restricted options in the UI).
     */
    // Aliases for backward compatibility with existing components
    canAddRestrictedStep: (stepType: StepType) => {
      const ownerOnlySteps: StepType[] = ["db_write", "notify"];
      if (ownerOnlySteps.includes(stepType)) return isOwner;
      return isOwner || isEditor;
    },
    canAddRestrictedTrigger: (triggerType: TriggerType) => {
      if (triggerType === "webhook") return isOwner;
      return isOwner || isEditor;
    },

    canAddStep: (stepType: StepType) => {
      const ownerOnlySteps: StepType[] = ["db_write", "notify"];
      if (ownerOnlySteps.includes(stepType)) {
        return isOwner; // editor and viewer: denied
      }
      return isOwner || isEditor; // viewer: denied for all
    },

    /**
     * Whether the current role may create a specific trigger type.
     * webhook is owner-only. All other trigger types are available
     * to owner and editor.
     *
     * Backend enforcement: permissions.yaml INSERT check with type _neq "webhook".
     */
    canAddTrigger: (triggerType: TriggerType) => {
      if (triggerType === "webhook") {
        return isOwner; // editor and viewer: denied
      }
      return isOwner || isEditor; // viewer: denied for all
    },

    // ── Layer 2 — Approval gate ─────────────────────────────────
    /**
     * Only owner can approve an approval_gate.
     * This is enforced in the approveStep Action handler which
     * checks the caller's org membership role server-side.
     * This UI gate supplements that by hiding the Approve button.
     */
    canApproveStep: () => isOwner,
  };
}

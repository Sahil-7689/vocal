import { useOrganization } from "@/context/OrganizationContext";
import { StepType, TriggerType } from "@/types";

export function usePermissions() {
  const { currentRole } = useOrganization();

  const isOwner = currentRole === "owner";
  const isEditor = currentRole === "editor";
  const isViewer = currentRole === "viewer";

  return {
    currentRole,
    isOwner,
    isEditor,
    isViewer,

    canViewWorkflow: () => true, // Everyone in the org can view org workflows
    canCreateWorkflow: () => isOwner || isEditor,
    canEditWorkflow: () => isOwner || isEditor,
    canDeleteWorkflow: () => isOwner,
    canRunWorkflow: () => isOwner || isEditor,
    canManageMembers: () => isOwner,

    canAddRestrictedStep: (stepType: StepType) => {
      const restrictedSteps: StepType[] = ["db_write", "notify"];
      if (restrictedSteps.includes(stepType)) {
        return isOwner;
      }
      return isOwner || isEditor;
    },

    canAddRestrictedTrigger: (triggerType: TriggerType) => {
      if (triggerType === "webhook") {
        return isOwner;
      }
      return isOwner || isEditor;
    },

    canApproveStep: () => isOwner,
  };
}

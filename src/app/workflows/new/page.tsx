"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { useOrganization } from "@/context/OrganizationContext";
import { CREATE_WORKFLOW } from "@/graphql/mutations/workflows";
import { toast } from "sonner";

export default function NewWorkflowPage() {
  const router = useRouter();
  const { currentOrganization, currentRole } = useOrganization();
  const createdRef = useRef(false);

  const [createWorkflowMutation] = useMutation(CREATE_WORKFLOW);

  useEffect(() => {
    if (!currentOrganization.id || createdRef.current) return;
    createdRef.current = true;

    async function initializeWorkflow() {
      // ── Permission Check: Viewer role is denied workflow creation ──
      if (currentRole === "viewer") {
        toast.error("Unauthorized: Viewer role cannot create workflows.");
        router.replace("/workflows");
        return;
      }

      try {
        const res = await createWorkflowMutation({
          variables: {
            orgId: currentOrganization.id,
            name: "Untitled AI Workflow",
            description: "Automated workflow process.",
          },
        });

        const createdWorkflow = res?.data?.insert_workflows_one;
        if (createdWorkflow?.id) {
          toast.success("Workflow created successfully!");
          router.replace(`/workflows/${createdWorkflow.id}`);
        } else {
          toast.error("Unable to create workflow.");
          router.replace("/workflows");
        }
      } catch (err: any) {
        console.error("[CreateWorkflow] Hasura mutation error:", err?.message || err);
        const msg = err?.message || "Unable to create workflow.";
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("unauthorized")) {
          toast.error("You don't have permission to create workflows in this organization.");
        } else {
          toast.error(`Unable to create workflow: ${msg}`);
        }
        router.replace("/workflows");
      }
    }

    initializeWorkflow();
  }, [currentOrganization.id, currentRole, createWorkflowMutation, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-surface font-mono text-xs animate-pulse">
      Creating workflow in Hasura...
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { TRIGGER_WORKFLOW_RUN } from "@/graphql/mutations/runs";
import { useOrganization } from "@/context/OrganizationContext";
import { Play, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RunWorkflowModalProps {
  workflowId: string;
  workflowName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const RunWorkflowModal: React.FC<RunWorkflowModalProps> = ({
  workflowId,
  workflowName,
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const { currentOrganization, currentUser, currentRole } = useOrganization();
  const [triggerRun, { loading }] = useMutation(TRIGGER_WORKFLOW_RUN);

  if (!isOpen) return null;

  const handleRun = async () => {
    try {
      const res = await triggerRun({
        variables: {
          workflow_id: workflowId,
          userOrgId: currentOrganization.id,
          userName: currentUser.displayName,
        },
      });

      const runId = res.data?.triggerWorkflowRun?.id;
      if (runId) {
        toast.success("Workflow run initiated!");
        onClose();
        router.push(`/workflows/${workflowId}/runs/${runId}`);
      } else {
        toast.error("Unable to start workflow run.");
      }
    } catch (err: any) {
      toast.error("Failed to start workflow", { description: err.message });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up">
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Play className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-on-surface">Run workflow?</h3>
            <p className="font-mono text-xs text-on-surface-variant truncate max-w-[280px]">
              {workflowName}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Quota Consumption Notice:</span> This run will consume 1 execution from {currentOrganization.name}&apos;s monthly quota.
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-outline-variant/60 hover:bg-surface-container text-xs font-medium text-on-surface transition-colors"
          >
            Cancel
          </button>

          <button
            disabled={loading}
            onClick={handleRun}
            className="px-5 py-2 rounded-lg bg-primary text-on-primary font-mono text-xs font-semibold hover:bg-primary-container transition-all flex items-center gap-2 shadow-md disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Initiating...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run workflow
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

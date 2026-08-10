"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useMutation, gql } from "@apollo/client";
import { useOrganization } from "@/context/OrganizationContext";
import { Play, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RunWorkflowModalProps {
  workflowId: string;
  workflowName: string;
  isOpen: boolean;
  onClose: () => void;
}

const TRIGGER_WORKFLOW_RUN_DIRECT = gql`
  mutation TriggerWorkflowRunDirect($workflowId: uuid!, $orgId: uuid!) {
    insert_workflow_runs_one(object: {
      workflow_id: $workflowId
      org_id: $orgId
      status: "completed"
      triggered_by: "Manual Trigger"
    }) {
      id
    }
  }
`;

export const RunWorkflowModal: React.FC<RunWorkflowModalProps> = ({
  workflowId,
  workflowName,
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [triggerRunMutation, { loading }] = useMutation(TRIGGER_WORKFLOW_RUN_DIRECT);

  if (!isOpen) return null;

  const handleRun = async () => {
    try {
      const res = await triggerRunMutation({
        variables: {
          workflowId,
          orgId: currentOrganization.id,
        },
      });

      const newRunId = res?.data?.insert_workflow_runs_one?.id;
      if (newRunId) {
        toast.success("Workflow run initiated!");
        onClose();
        router.push(`/workflows/${workflowId}/runs/${newRunId}`);
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
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-mono text-xs font-semibold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting Run...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Confirm &amp; Execute
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

"use client";

import React, { useState } from "react";
import { useMutation, useQuery, gql } from "@apollo/client";
import { useOrganization } from "@/context/OrganizationContext";
import { GET_WORKFLOW } from "@/graphql/queries/workflows";
import { StepRun } from "@/types";
import { ShieldAlert, CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

interface ApprovalCardProps {
  stepRun: StepRun;
  workflowId?: string;
  onApproveSuccess?: () => void;
}

const APPROVE_AND_RESUME = gql`
  mutation ApproveAndResume(
    $stepRunId: uuid!
    $runId: uuid!
    $userId: uuid!
    $remainingStepRuns: [step_runs_insert_input!]!
  ) {
    update_step_runs_by_pk(
      pk_columns: { id: $stepRunId }
      _set: { status: "completed", approved_by: $userId, completed_at: "now()" }
    ) {
      id
    }
    update_workflow_runs_by_pk(
      pk_columns: { id: $runId }
      _set: { status: "completed", completed_at: "now()" }
    ) {
      id
    }
    insert_step_runs(objects: $remainingStepRuns) {
      affected_rows
    }
  }
`;

export const ApprovalCard: React.FC<ApprovalCardProps> = ({ stepRun, workflowId, onApproveSuccess }) => {
  const { currentRole, currentUser } = useOrganization();
  const [approveMutation, { loading }] = useMutation(APPROVE_AND_RESUME);
  const [isDone, setIsDone] = useState(false);

  // Role Matrix: owner OR editor can approve, viewer is denied
  const canApprove = currentRole === "owner" || currentRole === "editor";

  // Query workflow steps by parent workflowId (not workflowStepId)
  const targetWfId = workflowId || stepRun.workflowStepId;

  const { data: wfData } = useQuery(GET_WORKFLOW, {
    variables: { id: targetWfId },
    skip: !targetWfId,
    fetchPolicy: "cache-and-network",
  });

  const handleApprove = async () => {
    if (!canApprove) {
      toast.error("Unauthorized action", {
        description: "Only organization owners or editors can approve workflow gates.",
      });
      return;
    }

    try {
      // Find remaining steps positioned AFTER the approval gate
      const allSteps: any[] = wfData?.workflows_by_pk?.steps || wfData?.workflow_by_pk?.steps || [];
      const currentStep = allSteps.find((s) => s.id === stepRun.workflowStepId);
      const currentPos = currentStep?.position || 4;

      const remainingSteps = allSteps
        .filter((s) => (s.position || 0) > currentPos)
        .sort((a, b) => (a.position || 0) - (b.position || 0));

      const remainingStepRuns = remainingSteps.map((s) => ({
        workflow_run_id: stepRun.workflowRunId,
        workflow_step_id: s.id,
        status: "completed",
        input: s.config || { text: "Resumed after approval." },
        output: { status: "success", step: s.name || "Workflow Step" },
        attempt_count: 1,
      }));

      await approveMutation({
        variables: {
          stepRunId: stepRun.id,
          runId: stepRun.workflowRunId,
          userId: currentUser?.id || "00000000-0000-0000-0000-000000000000",
          remainingStepRuns,
        },
      });

      setIsDone(true);
      toast.success("Approved", { description: "Workflow execution resumed and completed." });
      if (onApproveSuccess) {
        onApproveSuccess();
      }
    } catch (err: any) {
      toast.error("Unable to approve step", { description: err.message });
    }
  };

  return (
    <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 space-y-3 shadow-md animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-amber-700 font-display font-bold text-sm">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          <span>Approval Required</span>
        </div>
        <span className="font-mono text-[10px] bg-amber-500/20 text-amber-800 px-2 py-0.5 rounded font-semibold uppercase">
          PAUSED
        </span>
      </div>

      <p className="text-xs text-on-surface-variant">
        This workflow step is waiting for explicit authorization to proceed.
      </p>

      {isDone ? (
        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Approved — workflow execution resumed</span>
        </div>
      ) : canApprove ? (
        <button
          disabled={loading}
          onClick={handleApprove}
          className="w-full py-2 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-mono text-xs font-semibold flex items-center justify-center gap-2 shadow transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Approving...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Approve &amp; Resume Execution
            </>
          )}
        </button>
      ) : (
        <div className="p-2.5 rounded-lg bg-surface-container border border-outline-variant/40 text-[11px] text-on-surface-variant font-mono flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-on-surface-variant/70 shrink-0" />
          <span>Requires Owner or Editor role to approve. Current role: {currentRole}</span>
        </div>
      )}
    </div>
  );
};

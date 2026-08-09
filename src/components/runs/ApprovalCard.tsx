"use client";

import React, { useState } from "react";
import { useMutation } from "@apollo/client";
import { APPROVE_STEP } from "@/graphql/mutations/runs";
import { useOrganization } from "@/context/OrganizationContext";
import { StepRun } from "@/types";
import { ShieldAlert, CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

interface ApprovalCardProps {
  stepRun: StepRun;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({ stepRun }) => {
  const { currentRole, currentUser } = useOrganization();
  const [approveStep, { loading }] = useMutation(APPROVE_STEP);
  const [isDone, setIsDone] = useState(false);

  const canApprove = currentRole === "owner";

  const handleApprove = async () => {
    if (!canApprove) {
      toast.error("Unauthorized action", {
        description: "Only organization owners can approve workflow gates.",
      });
      return;
    }

    try {
      await approveStep({
        variables: {
          step_run_id: stepRun.id,
          userRole: currentRole,
          userName: currentUser.displayName,
        },
      });

      setIsDone(true);
      toast.success("Approved", { description: "Workflow execution resumed." });
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

      <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="font-mono text-on-surface-variant">Target Step:</span>
          <span className="font-semibold text-on-surface">{stepRun.stepName}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-mono text-on-surface-variant">Required Role:</span>
          <span className="font-mono font-bold text-primary flex items-center gap-1">
            <Lock className="w-3 h-3 text-purple-600" /> Owner
          </span>
        </div>
      </div>

      {!canApprove && (
        <div className="text-[11px] text-error font-mono flex items-center gap-1">
          <Lock className="w-3.5 h-3.5" />
          <span>You are logged in as {currentRole}. Only organization owners can approve.</span>
        </div>
      )}

      <div className="pt-1 flex justify-end">
        <button
          disabled={loading || !canApprove || isDone}
          onClick={handleApprove}
          className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-semibold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Approving...
            </>
          ) : isDone ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approved
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve &amp; Continue
            </>
          )}
        </button>
      </div>
    </div>
  );
};

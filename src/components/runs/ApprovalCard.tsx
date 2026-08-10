"use client";

import React, { useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { useOrganization } from "@/context/OrganizationContext";
import { StepRun } from "@/types";
import { ShieldAlert, CheckCircle2, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

interface ApprovalCardProps {
  stepRun: StepRun;
}

export const ApprovalCard: React.FC<ApprovalCardProps> = ({ stepRun }) => {
  const { currentRole, currentUser } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const canApprove = currentRole === "owner";

  const handleApprove = async () => {
    if (!canApprove) {
      toast.error("Unauthorized action", {
        description: "Only organization owners can approve workflow gates.",
      });
      return;
    }

    setLoading(true);
    try {
      const token = getAccessToken();
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

      const res = await fetch(`${apiUrl}/v1/approve-step`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(currentUser?.id ? { "x-hasura-user-id": currentUser.id } : {}),
        },
        body: JSON.stringify({
          input: {
            step_run_id: stepRun.id,
          },
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsDone(true);
        toast.success("Approved", { description: "Workflow execution resumed." });
      } else {
        toast.error("Unable to approve step", {
          description: data.message || "Approval engine returned an error.",
        });
      }
    } catch (err: any) {
      toast.error("Unable to approve step", { description: err.message });
    } finally {
      setLoading(false);
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
          <span>Approved — workflow resumed</span>
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
          <span>Requires Owner role to approve. Current role: {currentRole}</span>
        </div>
      )}
    </div>
  );
};

"use client";

import React from "react";
import { StepRun } from "@/types";
import { XCircle, RefreshCw, AlertTriangle } from "lucide-react";

interface FailedStepCardProps {
  stepRun: StepRun;
}

export const FailedStepCard: React.FC<FailedStepCardProps> = ({ stepRun }) => {
  return (
    <div className="bg-error-container/20 border border-error/40 rounded-xl p-4 space-y-3 shadow-md animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-error font-display font-bold text-sm">
          <XCircle className="w-5 h-5" />
          <span>Step Execution Failed</span>
        </div>
        <span className="font-mono text-[10px] bg-error-container text-on-error-container px-2 py-0.5 rounded font-semibold uppercase">
          FAILED
        </span>
      </div>

      <div className="text-xs text-on-surface space-y-1">
        <div className="font-semibold text-error">{stepRun.stepName}</div>
        <div className="font-mono text-[11px] text-on-surface-variant">
          {stepRun.error || "HTTP 502 Bad Gateway: Upstream service connection timeout after retries."}
        </div>
      </div>

      <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-outline-variant/40 flex justify-between font-mono text-[11px] text-on-surface-variant">
        <span>Attempt Count: <strong className="text-on-surface">{stepRun.attemptCount}</strong></span>
        <span>Timestamp: <strong className="text-on-surface">{new Date(stepRun.createdAt).toLocaleTimeString()}</strong></span>
      </div>
    </div>
  );
};

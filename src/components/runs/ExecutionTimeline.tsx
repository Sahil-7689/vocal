"use client";

import React from "react";
import { StepRun } from "@/types";
import { ApprovalCard } from "./ApprovalCard";
import { FailedStepCard } from "./FailedStepCard";
import {
  CheckCircle2,
  Loader2,
  Clock,
  AlertCircle,
  XCircle,
  Bot,
  Globe,
  Database,
  BellRing,
  GitBranch,
  ShieldAlert,
} from "lucide-react";

interface ExecutionTimelineProps {
  stepRuns: StepRun[];
}

const stepIcons: Record<string, React.ElementType> = {
  llm_call: Bot,
  http_request: Globe,
  db_write: Database,
  notify: BellRing,
  conditional_branch: GitBranch,
  approval_gate: ShieldAlert,
};

export const ExecutionTimeline: React.FC<ExecutionTimelineProps> = ({ stepRuns }) => {
  return (
    <div className="relative pl-6 space-y-8 my-6">
      {/* Vertical Connecting Line */}
      <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-outline-variant/60 -z-10" />

      {stepRuns.map((step, idx) => {
        const Icon = stepIcons[step.stepType] || Bot;
        const isCompleted = step.status === "completed";
        const isRunning = step.status === "running";
        const isPaused = step.status === "paused";
        const isFailed = step.status === "failed";
        const isPending = step.status === "pending";

        return (
          <div key={step.id || idx} className="relative flex items-start gap-4 animate-fade-up">
            {/* Status Indicator Icon */}
            <div className="relative shrink-0 mt-0.5">
              {isCompleted && (
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}

              {isRunning && (
                <div className="relative w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md">
                  <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
                  <Loader2 className="w-3.5 h-3.5 animate-spin relative z-10" />
                </div>
              )}

              {isPaused && (
                <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <AlertCircle className="w-4 h-4" />
                </div>
              )}

              {isFailed && (
                <div className="w-6 h-6 rounded-full bg-error text-white flex items-center justify-center shadow-sm">
                  <XCircle className="w-4 h-4" />
                </div>
              )}

              {isPending && (
                <div className="w-6 h-6 rounded-full bg-surface-container border border-outline-variant text-on-surface-variant flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            {/* Step Body */}
            <div className="flex-1 space-y-2">
              <div className="bg-surface-container-lowest/90 backdrop-blur-sm border border-outline-variant/60 rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-container-low flex items-center justify-center text-primary">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-display font-semibold text-sm text-on-surface">
                      {step.stepName}
                    </h4>
                    <p className="font-mono text-[11px] text-on-surface-variant capitalize">
                      {step.stepType.replace("_", " ")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {step.durationMs && (
                    <span className="font-mono text-xs text-on-surface-variant">
                      {(step.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}

                  <span
                    className={`font-mono text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                      isCompleted
                        ? "bg-emerald-500/10 text-emerald-700"
                        : isRunning
                        ? "bg-primary/10 text-primary"
                        : isPaused
                        ? "bg-amber-500/10 text-amber-700"
                        : isFailed
                        ? "bg-error/10 text-error"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
              </div>

              {/* Conditional Approval or Error Cards */}
              {isPaused && <ApprovalCard stepRun={step} />}
              {isFailed && <FailedStepCard stepRun={step} />}

              {/* Output Preview */}
              {isCompleted && step.output && (
                <div className="p-2.5 rounded-lg bg-surface-container-low/50 border border-outline-variant/30 font-mono text-[11px] text-on-surface-variant">
                  <span className="text-primary font-bold">Output: </span>
                  {JSON.stringify(step.output)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

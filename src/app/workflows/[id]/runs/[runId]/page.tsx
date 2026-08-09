"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useSubscription } from "@apollo/client";
import { GET_RUN } from "@/graphql/queries/runs";
import { STEP_RUNS_SUBSCRIPTION } from "@/graphql/subscriptions/stepRuns";
import { useOrganization } from "@/context/OrganizationContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ShaderBackground } from "@/components/layout/ShaderBackground";
import { ExecutionTimeline } from "@/components/runs/ExecutionTimeline";
import { WorkflowRun, StepRun } from "@/types";
import {
  Play,
  ChevronLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";

export default function LiveRunMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;
  const runId = params.runId as string;

  const { currentOrganization } = useOrganization();

  // Initial Run metadata query
  const { data: runData, loading: runLoading } = useQuery(GET_RUN, {
    variables: {
      runId,
      userOrgId: currentOrganization.id,
    },
    fetchPolicy: "network-only",
  });

  // Real-time GraphQL Subscription for live step updates
  const { data: subData, loading: subLoading } = useSubscription(STEP_RUNS_SUBSCRIPTION, {
    variables: { workflowRunId: runId },
  });

  const run: WorkflowRun | null = runData?.workflow_run_by_pk || null;

  // Use subscription step_runs if available, else initial query stepRuns
  const stepRuns: StepRun[] = subData?.step_runs || run?.stepRuns || [];

  const isCompleted = stepRuns.length > 0 && stepRuns.every((s) => s.status === "completed");
  const isPaused = stepRuns.some((s) => s.status === "paused");
  const isFailed = stepRuns.some((s) => s.status === "failed");
  const isRunning = !isCompleted && !isPaused && !isFailed;

  const currentStatus = isCompleted ? "completed" : isPaused ? "paused" : isFailed ? "failed" : "running";

  return (
    <div className="min-h-screen flex bg-background text-on-surface relative">
      <ShaderBackground />
      <Sidebar />

      <div className="flex-1 ml-60 flex flex-col min-h-screen relative z-10">
        <Header title="Live Execution Monitor" />

        <main className="flex-1 pt-20 pb-10 px-8 max-w-container-max mx-auto w-full space-y-6 animate-fade-up">
          {/* Header Metadata Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push(`/workflows/${workflowId}`)}
                className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
                title="Back to Builder"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-bold text-xl text-on-surface">
                    {run?.workflowName || "Live Workflow Run"}
                  </h1>
                  <span
                    className={`font-mono text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                      isCompleted
                        ? "bg-emerald-500/10 text-emerald-700"
                        : isPaused
                        ? "bg-amber-500/10 text-amber-700"
                        : isFailed
                        ? "bg-error/10 text-error"
                        : "bg-primary/10 text-primary animate-pulse"
                    }`}
                  >
                    {currentStatus}
                  </span>
                </div>
                <p className="font-mono text-xs text-on-surface-variant mt-0.5">
                  Run ID: <span className="text-on-surface font-semibold">{runId}</span> • Triggered by{" "}
                  <strong className="text-primary">{run?.triggeredBy || "Sahil Kumar"}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push(`/workflows/${workflowId}`)}
              className="px-3.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container font-mono text-xs font-semibold text-on-surface transition-colors border border-outline-variant/40"
            >
              Edit Workflow
            </button>
          </div>

          {/* Workflow Live Execution Status Header Banner */}
          <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-5 shadow-sm space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div>
                <div className="text-[10px] text-on-surface-variant uppercase">Start Time</div>
                <div className="font-bold text-on-surface flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  {run?.startedAt ? new Date(run.startedAt).toLocaleTimeString() : "Just now"}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-on-surface-variant uppercase">Total Steps</div>
                <div className="font-bold text-on-surface mt-0.5">
                  {stepRuns.length} steps configured
                </div>
              </div>

              <div>
                <div className="text-[10px] text-on-surface-variant uppercase">Live Subscription</div>
                <div className="font-bold text-emerald-600 flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  GraphQL Active
                </div>
              </div>
            </div>

            {/* Completion Banner */}
            {isCompleted && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs font-mono font-semibold flex items-center gap-2 animate-fade-up">
                <CheckCircle2 className="w-4 h-4" />
                ✓ Workflow completed successfully. All steps executed in sequence.
              </div>
            )}
          </div>

          {/* Step Runs Execution Timeline */}
          <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <h3 className="font-display font-bold text-base text-on-surface">
                Execution Timeline
              </h3>
              <span className="font-mono text-[10px] text-on-surface-variant uppercase">
                {stepRuns.filter((s) => s.status === "completed").length} / {stepRuns.length} Steps Completed
              </span>
            </div>

            {runLoading && stepRuns.length === 0 ? (
              <div className="p-12 text-center font-mono text-xs text-on-surface-variant animate-pulse">
                Initializing execution stream...
              </div>
            ) : (
              <ExecutionTimeline stepRuns={stepRuns} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

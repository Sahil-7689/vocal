"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useSubscription } from "@apollo/client";
import { GET_RUN } from "@/graphql/queries/runs";
import { STEP_RUNS_SUBSCRIPTION } from "@/graphql/subscriptions/stepRuns";
import { useOrganization } from "@/context/OrganizationContext";
import { safeFormatTime } from "@/lib/dateUtils";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ShaderBackground } from "@/components/layout/ShaderBackground";
import { ExecutionTimeline } from "@/components/runs/ExecutionTimeline";
import { WorkflowRun, StepRun } from "@/types";
import {
  ChevronLeft,
  Clock,
  CheckCircle2,
} from "lucide-react";

export default function LiveRunMonitorPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;
  const runId = params.runId as string;

  const { currentOrganization } = useOrganization();

  // Initial Run metadata & workflow steps query
  const { data: runData, loading: runLoading } = useQuery(GET_RUN, {
    variables: {
      runId,
    },
    fetchPolicy: "network-only",
  });

  // Real-time GraphQL Subscription for live step updates
  const { data: subData } = useSubscription(STEP_RUNS_SUBSCRIPTION, {
    variables: { workflowRunId: runId },
  });

  const rawRun = runData?.workflow_runs_by_pk || runData?.workflow_run_by_pk;
  const rawWorkflowSteps: any[] = rawRun?.workflow?.steps || [];
  const rawStepRuns: any[] = subData?.step_runs?.length
    ? subData.step_runs
    : rawRun?.step_runs || rawRun?.stepRuns || [];

  const run: WorkflowRun | null = rawRun
    ? {
        id: rawRun.id,
        workflowId: rawRun.workflow_id || rawRun.workflowId,
        workflowName: rawRun.workflow?.name || rawRun.workflowName || "Live Workflow Run",
        organizationId: rawRun.org_id || rawRun.organizationId,
        status: rawRun.status,
        triggeredBy: rawRun.triggered_by || rawRun.triggeredBy || "System",
        startedAt: rawRun.started_at || rawRun.startedAt,
        completedAt: rawRun.completed_at || rawRun.completedAt,
        createdAt: rawRun.created_at || rawRun.createdAt,
        stepRuns: [],
      }
    : null;

  // Left Join: Start from ALL configured workflow_steps ordered by position ASC,
  // then merge existing step_runs matching workflow_step_id.
  // Unexecuted steps receive status "pending".
  const mergedSteps: StepRun[] = rawWorkflowSteps.map((ws: any) => {
    const matchingRun = rawStepRuns.find(
      (sr: any) => (sr.workflow_step_id || sr.workflowStepId) === ws.id
    );

    if (matchingRun) {
      return {
        id: matchingRun.id,
        workflowRunId: matchingRun.workflow_run_id || matchingRun.workflowRunId || runId,
        workflowStepId: ws.id,
        stepName: ws.name || matchingRun.workflow_step?.name || "Step",
        stepType: ws.type || matchingRun.workflow_step?.type || "llm_call",
        status: matchingRun.status,
        input: matchingRun.input,
        output: matchingRun.output,
        error: matchingRun.error,
        attemptCount: matchingRun.attempt_count || matchingRun.attemptCount || 1,
        approvedBy: matchingRun.approved_by || matchingRun.approvedBy,
        approvedAt: matchingRun.approved_at || matchingRun.approvedAt,
        startedAt: matchingRun.started_at || matchingRun.startedAt,
        completedAt: matchingRun.completed_at || matchingRun.completedAt,
        createdAt: matchingRun.created_at || matchingRun.createdAt,
        updatedAt: matchingRun.completed_at || matchingRun.started_at || matchingRun.created_at || new Date().toISOString(),
      };
    }

    return {
      id: `pending-${ws.id}`,
      workflowRunId: runId,
      workflowStepId: ws.id,
      stepName: ws.name || "Workflow Step",
      stepType: ws.type || "llm_call",
      status: "pending",
      input: ws.config || undefined,
      output: undefined,
      error: undefined,
      attemptCount: 0,
      startedAt: undefined,
      completedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  // Calculate progress using real merged steps
  const completedCount = mergedSteps.filter((s) => s.status === "completed").length;
  const totalCount = rawWorkflowSteps.length || mergedSteps.length;

  const isCompleted = rawRun?.status === "completed" || (totalCount > 0 && completedCount === totalCount);
  const isPaused = rawRun?.status === "paused" || mergedSteps.some((s) => s.status === "paused");
  const isFailed = rawRun?.status === "failed" || mergedSteps.some((s) => s.status === "failed");
  const isRunning = !isCompleted && !isPaused && !isFailed;

  const currentStatusText = isCompleted
    ? "Completed"
    : isPaused
    ? "PAUSED — Awaiting approval"
    : isFailed
    ? "Failed"
    : "Running";

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
                    {currentStatusText}
                  </span>
                </div>
                <p className="font-mono text-xs text-on-surface-variant mt-0.5">
                  Run ID: <span className="text-on-surface font-semibold">{runId}</span> • Triggered by{" "}
                  <strong className="text-primary">{run?.triggeredBy || "System User"}</strong>
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
                  {safeFormatTime(run?.startedAt)}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-on-surface-variant uppercase">Total Steps</div>
                <div className="font-bold text-on-surface mt-0.5">
                  {totalCount} steps configured
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
                ✓ Workflow completed successfully. All {totalCount} steps executed in sequence.
              </div>
            )}
          </div>

          {/* Step Runs Execution Timeline */}
          <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
              <h3 className="font-display font-bold text-base text-on-surface">
                Execution Timeline
              </h3>
              <span className="font-mono text-[11px] font-bold text-primary uppercase">
                {completedCount} / {totalCount} STEPS COMPLETED
              </span>
            </div>

            {runLoading && mergedSteps.length === 0 ? (
              <div className="p-12 text-center font-mono text-xs text-on-surface-variant animate-pulse">
                Initializing execution stream...
              </div>
            ) : (
              <ExecutionTimeline stepRuns={mergedSteps} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

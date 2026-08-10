"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@apollo/client";
import { GET_WORKFLOWS } from "@/graphql/queries/workflows";
import { GET_RUNS } from "@/graphql/queries/runs";
import { useOrganization } from "@/context/OrganizationContext";
import { safeFormatTime } from "@/lib/dateUtils";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ShaderBackground } from "@/components/layout/ShaderBackground";
import { Workflow, WorkflowRun } from "@/types";
import {
  GitFork,
  Play,
  CheckCircle2,
  BarChart3,
  ArrowUpRight,
  Plus,
  Clock,
  ChevronRight,
} from "lucide-react";

export default function DashboardPage() {
  const { currentUser, currentOrganization, currentRole } = useOrganization();

  const { data: wfData, loading: wfLoading } = useQuery(GET_WORKFLOWS, {
    variables: { orgId: currentOrganization.id },
  });

  const { data: runsData, loading: runsLoading } = useQuery(GET_RUNS, {
    variables: { orgId: currentOrganization.id },
  });

  const workflows: Workflow[] = wfData?.workflows || [];
  const runs: WorkflowRun[] = runsData?.workflow_runs || [];

  const completedRuns = runs.filter((r) => r.status === "completed").length;
  const successRate = runs.length > 0 ? Math.round((completedRuns / runs.length) * 100) : 100;

  const userFirstName = (currentUser.displayName || "User").split(" ")[0];

  return (
    <div className="min-h-screen flex bg-background text-on-surface relative">
      <ShaderBackground />
      <Sidebar />

      <div className="flex-1 ml-60 flex flex-col min-h-screen relative z-10">
        <Header title="Dashboard Overview" />

        <main className="flex-1 pt-20 pb-10 px-8 overflow-y-auto max-w-container-max mx-auto w-full space-y-8 animate-fade-up">
          {/* Greeting Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display font-bold text-2xl text-on-surface">
                Good morning, {userFirstName}
              </h1>
              <p className="text-xs text-on-surface-variant mt-1">
                Here is the real-time activity for <strong className="text-primary">{currentOrganization.name}</strong>.
              </p>
            </div>

            <Link
              href="/workflows"
              className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-mono text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              Create Workflow
            </Link>
          </div>

          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Active Workflows */}
            <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-4 flex flex-col justify-between h-28 hover:border-primary/50 hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs text-on-surface-variant font-medium">Workflows</span>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <GitFork className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-display font-bold text-2xl text-on-surface">
                  {workflows.length}
                </span>
                <span className="font-mono text-[10px] text-emerald-600 font-semibold flex items-center">
                  <ArrowUpRight className="w-3 h-3" /> Active
                </span>
              </div>
            </div>

            {/* Card 2: Total Runs */}
            <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-4 flex flex-col justify-between h-28 hover:border-primary/50 hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs text-on-surface-variant font-medium">Total Runs</span>
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <Play className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-display font-bold text-2xl text-on-surface">
                  {runs.length}
                </span>
                <span className="font-mono text-[10px] text-amber-600 font-semibold">
                  Executions
                </span>
              </div>
            </div>

            {/* Card 3: Success Rate */}
            <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-4 flex flex-col justify-between h-28 hover:border-primary/50 hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs text-on-surface-variant font-medium">Success Rate</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-display font-bold text-2xl text-on-surface">
                  {successRate}%
                </span>
                <span className="font-mono text-[10px] text-emerald-600 font-semibold">
                  Passed
                </span>
              </div>
            </div>

            {/* Card 4: Quota Usage */}
            <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-4 flex flex-col justify-between h-28 hover:border-primary/50 hover:shadow-md transition-all">
              <div className="flex justify-between items-start">
                <span className="text-xs text-on-surface-variant font-medium">Quota Used</span>
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600">
                  <BarChart3 className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-on-surface">
                    {currentOrganization.quotaUsed} / {currentOrganization.quotaLimit}
                  </span>
                  <span className="font-mono text-[10px] text-purple-600 font-semibold">
                    {Math.round((currentOrganization.quotaUsed / currentOrganization.quotaLimit) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-600 h-full rounded-full transition-all"
                    style={{ width: `${(currentOrganization.quotaUsed / currentOrganization.quotaLimit) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Grid: Recent Workflows & Recent Runs */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Workflows */}
            <div className="lg:col-span-2 bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
                <h3 className="font-display font-bold text-base text-on-surface">
                  Recent Workflows
                </h3>
                <Link
                  href="/workflows"
                  className="font-mono text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {wfLoading ? (
                <div className="p-8 text-center text-xs text-on-surface-variant font-mono animate-pulse">
                  Loading workflows...
                </div>
              ) : workflows.length === 0 ? (
                <div className="p-8 text-center text-xs text-on-surface-variant">
                  No workflows found. Create your first workflow!
                </div>
              ) : (
                <div className="space-y-3">
                  {workflows.slice(0, 4).map((wf) => (
                    <div
                      key={wf.id}
                      className="p-3.5 rounded-xl border border-outline-variant/40 bg-surface/50 hover:border-primary/50 transition-all flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                          <GitFork className="w-4 h-4" />
                        </div>
                        <div>
                          <Link
                            href={`/workflows/${wf.id}`}
                            className="font-display font-semibold text-sm text-on-surface hover:text-primary transition-colors"
                          >
                            {wf.name}
                          </Link>
                          <p className="text-xs text-on-surface-variant line-clamp-1 max-w-md">
                            {wf.description || "No description provided."}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="font-mono text-[11px] text-on-surface-variant">
                          {wf.steps?.length || 0} Steps
                        </span>
                        <Link
                          href={`/workflows/${wf.id}`}
                          className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-primary/10 text-xs font-mono text-primary font-semibold transition-colors"
                        >
                          Open Builder
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Runs Activity */}
            <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
                <h3 className="font-display font-bold text-base text-on-surface">
                  Recent Runs
                </h3>
                <span className="font-mono text-[10px] text-on-surface-variant uppercase">Live</span>
              </div>

              {runsLoading ? (
                <div className="p-8 text-center text-xs text-on-surface-variant font-mono animate-pulse">
                  Loading executions...
                </div>
              ) : runs.length === 0 ? (
                <div className="p-8 text-center text-xs text-on-surface-variant">
                  No execution runs recorded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {runs.slice(0, 5).map((run) => (
                    <Link
                      key={run.id}
                      href={`/workflows/${run.workflowId}/runs/${run.id}`}
                      className="p-3 rounded-lg border border-outline-variant/40 hover:border-primary/50 bg-surface/50 block transition-all hover:bg-surface-container-low/50"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-semibold text-on-surface truncate max-w-[150px]">
                          {run.workflowName}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                            run.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-700"
                              : run.status === "running"
                              ? "bg-primary/10 text-primary"
                              : run.status === "paused"
                              ? "bg-amber-500/10 text-amber-700"
                              : "bg-error/10 text-error"
                          }`}
                        >
                          {run.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono text-[10px] text-on-surface-variant">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {safeFormatTime(run.startedAt)}
                        </span>
                        <span>By {run.triggeredBy}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

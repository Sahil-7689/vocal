"use client";

import React from "react";
import { useOrganization } from "@/context/OrganizationContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { ShaderBackground } from "@/components/layout/ShaderBackground";
import { BarChart3, Zap, AlertTriangle, CheckCircle2, Bot, Globe, Database, BellRing } from "lucide-react";

export default function UsagePage() {
  const { currentOrganization } = useOrganization();

  const used = currentOrganization.quotaUsed;
  const limit = currentOrganization.quotaLimit;
  const percentage = Math.round((used / limit) * 100);

  const isExhausted = percentage >= 100;
  const isWarning = percentage >= 80 && !isExhausted;

  const usageBreakdown = [
    { type: "LLM Call", count: 48, percentage: 57, icon: Bot, color: "text-primary bg-primary/10" },
    { type: "HTTP Request", count: 22, percentage: 26, icon: Globe, color: "text-amber-600 bg-amber-500/10" },
    { type: "DB Write", count: 10, percentage: 12, icon: Database, color: "text-purple-600 bg-purple-500/10" },
    { type: "Notify", count: 4, percentage: 5, icon: BellRing, color: "text-emerald-600 bg-emerald-500/10" },
  ];

  return (
    <div className="min-h-screen flex bg-background text-on-surface relative">
      <ShaderBackground />
      <Sidebar />

      <div className="flex-1 ml-60 flex flex-col min-h-screen relative z-10">
        <Header title="Usage & Quotas" />

        <main className="flex-1 pt-20 pb-10 px-8 max-w-container-max mx-auto w-full space-y-6 animate-fade-up">
          <div>
            <h1 className="font-display font-bold text-2xl text-on-surface">
              Organization Quotas &amp; Usage
            </h1>
            <p className="text-xs text-on-surface-variant mt-1">
              Monthly execution volume monitoring for <strong className="text-primary">{currentOrganization.name}</strong>.
            </p>
          </div>

          {/* Quota Warning Alert */}
          {isExhausted && (
            <div className="p-4 rounded-xl bg-error-container/30 border border-error/40 text-xs text-error font-mono flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <strong>Quota exhausted:</strong> New workflow runs are unavailable until the next billing cycle.
              </div>
            </div>
          )}

          {isWarning && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-xs text-amber-800 font-mono flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <strong>Usage Warning:</strong> Your organization is approaching its monthly quota ({percentage}% used).
              </div>
            </div>
          )}

          {/* Quota Progress Card */}
          <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-on-surface">Monthly Execution Quota</h3>
                  <p className="text-xs text-on-surface-variant">Resets on the 1st of every month</p>
                </div>
              </div>
              <span className="font-display font-bold text-2xl text-primary">{percentage}%</span>
            </div>

            {/* Main Progress Bar */}
            <div className="space-y-1">
              <div className="w-full bg-surface-container-low h-3 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isExhausted ? "bg-error" : isWarning ? "bg-amber-500" : "bg-primary"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex justify-between font-mono text-xs text-on-surface-variant pt-1">
                <span>{used} / {limit} calls used</span>
                <span>{limit - used} calls remaining</span>
              </div>
            </div>
          </div>

          {/* Execution Breakdown */}
          <div className="bg-surface-container-lowest/90 backdrop-blur-md border border-outline-variant/60 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-display font-bold text-base text-on-surface border-b border-outline-variant/40 pb-3">
              Execution Breakdown by Step Type
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {usageBreakdown.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.type}
                    className="p-4 rounded-xl border border-outline-variant/40 bg-surface/50 space-y-2 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-display font-semibold text-xs text-on-surface">{item.type}</div>
                        <div className="font-mono text-[10px] text-on-surface-variant">{item.count} executions</div>
                      </div>
                    </div>

                    <span className="font-mono text-xs font-bold text-on-surface">{item.percentage}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

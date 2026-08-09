"use client";

import React, { useState } from "react";
import { WorkflowTrigger, TriggerType } from "@/types";
import { usePermissions } from "@/hooks/usePermissions";
import { Zap, Copy, Check, Lock, Calendar, Database, Play } from "lucide-react";
import { toast } from "sonner";

interface TriggerPanelProps {
  triggers: WorkflowTrigger[];
  onUpdateTriggers: (triggers: WorkflowTrigger[]) => void;
}

export const TriggerPanel: React.FC<TriggerPanelProps> = ({ triggers, onUpdateTriggers }) => {
  const { canAddRestrictedTrigger, canEditWorkflow } = usePermissions();
  const [copied, setCopied] = useState(false);

  const activeTypes = triggers.map((t) => t.type);

  const toggleTriggerType = (type: TriggerType) => {
    if (!canEditWorkflow()) {
      toast.error("Viewers are not permitted to modify workflow triggers.");
      return;
    }

    if (type === "webhook" && !canAddRestrictedTrigger("webhook")) {
      toast.error("Owner permission required", {
        description: "Only organization owners can create webhook endpoints.",
      });
      return;
    }

    if (activeTypes.includes(type)) {
      onUpdateTriggers(triggers.filter((t) => t.type !== type));
      toast.info(`Removed ${type} trigger.`);
    } else {
      const newTrigger: WorkflowTrigger = {
        id: `trig-${Date.now()}`,
        workflowId: "",
        type,
        config: type === "webhook" ? {
          webhookUrl: "https://api.vocalflow.ai/webhook/v1/acme-support",
          webhookSecret: `whsec_${Math.random().toString(36).slice(2, 12)}`,
        } : type === "scheduled" ? {
          cronSchedule: "0 9 * * 1-5",
          timeZone: "America/New_York",
        } : type === "database_event" ? {
          dbTable: "users",
          dbEvent: "INSERT",
        } : {},
        isRestricted: type === "webhook",
      };
      onUpdateTriggers([...triggers, newTrigger]);
      toast.success(`Added ${type} trigger.`);
    }
  };

  const webhookTrigger = triggers.find((t) => t.type === "webhook");
  const scheduledTrigger = triggers.find((t) => t.type === "scheduled");
  const dbTrigger = triggers.find((t) => t.type === "database_event");

  const copyWebhookUrl = () => {
    if (webhookTrigger?.config.webhookUrl) {
      navigator.clipboard.writeText(webhookTrigger.config.webhookUrl);
      setCopied(true);
      toast.success("Webhook URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-outline-variant/40 pb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <h3 className="font-display font-bold text-sm text-on-surface">
            Workflow Triggers
          </h3>
        </div>
        <span className="font-mono text-[10px] text-on-surface-variant uppercase">
          {triggers.length} Active
        </span>
      </div>

      {/* Trigger Type Toggle Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          onClick={() => toggleTriggerType("manual")}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            activeTypes.includes("manual")
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "border-outline-variant/60 hover:bg-surface-container-low text-on-surface"
          }`}
        >
          <div className="flex items-center gap-2 font-mono text-xs">
            <Play className="w-3.5 h-3.5" />
            <span>Manual</span>
          </div>
        </button>

        <button
          onClick={() => toggleTriggerType("webhook")}
          className={`p-2.5 rounded-lg border text-left transition-all relative ${
            activeTypes.includes("webhook")
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "border-outline-variant/60 hover:bg-surface-container-low text-on-surface"
          }`}
        >
          <div className="flex items-center justify-between font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" />
              <span>Webhook</span>
            </div>
            <Lock className="w-3 h-3 text-purple-600" />
          </div>
        </button>

        <button
          onClick={() => toggleTriggerType("scheduled")}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            activeTypes.includes("scheduled")
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "border-outline-variant/60 hover:bg-surface-container-low text-on-surface"
          }`}
        >
          <div className="flex items-center gap-2 font-mono text-xs">
            <Calendar className="w-3.5 h-3.5" />
            <span>Scheduled</span>
          </div>
        </button>

        <button
          onClick={() => toggleTriggerType("database_event")}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            activeTypes.includes("database_event")
              ? "border-primary bg-primary/10 text-primary font-semibold"
              : "border-outline-variant/60 hover:bg-surface-container-low text-on-surface"
          }`}
        >
          <div className="flex items-center gap-2 font-mono text-xs">
            <Database className="w-3.5 h-3.5" />
            <span>DB Event</span>
          </div>
        </button>
      </div>

      {/* Webhook Configuration */}
      {webhookTrigger && (
        <div className="p-3 rounded-lg bg-surface-container-low/70 border border-outline-variant/40 space-y-2 text-xs">
          <div className="flex items-center justify-between font-mono text-[11px] text-purple-700 font-semibold">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3" /> Webhook Trigger (Owner Restricted)
            </span>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-on-surface-variant">HTTP POST Endpoint URL</label>
            <div className="flex gap-2">
              <input
                readOnly
                value={webhookTrigger.config.webhookUrl || ""}
                className="flex-1 h-8 px-2.5 rounded bg-surface-container-lowest border border-outline-variant/60 font-mono text-xs text-on-surface outline-none"
              />
              <button
                onClick={copyWebhookUrl}
                className="px-3 h-8 rounded bg-primary text-on-primary font-mono text-xs flex items-center gap-1 hover:bg-primary-container transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Configuration */}
      {scheduledTrigger && (
        <div className="p-3 rounded-lg bg-surface-container-low/70 border border-outline-variant/40 space-y-2 text-xs">
          <div className="font-mono text-[11px] text-primary font-semibold">Cron Schedule Configuration</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono text-on-surface-variant">Cron Expression</label>
              <input
                defaultValue={scheduledTrigger.config.cronSchedule || "0 9 * * 1-5"}
                className="w-full h-8 px-2.5 rounded bg-surface-container-lowest border border-outline-variant/60 font-mono text-xs outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-on-surface-variant">Timezone</label>
              <input
                defaultValue={scheduledTrigger.config.timeZone || "America/New_York"}
                className="w-full h-8 px-2.5 rounded bg-surface-container-lowest border border-outline-variant/60 font-mono text-xs outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

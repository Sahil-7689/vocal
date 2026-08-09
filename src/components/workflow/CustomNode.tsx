"use client";

import React, { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { useWorkflowStore } from "@/stores/workflowStore";
import { usePermissions } from "@/hooks/usePermissions";
import { StepType } from "@/types";
import {
  Bot,
  Globe,
  Database,
  BellRing,
  GitBranch,
  ShieldAlert,
  Trash2,
  Lock,
} from "lucide-react";

const stepIcons: Record<StepType, React.ElementType> = {
  llm_call: Bot,
  http_request: Globe,
  db_write: Database,
  notify: BellRing,
  conditional_branch: GitBranch,
  approval_gate: ShieldAlert,
};

const stepThemeColors: Record<StepType, { bg: string; text: string; border: string }> = {
  llm_call: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30" },
  http_request: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
  db_write: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/30" },
  notify: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/30" },
  conditional_branch: { bg: "bg-secondary-container/40", text: "text-on-secondary-container", border: "border-secondary-container" },
  approval_gate: { bg: "bg-error-container/30", text: "text-error", border: "border-error/30" },
};

export const CustomStepNode: React.FC<NodeProps> = memo(({ id, data, selected }) => {
  const { selectNode, removeNode } = useWorkflowStore();
  const { canEditWorkflow } = usePermissions();

  const stepType = (data?.type as StepType) || "llm_call";
  const stepName = (data?.name as string) || "Workflow Step";
  const config = (data?.config as any) || {};

  const Icon = stepIcons[stepType] || Bot;
  const theme = stepThemeColors[stepType] || stepThemeColors.llm_call;

  const isRestricted = stepType === "db_write" || stepType === "notify";

  return (
    <div
      onClick={() => selectNode(id)}
      className={`w-60 bg-surface-container-lowest/95 backdrop-blur-sm border rounded-lg shadow-sm transition-all duration-200 cursor-pointer ${
        selected
          ? "border-2 border-primary shadow-[0_0_15px_rgba(70,72,212,0.2)] -translate-y-0.5"
          : "border-outline-variant/60 hover:border-outline hover:shadow-md hover:-translate-y-0.5"
      }`}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-white shadow-sm"
      />

      {/* Header */}
      <div className={`p-2.5 border-b ${theme.border} flex items-center justify-between ${theme.bg}`}>
        <div className="flex items-center gap-2 truncate">
          <div className={`w-6 h-6 rounded flex items-center justify-center ${theme.text}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-mono text-xs font-semibold text-on-surface truncate">
            {stepName}
          </span>
        </div>

        {canEditWorkflow() && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeNode(id);
            }}
            className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-container"
            title="Delete step"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content Metadata */}
      <div className="p-3 space-y-1.5 text-[11px] text-on-surface-variant">
        {stepType === "llm_call" && (
          <div className="flex justify-between items-center">
            <span>Model:</span>
            <span className="font-mono bg-surface-container-low px-1.5 py-0.5 rounded text-on-surface">
              {config.model || "Llama 3.3"}
            </span>
          </div>
        )}

        {stepType === "http_request" && (
          <div className="flex justify-between items-center font-mono">
            <span className="font-bold text-amber-600">{config.method || "POST"}</span>
            <span className="truncate max-w-[120px] text-on-surface">{config.url || "/api/v1"}</span>
          </div>
        )}

        {stepType === "db_write" && (
          <div className="flex justify-between items-center font-mono">
            <span>Table:</span>
            <span className="bg-purple-500/10 text-purple-700 px-1.5 py-0.5 rounded">{config.table || "audit_logs"}</span>
          </div>
        )}

        {stepType === "notify" && (
          <div className="flex justify-between items-center">
            <span>Channel:</span>
            <span className="font-mono bg-emerald-500/10 text-emerald-700 px-1.5 py-0.5 rounded">{config.channel || "#alerts"}</span>
          </div>
        )}

        {stepType === "conditional_branch" && (
          <div className="flex justify-between items-center text-on-surface">
            <span>If input</span>
            <span className="font-mono text-xs font-semibold">{config.operator || "equals"}</span>
          </div>
        )}

        {stepType === "approval_gate" && (
          <div className="flex items-center gap-1 text-amber-600 font-mono text-[10px]">
            <Lock className="w-3 h-3" />
            <span>Requires {config.requiredRole || "owner"}</span>
          </div>
        )}

        {isRestricted && (
          <div className="pt-1 flex items-center gap-1 text-[10px] text-purple-600 font-mono">
            <Lock className="w-3 h-3" />
            <span>Owner-restricted step</span>
          </div>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-white shadow-sm"
      />
    </div>
  );
});

CustomStepNode.displayName = "CustomStepNode";

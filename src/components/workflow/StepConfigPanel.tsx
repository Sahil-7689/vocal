"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useWorkflowStore } from "@/stores/workflowStore";
import { usePermissions } from "@/hooks/usePermissions";
import { StepType, StepConfig } from "@/types";
import { Settings, X, Save, Lock } from "lucide-react";
import { toast } from "sonner";

const stepConfigSchema = z.object({
  name: z.string().min(1, "Step name is required"),
  provider: z.string().optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  prompt: z.string().optional(),
  temperature: z.number().optional(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).optional(),
  url: z.string().optional(),
  headers: z.string().optional(),
  body: z.string().optional(),
  table: z.string().optional(),
  data: z.string().optional(),
  channel: z.string().optional(),
  webhookUrl: z.string().optional(),
  message: z.string().optional(),
  input: z.string().optional(),
  operator: z.enum(["equals", "contains", "greater_than", "less_than", "is_not_null"]).optional(),
  expectedValue: z.string().optional(),
  description: z.string().optional(),
  requiredRole: z.enum(["owner", "editor", "viewer"]).optional(),
});

type StepConfigFormValues = z.infer<typeof stepConfigSchema>;

function formatJsonOrString(val: any): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  return JSON.stringify(val, null, 2);
}

export const StepConfigPanel: React.FC = () => {
  const { nodes, selectedNodeId, selectNode, updateNodeConfig, updateNodeName } = useWorkflowStore();
  const { canEditWorkflow } = usePermissions();

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const nodeData = (selectedNode?.data as any) || {};

  const stepType: StepType = (nodeData.type as StepType) || "llm_call";
  const stepName: string = (nodeData.name as string) || "Workflow Step";
  const currentConfig: StepConfig = (nodeData.config as StepConfig) || {};

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<StepConfigFormValues>({
    resolver: zodResolver(stepConfigSchema),
    defaultValues: {
      name: stepName,
      provider: currentConfig.provider || "Groq",
      model: currentConfig.model || "Llama 3.3 70B Versatile",
      systemPrompt: currentConfig.systemPrompt || "",
      prompt: currentConfig.prompt || "",
      temperature: currentConfig.temperature ?? 0.7,
      method: currentConfig.method || "POST",
      url: currentConfig.url || "",
      headers: formatJsonOrString(currentConfig.headers),
      body: currentConfig.body || "",
      table: currentConfig.table || "",
      data: formatJsonOrString(currentConfig.data),
      channel: currentConfig.channel || "",
      webhookUrl: currentConfig.webhookUrl || "",
      message: currentConfig.message || "",
      input: currentConfig.input || "",
      operator: currentConfig.operator || "equals",
      expectedValue: currentConfig.expectedValue || "",
      description: currentConfig.description || "",
      requiredRole: currentConfig.requiredRole || "owner",
    },
  });

  useEffect(() => {
    if (selectedNode) {
      const dataObj = (selectedNode.data as any) || {};
      const cfg: StepConfig = (dataObj.config as StepConfig) || {};
      reset({
        name: dataObj.name || "Workflow Step",
        provider: cfg.provider || "Groq",
        model: cfg.model || "Llama 3.3 70B Versatile",
        systemPrompt: cfg.systemPrompt || "",
        prompt: cfg.prompt || "",
        temperature: cfg.temperature ?? 0.7,
        method: cfg.method || "POST",
        url: cfg.url || "",
        headers: formatJsonOrString(cfg.headers),
        body: cfg.body || "",
        table: cfg.table || "",
        data: formatJsonOrString(cfg.data),
        channel: cfg.channel || "",
        webhookUrl: cfg.webhookUrl || "",
        message: cfg.message || "",
        input: cfg.input || "",
        operator: cfg.operator || "equals",
        expectedValue: cfg.expectedValue || "",
        description: cfg.description || "",
        requiredRole: cfg.requiredRole || "owner",
      });
    }
  }, [selectedNodeId, selectedNode, reset]);

  if (!selectedNode) return null;

  const tempVal = watch("temperature") ?? 0.7;

  const onSubmit = (values: StepConfigFormValues) => {
    if (!canEditWorkflow()) {
      toast.error("Viewer role cannot modify step configuration.");
      return;
    }

    updateNodeName(selectedNode.id, values.name);

    const { name, ...configValues } = values;
    updateNodeConfig(selectedNode.id, configValues);
    toast.success("Step configuration updated.");
  };

  return (
    <aside className="w-80 bg-surface/95 backdrop-blur-md border-l border-outline-variant/60 flex flex-col shrink-0 z-10 animate-fade-up">
      {/* Panel Header */}
      <div className="p-4 border-b border-outline-variant/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-sm text-on-surface">
            Configure {stepName}
          </h3>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Step Name */}
        <div className="space-y-1">
          <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
            Step Label
          </label>
          <input
            {...register("name")}
            className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          />
        </div>

        {/* LLM Call Fields */}
        {stepType === "llm_call" && (
          <>
            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Provider
              </label>
              <select
                {...register("provider")}
                className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs focus:border-primary outline-none"
              >
                <option value="Groq">Groq</option>
                <option value="OpenAI">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Model
              </label>
              <select
                {...register("model")}
                className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs focus:border-primary outline-none"
              >
                <option value="Llama 3.3 70B Versatile">Llama 3.3 70B Versatile</option>
                <option value="Llama 3 8B">Llama 3 8B</option>
                <option value="GPT-4o">GPT-4o</option>
                <option value="Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                System Prompt
              </label>
              <textarea
                {...register("systemPrompt")}
                rows={4}
                className="w-full p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 font-mono text-xs focus:border-primary outline-none resize-y"
                placeholder="You are an AI customer support assistant..."
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="font-mono text-[11px] text-on-surface-variant">Temperature</label>
                <span className="font-mono text-xs text-primary font-bold">{tempVal}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                {...register("temperature", { valueAsNumber: true })}
                className="w-full accent-primary cursor-pointer"
              />
            </div>
          </>
        )}

        {/* HTTP Request Fields */}
        {stepType === "http_request" && (
          <>
            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                HTTP Method
              </label>
              <select
                {...register("method")}
                className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs focus:border-primary outline-none"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Endpoint URL
              </label>
              <input
                {...register("url")}
                placeholder="https://api.example.com/v1/tickets"
                className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs font-mono focus:border-primary outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Headers (JSON)
              </label>
              <textarea
                {...register("headers")}
                rows={3}
                className="w-full p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 font-mono text-xs focus:border-primary outline-none"
                placeholder='{"Authorization": "Bearer token"}'
              />
            </div>
          </>
        )}

        {/* DB Write Fields */}
        {stepType === "db_write" && (
          <>
            <div className="p-2 rounded bg-purple-500/10 border border-purple-500/30 text-purple-700 font-mono text-[10px] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Owner restricted step: Required role owner.</span>
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Target Table
              </label>
              <input
                {...register("table")}
                placeholder="audit_logs"
                className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs font-mono focus:border-primary outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Insert Record Payload (JSON)
              </label>
              <textarea
                {...register("data")}
                rows={4}
                className="w-full p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 font-mono text-xs focus:border-primary outline-none"
                placeholder='{"action": "create_ticket", "status": "completed"}'
              />
            </div>
          </>
        )}

        {/* Notify Fields */}
        {stepType === "notify" && (
          <>
            <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 font-mono text-[10px] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Owner restricted step: Required role owner.</span>
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Channel / Recipient
              </label>
              <input
                {...register("channel")}
                placeholder="#customer-alerts"
                className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs focus:border-primary outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Message Body
              </label>
              <textarea
                {...register("message")}
                rows={3}
                className="w-full p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs focus:border-primary outline-none"
                placeholder="Workflow execution completed successfully for {{user.email}}"
              />
            </div>
          </>
        )}

        {/* Conditional Branch Fields */}
        {stepType === "conditional_branch" && (
          <>
            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Input Variable
              </label>
              <input
                {...register("input")}
                placeholder="{{step-2-http.output.status}}"
                className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 font-mono text-xs focus:border-primary outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Operator
              </label>
              <select
                {...register("operator")}
                className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs focus:border-primary outline-none"
              >
                <option value="equals">equals (==)</option>
                <option value="contains">contains</option>
                <option value="greater_than">greater than (&gt;)</option>
                <option value="is_not_null">is not null</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Expected Comparison Value
              </label>
              <input
                {...register("expectedValue")}
                placeholder="200"
                className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 font-mono text-xs focus:border-primary outline-none"
              />
            </div>
          </>
        )}

        {/* Approval Gate Fields */}
        {stepType === "approval_gate" && (
          <>
            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Approval Description
              </label>
              <textarea
                {...register("description")}
                rows={3}
                className="w-full p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs focus:border-primary outline-none"
                placeholder="Owner review required prior to database commit."
              />
            </div>

            <div className="space-y-1">
              <label className="block font-mono text-[11px] text-on-surface-variant font-medium">
                Required Approver Role
              </label>
              <select
                {...register("requiredRole")}
                className="w-full h-8 px-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs focus:border-primary outline-none font-semibold text-primary"
              >
                <option value="owner">Owner (Recommended)</option>
                <option value="editor">Editor</option>
              </select>
            </div>
          </>
        )}

        <div className="pt-4">
          <button
            type="submit"
            disabled={!canEditWorkflow()}
            className="w-full h-9 rounded-lg bg-primary text-on-primary font-mono text-xs font-semibold hover:bg-primary-container transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Save className="w-3.5 h-3.5" />
            Save Configuration
          </button>
        </div>
      </form>
    </aside>
  );
};

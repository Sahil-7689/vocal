"use client";

import React, { useState } from "react";
import { useWorkflowStore } from "@/stores/workflowStore";
import { usePermissions } from "@/hooks/usePermissions";
import { StepType } from "@/types";
import {
  Search,
  Bot,
  Globe,
  Database,
  BellRing,
  GitBranch,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

interface StepCategoryItem {
  type: StepType;
  name: string;
  description: string;
  icon: React.ElementType;
  isRestricted?: boolean;
}

const STEP_ITEMS: { category: string; items: StepCategoryItem[] }[] = [
  {
    category: "AI",
    items: [
      {
        type: "llm_call",
        name: "LLM Call",
        description: "Generate text via AI LLM API",
        icon: Bot,
      },
    ],
  },
  {
    category: "External & Data",
    items: [
      {
        type: "http_request",
        name: "HTTP Request",
        description: "REST API call (GET/POST)",
        icon: Globe,
      },
      {
        type: "db_write",
        name: "DB Write",
        description: "Insert/Update Database record",
        icon: Database,
        isRestricted: true,
      },
    ],
  },
  {
    category: "Communication",
    items: [
      {
        type: "notify",
        name: "Notify",
        description: "Send Slack or Webhook message",
        icon: BellRing,
        isRestricted: true,
      },
    ],
  },
  {
    category: "Logic & Control",
    items: [
      {
        type: "conditional_branch",
        name: "Conditional Branch",
        description: "If / Else logic routing",
        icon: GitBranch,
      },
      {
        type: "approval_gate",
        name: "Approval Gate",
        description: "Pause for human approval",
        icon: ShieldAlert,
      },
    ],
  },
];

export const StepLibrary: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { addNode } = useWorkflowStore();
  const { canAddRestrictedStep, canEditWorkflow } = usePermissions();

  const handleAddStep = (type: StepType, name: string, isRestricted?: boolean) => {
    if (!canEditWorkflow()) {
      toast.error("Viewers are not permitted to add workflow steps.");
      return;
    }

    if (isRestricted && !canAddRestrictedStep(type)) {
      toast.error("Owner permission required", {
        description: "Only organization owners can add DB Write or Notify steps.",
      });
      return;
    }

    addNode(type, name);
    toast.success(`Added ${name} step`);
  };

  return (
    <aside className="w-64 bg-surface/90 backdrop-blur-md border-r border-outline-variant/60 flex flex-col shrink-0 animate-fade-up z-10">
      <div className="p-3 border-b border-outline-variant/60">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search blocks..."
            className="w-full h-8 pl-9 pr-3 rounded-md bg-surface-container-lowest border border-outline-variant/60 text-xs focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {STEP_ITEMS.map((cat) => {
          const filtered = cat.items.filter((item) =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.description.toLowerCase().includes(searchTerm.toLowerCase())
          );

          if (filtered.length === 0) return null;

          return (
            <div key={cat.category}>
              <div className="px-2 py-1 font-mono text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">
                {cat.category}
              </div>
              <div className="space-y-1 mt-1">
                {filtered.map((item) => {
                  const Icon = item.icon;
                  const isBlocked = item.isRestricted && !canAddRestrictedStep(item.type);

                  return (
                    <button
                      key={item.type}
                      onClick={() => handleAddStep(item.type, item.name, item.isRestricted)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all border ${
                        isBlocked
                          ? "bg-surface-container-low/40 border-transparent opacity-60 cursor-not-allowed"
                          : "hover:bg-surface-container-low hover:border-outline-variant cursor-pointer border-transparent"
                      }`}
                    >
                      <div className="w-7 h-7 rounded bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 truncate">
                        <div className="text-xs font-semibold text-on-surface flex items-center justify-between">
                          <span className="truncate">{item.name}</span>
                          {item.isRestricted && <Lock className="w-3 h-3 text-purple-600 shrink-0" />}
                        </div>
                        <div className="text-[10px] text-on-surface-variant truncate">
                          {item.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

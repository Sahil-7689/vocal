"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  Node,
  Edge,
} from "@xyflow/react";

import { GET_WORKFLOW } from "@/graphql/queries/workflows";
import { SAVE_WORKFLOW } from "@/graphql/mutations/workflows";
import { useOrganization } from "@/context/OrganizationContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useWorkflowStore } from "@/stores/workflowStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StepLibrary } from "@/components/workflow/StepLibrary";
import { CustomStepNode } from "@/components/workflow/CustomNode";
import { StepConfigPanel } from "@/components/workflow/StepConfigPanel";
import { TriggerPanel } from "@/components/workflow/TriggerPanel";
import { RunWorkflowModal } from "@/components/workflow/RunWorkflowModal";
import { Workflow, WorkflowStep, WorkflowTrigger } from "@/types";

import {
  Save,
  Play,
  Zap,
  Lock,
  AlertTriangle,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const nodeTypes = {
  customStepNode: CustomStepNode,
};

export default function WorkflowBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const { currentOrganization } = useOrganization();
  const { canEditWorkflow, canRunWorkflow } = usePermissions();

  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    isDirty,
    setDirty,
  } = useWorkflowStore();

  const [workflowName, setWorkflowName] = useState("Workflow Builder");
  const [triggers, setTriggers] = useState<WorkflowTrigger[]>([]);
  const [showTriggerPanel, setShowTriggerPanel] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);

  // GraphQL Queries & Mutations
  const { data, loading, error } = useQuery(GET_WORKFLOW, {
    variables: {
      id: workflowId,
    },
    fetchPolicy: "network-only",
  });

  const [saveWorkflowMutation, { loading: saving }] = useMutation(SAVE_WORKFLOW);

  const rawWf = data?.workflows_by_pk || data?.workflow_by_pk;
  
  const activeWorkflow: Workflow | null = rawWf
    ? {
        id: rawWf.id,
        organizationId: rawWf.org_id || rawWf.organizationId,
        name: rawWf.name,
        description: rawWf.description,
        status: rawWf.status,
        createdAt: rawWf.created_at || rawWf.createdAt,
        updatedAt: rawWf.updated_at || rawWf.updatedAt,
        createdBy: rawWf.created_by || rawWf.createdBy,
        steps: (rawWf.steps || []).map((s: any) => ({
          id: s.id,
          workflowId: s.workflow_id || s.workflowId,
          type: s.type,
          name: s.name,
          positionX: s.position_x || s.positionX || 300,
          positionY: s.position_y || s.positionY || 150,
          config: s.config,
          nextStepId: s.next_step_id || s.nextStepId,
        })),
        triggers: (rawWf.triggers || []).map((t: any) => ({
          id: t.id,
          workflowId: t.workflow_id || t.workflowId,
          type: t.type,
          config: t.config,
          isRestricted: !t.enabled,
        })),
      }
    : null;

  // Synchronize React Flow nodes & edges from resolved active workflow
  useEffect(() => {
    if (activeWorkflow) {
      setWorkflowName(activeWorkflow.name);
      setTriggers(activeWorkflow.triggers || []);

      let stepList = activeWorkflow.steps || [];
      if (stepList.length === 0) {
        stepList = [
          {
            id: `step-init-${Date.now()}`,
            workflowId: activeWorkflow.id,
            type: "llm_call",
            name: "AI Processing Step",
            positionX: 300,
            positionY: 150,
            config: { provider: "openai", model: "gpt-4o", prompt: "Analyze workflow input data." },
          },
        ];
      }

      // Map steps to React Flow nodes with distinct non-overlapping positions
      const initialNodes: Node[] = stepList.map((step, idx) => {
        // Calculate non-overlapping grid layout if positionX/positionY are default or identical
        const posX = (step.positionX && step.positionX !== 300)
          ? step.positionX
          : 250 + (idx % 3) * 320;
        const posY = (step.positionY && step.positionY !== 150)
          ? step.positionY
          : 150 + Math.floor(idx / 3) * 160;

        return {
          id: step.id,
          type: "customStepNode",
          position: { x: posX, y: posY },
          data: {
            id: step.id,
            type: step.type,
            name: step.name,
            config: step.config,
          },
        };
      });

      // Generate connecting edges between sequential steps
      const initialEdges: Edge[] = [];
      stepList.forEach((step, idx) => {
        const nextStep = stepList[idx + 1];
        const targetId = step.nextStepId || (nextStep ? nextStep.id : null);
        if (targetId) {
          initialEdges.push({
            id: `e-${step.id}-${targetId}`,
            source: step.id,
            target: targetId,
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2 },
          });
        }
      });

      setNodes(initialNodes);
      setEdges(initialEdges);
      setDirty(false);
    }
  }, [activeWorkflow?.id, setNodes, setEdges, setDirty]);

  const handleSave = async () => {
    if (!canEditWorkflow()) {
      toast.error("Unauthorized: Viewer role cannot save workflows.");
      return;
    }

    try {
      const stepPayload = nodes.map((node, idx) => ({
        workflow_id: workflowId,
        position: idx + 1,
        name: (node.data.name || "Step") as string,
        type: (node.data.type || "llm_call") as string,
        config: (node.data.config || {}) as any,
      }));

      await saveWorkflowMutation({
        variables: {
          id: workflowId,
          name: workflowName,
          status: "active",
          steps: stepPayload,
        },
      });

      setDirty(false);
      toast.success("Workflow saved successfully!");
    } catch (err: any) {
      toast.error("Failed to save workflow", { description: err.message });
    }
  };

  // Cross-Organization Guard Handling
  // Only show "unavailable" AFTER loading is done AND there is no data AND no query error.
  // If there IS a GraphQL error, show the real error message for debugging.
  const isUnauthorized = !loading && !error && !activeWorkflow;

  // Show actual GraphQL error detail instead of hiding it
  if (error) {
    return (
      <div className="min-h-screen flex bg-background text-on-surface relative">
        <Sidebar />
        <div className="flex-1 ml-60 flex flex-col min-h-screen relative z-10">
          <Header title="Workflow Builder" />
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="bg-surface-container-lowest border border-error/30 rounded-2xl p-8 max-w-lg w-full text-center space-y-4 shadow-xl animate-fade-up">
              <div className="w-12 h-12 rounded-full bg-error-container/30 text-error flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="font-display font-bold text-xl text-on-surface">
                Failed to load workflow
              </h2>
              <p className="text-xs text-on-surface-variant font-mono break-all">
                {error.graphQLErrors?.[0]?.message || error.networkError?.message || error.message}
              </p>
              <div className="pt-2">
                <button
                  onClick={() => router.push("/workflows")}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary font-mono text-xs font-semibold hover:bg-primary-container transition-all"
                >
                  Return to Workflows
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isUnauthorized) {
    return (
      <div className="min-h-screen flex bg-background text-on-surface relative">
        <Sidebar />
        <div className="flex-1 ml-60 flex flex-col min-h-screen relative z-10">
          <Header title="Workflow Builder" />
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl animate-fade-up">
              <div className="w-12 h-12 rounded-full bg-error-container/30 text-error flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="font-display font-bold text-xl text-on-surface">
                Workflow unavailable
              </h2>
              <p className="text-xs text-on-surface-variant">
                Workflow ID <span className="font-mono text-primary">{workflowId}</span> was not found or you don&apos;t have access. It may belong to a different organization.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => router.push("/workflows")}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary font-mono text-xs font-semibold hover:bg-primary-container transition-all"
                >
                  Return to Workflows
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-on-surface relative overflow-hidden">
      <Sidebar />

      <div className="flex-1 ml-60 flex flex-col h-screen relative z-10">
        {/* Top Builder Bar */}
        <header className="h-14 bg-surface-container-lowest/90 backdrop-blur-xl border-b border-outline-variant/60 px-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/workflows")}
              className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
              title="Back to Workflows"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="h-4 w-px bg-outline-variant/60" />

            <input
              type="text"
              value={workflowName}
              disabled={!canEditWorkflow()}
              onChange={(e) => {
                setWorkflowName(e.target.value);
                setDirty(true);
              }}
              className="font-display font-bold text-base bg-transparent text-on-surface focus:bg-surface-container-low px-2 py-1 rounded outline-none border border-transparent focus:border-outline-variant transition-all"
            />

            {isDirty && (
              <span className="font-mono text-[10px] text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded font-semibold">
                Unsaved Changes
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTriggerPanel(!showTriggerPanel)}
              className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-mono font-medium text-on-surface flex items-center gap-1.5 transition-colors border border-outline-variant/40"
            >
              <Zap className="w-3.5 h-3.5 text-primary" />
              Triggers ({triggers.length})
            </button>

            {canEditWorkflow() && (
              <button
                disabled={saving}
                onClick={handleSave}
                className="px-4 py-1.5 rounded-lg bg-surface-container-high hover:bg-outline-variant text-on-surface font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save
              </button>
            )}

            {canRunWorkflow() ? (
              <button
                onClick={() => setShowRunModal(true)}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-mono text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Workflow
              </button>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant/40 font-mono text-[10px] text-on-surface-variant flex items-center gap-1">
                <Lock className="w-3 h-3 text-blue-600" />
                <span>Viewer mode</span>
              </div>
            )}
          </div>
        </header>

        {/* Trigger Modal Drawer */}
        {showTriggerPanel && (
          <div className="absolute top-16 right-6 z-30 max-w-xl w-full animate-fade-up">
            <TriggerPanel triggers={triggers} onUpdateTriggers={(t) => { setTriggers(t); setDirty(true); }} />
          </div>
        )}

        {/* Main Canvas Workspace */}
        <div className="flex-1 flex relative overflow-hidden">
          {/* Left Step Library */}
          <StepLibrary />

          {/* React Flow Canvas */}
          <main className="flex-1 relative bg-surface-container-low/30">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-on-surface-variant animate-pulse">
                Loading workflow canvas...
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
              >
                <Background color="#c7c4d7" gap={20} size={1} />
                <Controls className="!bg-surface-container-lowest !border-outline-variant !shadow-md" />
                <MiniMap
                  className="!bg-surface-container-lowest !border-outline-variant"
                  nodeColor="#4648d4"
                  maskColor="rgba(249, 249, 249, 0.7)"
                />
              </ReactFlow>
            )}
          </main>

          {/* Right Configuration Panel */}
          <StepConfigPanel />
        </div>
      </div>

      {/* Run Confirmation Modal */}
      <RunWorkflowModal
        workflowId={workflowId}
        workflowName={workflowName}
        isOpen={showRunModal}
        onClose={() => setShowRunModal(false)}
      />
    </div>
  );
}

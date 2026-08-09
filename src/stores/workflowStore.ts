import { create } from "zustand";
import { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect, applyNodeChanges, applyEdgeChanges, addEdge } from "@xyflow/react";
import { WorkflowStep, StepType, StepConfig } from "@/types";

interface WorkflowState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  isDirty: boolean;
  
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  
  selectNode: (nodeId: string | null) => void;
  addNode: (type: StepType, name: string, position?: { x: number; y: number }) => void;
  removeNode: (nodeId: string) => void;
  updateNodeConfig: (nodeId: string, config: StepConfig) => void;
  updateNodeName: (nodeId: string, name: string) => void;
  resetWorkflow: () => void;
  setDirty: (isDirty: boolean) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isDirty: false,

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge({ ...connection, animated: true, style: { stroke: "#6366f1", strokeWidth: 2 } }, get().edges),
      isDirty: true,
    });
  },

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  addNode: (type, name, customPosition) => {
    const { nodes } = get();
    const id = `step-${type}-${Date.now()}`;
    
    // Auto-calculate position offset
    const position = customPosition || {
      x: 300 + (nodes.length % 4) * 300,
      y: 150 + Math.floor(nodes.length / 4) * 120,
    };

    const defaultConfig: StepConfig = {};
    if (type === "llm_call") {
      defaultConfig.provider = "Groq";
      defaultConfig.model = "Llama 3.3 70B Versatile";
      defaultConfig.systemPrompt = "You are a helpful AI assistant.";
      defaultConfig.temperature = 0.7;
    } else if (type === "http_request") {
      defaultConfig.method = "POST";
      defaultConfig.url = "https://api.example.com/v1/webhook";
    } else if (type === "db_write") {
      defaultConfig.table = "users";
    } else if (type === "notify") {
      defaultConfig.channel = "#alerts";
      defaultConfig.message = "Workflow step completed.";
    } else if (type === "conditional_branch") {
      defaultConfig.operator = "equals";
    } else if (type === "approval_gate") {
      defaultConfig.requiredRole = "owner";
      defaultConfig.description = "Owner approval required to proceed.";
    }

    const newNode: Node = {
      id,
      type: "customStepNode",
      position,
      data: {
        id,
        type,
        name,
        config: defaultConfig,
      },
    };

    // Auto-connect to previous node if available
    let newEdges = [...get().edges];
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      newEdges.push({
        id: `e-${lastNode.id}-${id}`,
        source: lastNode.id,
        target: id,
        animated: true,
        style: { stroke: "#6366f1", strokeWidth: 2 },
      });
    }

    set({
      nodes: [...nodes, newNode],
      edges: newEdges,
      selectedNodeId: id,
      isDirty: true,
    });
  },

  removeNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      selectedNodeId: get().selectedNodeId === nodeId ? null : get().selectedNodeId,
      isDirty: true,
    });
  },

  updateNodeConfig: (nodeId, config) => {
    set({
      nodes: get().nodes.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              config,
            },
          };
        }
        return n;
      }),
      isDirty: true,
    });
  },

  updateNodeName: (nodeId, name) => {
    set({
      nodes: get().nodes.map((n) => {
        if (n.id === nodeId) {
          return {
            ...n,
            data: {
              ...n.data,
              name,
            },
          };
        }
        return n;
      }),
      isDirty: true,
    });
  },

  resetWorkflow: () => {
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      isDirty: false,
    });
  },

  setDirty: (isDirty) => set({ isDirty }),
}));

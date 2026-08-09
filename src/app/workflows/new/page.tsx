"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/context/OrganizationContext";
import { saveMockWorkflow } from "@/lib/mockBackend";

export default function NewWorkflowPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();

  useEffect(() => {
    const newId = `wf-new-${Date.now()}`;
    saveMockWorkflow({
      id: newId,
      organizationId: currentOrganization.id,
      name: "Untitled AI Workflow",
      description: "Automated workflow process.",
      status: "active",
      steps: [
        {
          id: `step-llm-${Date.now()}`,
          workflowId: newId,
          type: "llm_call",
          name: "LLM Call (Groq Llama 3.3)",
          positionX: 300,
          positionY: 150,
          config: {
            provider: "Groq",
            model: "Llama 3.3 70B Versatile",
            systemPrompt: "You are a helpful AI assistant.",
            temperature: 0.7,
          },
        },
      ],
      triggers: [{ id: `trig-${Date.now()}`, workflowId: newId, type: "manual", config: {} }],
    });

    router.replace(`/workflows/${newId}`);
  }, [currentOrganization.id, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-surface font-mono text-xs animate-pulse">
      Creating workflow workspace...
    </div>
  );
}

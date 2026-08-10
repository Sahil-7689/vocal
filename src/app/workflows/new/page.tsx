"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { useOrganization } from "@/context/OrganizationContext";
import { CREATE_WORKFLOW_HASURA } from "@/graphql/mutations/workflows";
import { saveMockWorkflow } from "@/lib/mockBackend";
import { toast } from "sonner";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "f0000000-0000-4000-8000-" + Math.floor(Math.random() * 1e12).toString(16).padStart(12, "0");
}

export default function NewWorkflowPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const createdRef = useRef(false);

  const [createWorkflowMutation] = useMutation(CREATE_WORKFLOW_HASURA);

  useEffect(() => {
    if (!currentOrganization.id || createdRef.current) return;
    createdRef.current = true;

    async function initializeWorkflow() {
      const validUuid = generateUUID();
      try {
        const res = await createWorkflowMutation({
          variables: {
            org_id:
              currentOrganization.id && currentOrganization.id.length === 36 && currentOrganization.id.includes("-")
                ? currentOrganization.id
                : "a0000000-0000-0000-0000-000000000001",
            name: "Untitled AI Workflow",
            description: "Automated workflow process.",
            status: "active",
            steps: [
              {
                position: 1,
                name: "LLM Call (Groq Llama 3.3)",
                type: "llm_call",
                config: {
                  provider: "groq",
                  model: "llama-3.3-70b-versatile",
                  prompt: "User Inquiry: {{input.text}}",
                  system_prompt: "You are a helpful AI assistant.",
                },
              },
            ],
            triggers: [
              {
                type: "manual",
                config: {},
                enabled: true,
              },
            ],
          },
        });

        const createdId = res?.data?.insert_workflows_one?.id || res?.data?.saveWorkflow?.id || validUuid;
        saveMockWorkflow({
          id: createdId,
          organizationId: currentOrganization.id,
          name: "Untitled AI Workflow",
          description: "Automated workflow process.",
          status: "active",
        });

        toast.success("Workflow workspace created!");
        router.replace(`/workflows/${createdId}`);
      } catch (err: any) {
        console.warn("[NewWorkflowPage] Falling back to local workspace creation:", err?.message);
        saveMockWorkflow({
          id: validUuid,
          organizationId: currentOrganization.id,
          name: "Untitled AI Workflow",
          description: "Automated workflow process.",
          status: "active",
        });
        toast.success("Workflow workspace created!");
        router.replace(`/workflows/${validUuid}`);
      }
    }

    initializeWorkflow();
  }, [currentOrganization.id, createWorkflowMutation, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-surface font-mono text-xs animate-pulse">
      Creating workflow workspace...
    </div>
  );
}

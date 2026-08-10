"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { useOrganization } from "@/context/OrganizationContext";
import { CREATE_WORKFLOW_HASURA } from "@/graphql/mutations/workflows";
import { toast } from "sonner";

export default function NewWorkflowPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const createdRef = useRef(false);

  const [createWorkflowMutation] = useMutation(CREATE_WORKFLOW_HASURA);

  useEffect(() => {
    if (!currentOrganization.id || createdRef.current) return;
    createdRef.current = true;

    async function initializeWorkflow() {
      try {
        const res = await createWorkflowMutation({
          variables: {
            org_id: currentOrganization.id,
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

        const createdId = res?.data?.insert_workflows_one?.id;
        if (createdId) {
          toast.success("Workflow workspace created!");
          router.replace(`/workflows/${createdId}`);
        } else {
          router.replace(`/workflows`);
        }
      } catch (err: any) {
        console.error("Failed to create workflow via Hasura:", err);
        toast.error(err.message || "Failed to create workflow");
        router.replace(`/workflows`);
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

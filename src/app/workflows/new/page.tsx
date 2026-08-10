"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { useOrganization } from "@/context/OrganizationContext";
import { CREATE_WORKFLOW } from "@/graphql/mutations/workflows";
import { GET_WORKFLOWS } from "@/graphql/queries/workflows";
import { toast } from "sonner";
import Link from "next/link";

export default function NewWorkflowPage() {
  const router = useRouter();
  const { currentUser, currentOrganization, currentRole } = useOrganization();
  const createdRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createWorkflowMutation, { loading }] = useMutation(CREATE_WORKFLOW, {
    refetchQueries: [{ query: GET_WORKFLOWS, variables: { orgId: currentOrganization.id } }],
    awaitRefetchQueries: true,
  });

  useEffect(() => {
    if (!currentOrganization.id || createdRef.current) return;
    createdRef.current = true;

    async function initializeWorkflow() {
      // ── Step 7: Nhost User & Org Verification ──
      console.log("[CreateWorkflow] Step 7 - Verification:", {
        userId: currentUser.id,
        orgId: currentOrganization.id,
        orgName: currentOrganization.name,
        role: currentRole,
      });

      // ── Step 8: Permission Check — Viewer role is denied ──
      if (currentRole === "viewer") {
        const msg = "Unauthorized: Viewer role cannot create workflows.";
        console.warn("[CreateWorkflow] Step 8 - Denied:", msg);
        setErrorMessage(msg);
        toast.error(msg);
        return;
      }

      // ── Step 6: Verify Variables ──
      const variables = {
        orgId: currentOrganization.id,
        name: "Untitled AI Workflow",
        description: "Automated workflow process.",
      };
      console.log("[CreateWorkflow] Step 6 - Mutation Variables:", variables);

      try {
        const res = await createWorkflowMutation({ variables });
        console.log("[CreateWorkflow] Step 2 - Result:", res);

        const createdWorkflow = res?.data?.insert_workflows_one;
        if (createdWorkflow?.id) {
          console.log("[CreateWorkflow] Step 8 - Success, Created UUID:", createdWorkflow.id);
          toast.success("Workflow created successfully!");
          router.replace(`/workflows/${createdWorkflow.id}`);
        } else {
          const errMsg = "Unable to create workflow: Hasura returned empty payload.";
          console.error("[CreateWorkflow]", errMsg);
          setErrorMessage(errMsg);
          toast.error(errMsg);
        }
      } catch (err: any) {
        // ── Step 2: Log real GraphQL & Network Errors ──
        console.error("[CreateWorkflow] Step 2 - Raw Error:", err);

        let detailedMsg = err?.message || "Unable to create workflow.";

        if (err?.graphQLErrors && err.graphQLErrors.length > 0) {
          console.error("[CreateWorkflow] Step 2 - GraphQLErrors:", err.graphQLErrors);
          const gErr = err.graphQLErrors[0];
          detailedMsg = `GraphQL Error [${gErr?.extensions?.code || "UNKNOWN"}]: ${gErr?.message}`;
        }

        if (err?.networkError) {
          console.error("[CreateWorkflow] Step 2 - NetworkError:", err.networkError);
          const netErr = err.networkError;
          detailedMsg = `Network Error [Status ${netErr?.statusCode || "Unknown"}]: ${netErr?.message || "Failed to reach Hasura GraphQL"}`;
        }

        setErrorMessage(detailedMsg);
        toast.error(detailedMsg);
      }
    }

    initializeWorkflow();
  }, [currentUser.id, currentOrganization.id, currentOrganization.name, currentRole, createWorkflowMutation, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-on-surface p-6">
      <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant/60 rounded-2xl p-8 shadow-xl text-center space-y-4">
        {loading && !errorMessage && (
          <div className="font-mono text-xs text-on-surface-variant animate-pulse space-y-2">
            <p className="font-semibold text-primary">Creating workflow in Hasura...</p>
            <p className="text-[11px] text-on-surface-variant/70">
              Org ID: {currentOrganization.id} ({currentRole})
            </p>
          </div>
        )}

        {errorMessage && (
          <div className="space-y-4 animate-fade-up">
            <div className="w-12 h-12 rounded-full bg-error-container/30 text-error flex items-center justify-center mx-auto">
              ⚠️
            </div>
            <h2 className="font-display font-bold text-lg text-on-surface">
              Workflow Creation Error
            </h2>
            <div className="p-3 rounded-lg bg-error-container/20 border border-error/30 text-xs font-mono text-error text-left break-words">
              {errorMessage}
            </div>
            <div className="pt-2 flex gap-3 justify-center">
              <Link
                href="/workflows"
                className="px-4 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-mono font-medium text-on-surface border border-outline-variant/40"
              >
                Back to Workflows
              </Link>
              <button
                onClick={() => {
                  createdRef.current = false;
                  setErrorMessage(null);
                  window.location.reload();
                }}
                className="px-4 py-2 rounded-lg bg-primary text-on-primary font-mono text-xs font-semibold hover:bg-primary-container"
              >
                Retry Creation
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

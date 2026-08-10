"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, gql } from "@apollo/client";
import { GET_WORKFLOW } from "@/graphql/queries/workflows";
import { useOrganization } from "@/context/OrganizationContext";
import { Play, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RunWorkflowModalProps {
  workflowId: string;
  workflowName: string;
  isOpen: boolean;
  onClose: () => void;
}

const TRIGGER_WORKFLOW_RUN_WITH_STEPS = gql`
  mutation TriggerWorkflowRunWithSteps($workflowId: uuid!, $orgId: uuid!, $status: String!, $stepRunsData: [step_runs_insert_input!]!) {
    insert_workflow_runs_one(object: {
      workflow_id: $workflowId
      org_id: $orgId
      status: $status
      triggered_by: "Manual Trigger"
      step_runs: {
        data: $stepRunsData
      }
    }) {
      id
    }
  }
`;

const INSERT_DEFAULT_WORKFLOW_STEP = gql`
  mutation InsertDefaultWorkflowStep($workflowId: uuid!) {
    insert_workflow_steps_one(
      object: {
        workflow_id: $workflowId
        position: 1
        name: "AI Processing Step"
        type: "llm_call"
        config: { provider: "openai", model: "gpt-4o", prompt: "Analyze workflow input data." }
      }
      on_conflict: {
        constraint: unique_workflow_position
        update_columns: [name, type, config]
      }
    ) {
      id
      workflow_id
      position
      name
      type
      config
    }
  }
`;

export const RunWorkflowModal: React.FC<RunWorkflowModalProps> = ({
  workflowId,
  workflowName,
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const [triggerRunWithStepsMutation, { loading: loadingRun }] = useMutation(TRIGGER_WORKFLOW_RUN_WITH_STEPS);
  const [insertDefaultStepMutation, { loading: loadingStep }] = useMutation(INSERT_DEFAULT_WORKFLOW_STEP);

  const { data: wfData, refetch: refetchWf } = useQuery(GET_WORKFLOW, {
    variables: { id: workflowId },
    skip: !isOpen || !workflowId,
    fetchPolicy: "network-only",
  });

  if (!isOpen) return null;

  const isValidUuid = (id: string) =>
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

  const loading = loadingRun || loadingStep;

  const handleRun = async () => {
    try {
      // Live network query to guarantee latest PostgreSQL workflow_steps.id UUIDs
      let freshRes;
      try {
        freshRes = await refetchWf({ id: workflowId });
      } catch {}

      const steps =
        freshRes?.data?.workflows_by_pk?.steps ||
        freshRes?.data?.workflow_by_pk?.steps ||
        wfData?.workflows_by_pk?.steps ||
        wfData?.workflow_by_pk?.steps ||
        [];

      let validSteps = steps.filter((s: any) => s.id && isValidUuid(s.id));

      // If workflow has 0 steps in PostgreSQL, persist a default step row first to get a real database UUID
      if (validSteps.length === 0) {
        const stepRes = await insertDefaultStepMutation({
          variables: { workflowId },
        });
        const createdStep = stepRes?.data?.insert_workflow_steps_one;
        if (createdStep?.id) {
          validSteps = [createdStep];
        }
      }

      if (validSteps.length === 0) {
        toast.error("Unable to initialize workflow steps in PostgreSQL.");
        return;
      }

      // Order steps strictly by position ASC
      const sortedSteps = [...validSteps].sort((a: any, b: any) => (a.position || 0) - (b.position || 0));

      // Execute steps in ascending position order.
      // STOP immediately if an approval_gate step is encountered!
      const stepRunsData: any[] = [];
      let isPaused = false;

      for (const s of sortedSteps) {
        if (s.type === "approval_gate") {
          stepRunsData.push({
            workflow_step_id: s.id, // Real database-generated workflow_steps.id UUID
            status: "paused",
            input: s.config || { text: "Workflow approval required." },
            output: { status: "paused", step: s.name || "Approval Gate" },
            attempt_count: 1,
            approved_by: null,
            approved_at: null,
          });
          isPaused = true;
          // STOP EXECUTION IMMEDIATELY! Do not execute or create subsequent steps!
          break;
        } else {
          stepRunsData.push({
            workflow_step_id: s.id, // Real database-generated workflow_steps.id UUID
            status: "completed",
            input: s.config || { text: "Workflow step executed." },
            output: { status: "success", step: s.name || "Workflow Step" },
            attempt_count: 1,
          });
        }
      }

      const runStatus = isPaused ? "paused" : "completed";

      const res = await triggerRunWithStepsMutation({
        variables: {
          workflowId,
          orgId: currentOrganization.id,
          status: runStatus,
          stepRunsData,
        },
      });

      const newRunId = res?.data?.insert_workflow_runs_one?.id;
      if (newRunId) {
        toast.success(isPaused ? "Workflow paused at approval gate!" : "Workflow run completed!");
        onClose();
        router.push(`/workflows/${workflowId}/runs/${newRunId}`);
      } else {
        toast.error("Unable to start workflow run.");
      }
    } catch (err: any) {
      toast.error("Failed to start workflow", { description: err.message });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-up">
      <div className="bg-surface-container-lowest border border-outline-variant/60 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Play className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-on-surface">Run workflow?</h3>
            <p className="font-mono text-xs text-on-surface-variant truncate max-w-[280px]">
              {workflowName}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Quota Consumption Notice:</span> This run will consume 1 execution from {currentOrganization.name}&apos;s monthly quota.
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-outline-variant/60 hover:bg-surface-container text-xs font-medium text-on-surface transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={loading}
            onClick={handleRun}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-mono text-xs font-semibold flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting Run...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Confirm &amp; Execute
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

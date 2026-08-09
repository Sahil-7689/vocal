import { PoolClient } from "pg";
import { handleLLMCall, LLMStepConfig } from "./handlers/llm";
import { handleHttpRequest, HTTPStepConfig } from "./handlers/http";
import { handleConditionalBranch, ConditionalStepConfig } from "./handlers/conditional";
import { handleApprovalGate, ApprovalStepConfig } from "./handlers/approval";
import { handleDbWrite, DBWriteStepConfig } from "./handlers/dbWrite";
import { handleNotify, NotifyStepConfig } from "./handlers/notify";

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  position: number;
  name: string;
  type: string;
  config: Record<string, any>;
}

export interface StepExecutionResult {
  stepId: string;
  type: string;
  status: "completed" | "failed" | "paused" | "skipped";
  output?: any;
  error?: string;
  attempts: number;
}

/**
 * Step Dispatcher — modular routing for each step type.
 * Supports llm_call, http_request, conditional_branch, approval_gate, db_write, notify.
 */
export async function executeStep(
  step: WorkflowStep,
  context: Record<string, any>,
  dbClient?: PoolClient,
  orgId?: string,
  runId?: string
): Promise<StepExecutionResult> {
  const stepType = step.type;

  try {
    let output: any = null;
    let attempts = 1;

    switch (stepType) {
      case "llm_call": {
        const res = await handleLLMCall(step.config as LLMStepConfig, context);
        output = res;
        attempts = res.attempts;
        break;
      }

      case "http_request": {
        const res = await handleHttpRequest(step.config as HTTPStepConfig, context);
        output = res;
        attempts = res.attempts;
        break;
      }

      case "conditional_branch": {
        const res = await handleConditionalBranch(
          step.config as ConditionalStepConfig,
          context.previousOutput || context.input
        );
        output = res;
        break;
      }

      case "approval_gate": {
        const res = await handleApprovalGate(step.config as ApprovalStepConfig);
        return {
          stepId: step.id,
          type: stepType,
          status: "paused",
          output: res,
          attempts: 1,
        };
      }

      case "db_write": {
        if (!dbClient || !orgId || !runId) {
          throw new Error("db_write step requires database client and execution context.");
        }
        const res = await handleDbWrite(dbClient, orgId, runId, step.config as DBWriteStepConfig, context);
        output = res;
        break;
      }

      case "notify": {
        const res = await handleNotify(step.config as NotifyStepConfig, context);
        output = res;
        break;
      }

      default:
        throw new Error(`Unsupported step type: '${stepType}'.`);
    }

    return {
      stepId: step.id,
      type: stepType,
      status: "completed",
      output,
      attempts,
    };
  } catch (err: any) {
    return {
      stepId: step.id,
      type: stepType,
      status: "failed",
      error: err.message || "Step execution failed.",
      attempts: 1,
    };
  }
}

import { handleLLMCall, LLMStepConfig } from "./handlers/llm";
import { handleHttpRequest, HTTPStepConfig } from "./handlers/http";
import { handleConditionalBranch, ConditionalStepConfig } from "./handlers/conditional";

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
 * Adding future step types (approval_gate, db_write, notify) requires only extending this dispatcher.
 */
export async function executeStep(
  step: WorkflowStep,
  context: Record<string, any>
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

      // Extension Points for Phase 4 (approval_gate, db_write, notify)
      case "approval_gate":
        return {
          stepId: step.id,
          type: stepType,
          status: "paused",
          output: { paused: true, reason: "Approval Gate reached." },
          attempts: 1,
        };

      case "db_write":
      case "notify":
        return {
          stepId: step.id,
          type: stepType,
          status: "completed",
          output: { message: `Step type ${stepType} handler reserved for Phase 4.` },
          attempts: 1,
        };

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

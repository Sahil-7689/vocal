export interface ApprovalStepConfig {
  message?: string;
  required_role?: string;
}

export interface ApprovalStepOutput {
  paused: boolean;
  message: string;
  requiredRole: string;
}

/**
 * Modular Approval Gate Step Handler (Phase 4)
 * Returns paused status to pause execution when the workflow reaches an approval gate.
 */
export async function handleApprovalGate(
  config: ApprovalStepConfig
): Promise<ApprovalStepOutput> {
  return {
    paused: true,
    message: config.message || "Please review and approve this action.",
    requiredRole: config.required_role || "owner",
  };
}

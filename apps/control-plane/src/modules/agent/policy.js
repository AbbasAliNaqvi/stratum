export const RiskLevels = {
  READ: "READ",
  SAFE: "SAFE",
  SENSITIVE: "SENSITIVE",
  DESTRUCTIVE: "DESTRUCTIVE",
};

export class PolicyEngine {
  constructor(options = {}) {
    this.autoApproveSafe = options.autoApproveSafe ?? true;
  }

  evaluate(toolName, args, riskLevel) {
    // READ actions are always auto-approved
    if (riskLevel === RiskLevels.READ) {
      return {
        allowed: true,
        requiresApproval: false,
        reason: `Tool '${toolName}' is classified READ (read-only state inspection).`,
      };
    }

    // SAFE actions are auto-approved if policy allows
    if (riskLevel === RiskLevels.SAFE && this.autoApproveSafe) {
      return {
        allowed: true,
        requiresApproval: false,
        reason: `Tool '${toolName}' is classified SAFE (non-destructive state creation/trigger).`,
      };
    }

    // SENSITIVE & DESTRUCTIVE actions always require explicit user approval
    if (riskLevel === RiskLevels.SENSITIVE || riskLevel === RiskLevels.DESTRUCTIVE) {
      const reason = toolName === "run.cancel"
        ? `Cancelling an active execution run (${args?.id || 'target'}) is classified SENSITIVE and requires approval.`
        : `Executing operation '${toolName}' is classified ${riskLevel} and requires human approval.`;

      return {
        allowed: false,
        requiresApproval: true,
        reason,
      };
    }

    return {
      allowed: true,
      requiresApproval: false,
      reason: `Tool '${toolName}' evaluated successfully.`,
    };
  }
}

export const policyEngine = new PolicyEngine();

export const JOB_STATES = {
  QUEUED: "queued",
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled",
};

export const VALID_TRANSITIONS = {
  [JOB_STATES.QUEUED]: [
    JOB_STATES.RUNNING,
    JOB_STATES.CANCELLED,
  ],
  [JOB_STATES.RUNNING]: [
    JOB_STATES.SUCCEEDED,
    JOB_STATES.FAILED,
    JOB_STATES.CANCELLED,
    JOB_STATES.QUEUED, // Reclaim for retry
    JOB_STATES.RUNNING, // Direct reclaim via claimNextJob
  ],
  [JOB_STATES.SUCCEEDED]: [],
  [JOB_STATES.FAILED]: [],
  [JOB_STATES.CANCELLED]: [],
};

export function canTransition(fromState, toState) {
  if (fromState === toState) {
    // Idempotent terminal transitions are allowed
    if ([JOB_STATES.SUCCEEDED, JOB_STATES.FAILED, JOB_STATES.CANCELLED].includes(toState)) {
      return true;
    }
  }
  const allowed = VALID_TRANSITIONS[fromState];
  return allowed ? allowed.includes(toState) : false;
}

export function assertValidTransition(fromState, toState) {
  if (!canTransition(fromState, toState)) {
    const error = new Error(
      `Invalid state transition from '${fromState}' to '${toState}'`
    );
    error.code = "INVALID_STATE_TRANSITION";
    throw error;
  }
}

import { registry } from "@stratum/metrics";

export const jobsCreatedTotal = registry.counter({
  name: "stratum_jobs_created_total",
  help: "Total jobs created",
});

export const jobsClaimedTotal = registry.counter({
  name: "stratum_jobs_claimed_total",
  help: "Total jobs claimed",
});

export const jobsReclaimedTotal = registry.counter({
  name: "stratum_jobs_reclaimed_total",
  help: "Total jobs reclaimed",
});

export const jobsCompletedTotal = registry.counter({
  name: "stratum_jobs_completed_total",
  help: "Total jobs completed successfully",
});

export const jobsFailedTotal = registry.counter({
  name: "stratum_jobs_failed_total",
  help: "Total jobs failed",
});

export const jobsCancelRequestedTotal = registry.counter({
  name: "stratum_jobs_cancel_requested_total",
  help: "Total job cancellations requested",
});

export const jobsCancelledTotal = registry.counter({
  name: "stratum_jobs_cancelled_total",
  help: "Total jobs cancelled",
});

export const jobsLeaseRenewalsTotal = registry.counter({
  name: "stratum_jobs_lease_renewals_total",
  help: "Total lease renewals successful",
});

export const jobsLeaseRenewalFailuresTotal = registry.counter({
  name: "stratum_jobs_lease_renewal_failures_total",
  help: "Total lease renewals failed",
});

export const jobExecutionDuration = registry.histogram({
  name: "stratum_job_execution_duration_seconds",
  help: "Job execution duration in seconds",
});

export const jobWaitDuration = registry.histogram({
  name: "stratum_job_wait_duration_seconds",
  help: "Time from creation until job is claimed",
});

export const jobsQueuedGauge = registry.gauge({
  name: "stratum_jobs_queued_current",
  help: "Current number of queued jobs",
});

export const jobTransitionsTotal = registry.counter({
  name: "stratum_job_transitions_total",
  help: "Total state machine transitions",
});

// Node Metrics
export const nodesRegisteredTotal = registry.counter({
  name: "stratum_nodes_registered_total",
  help: "Total nodes registered",
});

export const nodesHeartbeatTotal = registry.counter({
  name: "stratum_nodes_heartbeat_total",
  help: "Total heartbeats received",
});

export const nodesStaleTotal = registry.counter({
  name: "stratum_nodes_stale_total",
  help: "Total nodes marked stale",
});

export const nodesRecoveredTotal = registry.counter({
  name: "stratum_nodes_recovered_total",
  help: "Total nodes recovered",
});

export const nodesActiveGauge = registry.gauge({
  name: "stratum_nodes_active_current",
  help: "Current number of active nodes",
});

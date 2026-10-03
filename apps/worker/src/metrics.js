import { registry } from "@stratum/metrics";

export const workerJobsClaimedTotal = registry.counter({
  name: "stratum_worker_jobs_claimed_total",
  help: "Total jobs claimed by this worker",
});

export const workerJobsCompletedTotal = registry.counter({
  name: "stratum_worker_jobs_completed_total",
  help: "Total jobs completed successfully by this worker",
});

export const workerJobsFailedTotal = registry.counter({
  name: "stratum_worker_jobs_failed_total",
  help: "Total jobs failed by this worker",
});

export const workerJobsCancelledTotal = registry.counter({
  name: "stratum_worker_jobs_cancelled_total",
  help: "Total jobs cancelled while executing",
});

export const workerJobExecutionDuration = registry.histogram({
  name: "stratum_worker_job_execution_duration_seconds",
  help: "Job execution duration measured by the worker",
});

export const workerLeaseRenewalsTotal = registry.counter({
  name: "stratum_worker_lease_renewals_total",
  help: "Total lease renewals by this worker",
});

export const workerLeaseRenewalFailuresTotal = registry.counter({
  name: "stratum_worker_lease_renewal_failures_total",
  help: "Total lease renewal failures",
});

export const workerLeaseLostTotal = registry.counter({
  name: "stratum_worker_lease_lost_total",
  help: "Total times the lease was lost",
});

export const workerHeartbeatTotal = registry.counter({
  name: "stratum_worker_heartbeat_total",
  help: "Total heartbeats sent by this worker",
});

export const workerPollErrorsTotal = registry.counter({
  name: "stratum_worker_poll_errors_total",
  help: "Total job polling errors",
});

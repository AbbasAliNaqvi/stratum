import {
  createJobWithEvent,
  getJobById,
  getJobEvents,
  listAllJobEvents,
  getJobByIdempotencyKey,
  listJobs,
  claimNextJob as claimNextJobRepository,
  completeJob as completeJobRepository,
  reclaimJobsForNode as reclaimJobsForNodeRepository,
  requestJobCancellation as requestJobCancellationRepository,
  acknowledgeJobCancellation as acknowledgeJobCancellationRepository,
  renewJobLease as renewJobLeaseRepository,
} from "./repository.js";

import { logger } from "@stratum/logger";

import {
  jobsCreatedTotal,
  jobsClaimedTotal,
  jobsReclaimedTotal,
  jobsCompletedTotal,
  jobsFailedTotal,
  jobsCancelRequestedTotal,
  jobsCancelledTotal,
  jobsLeaseRenewalsTotal,
  jobsLeaseRenewalFailuresTotal,
  jobExecutionDuration,
  jobWaitDuration,
  jobsQueuedGauge,
  jobTransitionsTotal,
} from "../metrics/index.js";

import { getActiveSpan } from "@stratum/tracing";

export async function createJob(input) {
  if (input.idempotencyKey) {
    const existing = await getJobByIdempotencyKey(input.idempotencyKey);

    if (existing) {
      return existing;
    }
  }

  let traceparent = null;
  const span = getActiveSpan();
  if (span) {
    traceparent = span.getTraceparent();
  }

  const { job } = await createJobWithEvent(
    {
      type: input.type,
      payload: input.payload,
      priority: input.priority ?? 0,
      maxRetries: input.maxRetries ?? 3,
      idempotencyKey: input.idempotencyKey ?? null,
      traceparent,
    },
    {
      eventType: "queued",
      message: "Job created",
    },
  );

  jobsCreatedTotal.inc({ job_type: job.type });
  jobsQueuedGauge.inc({ job_type: job.type });

  logger.info(
    {
      event: "job_created",
      jobId: job.id,
      jobType: job.type,
      status: job.status,
    },
    `Job ${job.id} created`,
  );

  return job;
}

export async function getJob(id) {
  const job = await getJobById(id);

  if (!job) {
    return null;
  }

  const events = await getJobEvents(id);

  return {
    job,
    events,
  };
}

export async function getJobs(filters) {
  return listJobs(filters);
}

export async function claimJob(input) {
  const result = await claimNextJobRepository({
    nodeId: input.nodeId,
    leaseDurationMs: input.leaseDurationMs,
  });

  if (result) {
    const { job } = result;
    jobsClaimedTotal.inc({ job_type: job.type });
    jobsQueuedGauge.dec({ job_type: job.type });

    if (job.createdAt) {
      const waitTime = (Date.now() - new Date(job.createdAt).getTime()) / 1000;
      jobWaitDuration.observe({ job_type: job.type }, Math.max(0, waitTime));
    }

    const fromStatus = job.leaseToken > 1 ? "running" : "queued";
    const reason = job.leaseToken > 1 ? "reclaim" : "claim";

    jobTransitionsTotal.inc({ from: fromStatus, to: job.status, reason });

    logger.info(
      {
        event: "job_transition",
        transitionEvent: "job_claimed",
        jobId: job.id,
        jobType: job.type,
        nodeId: job.lockedBy,
        leaseToken: job.leaseToken,
        fromStatus: job.leaseToken > 1 ? "running" : "queued",
        toStatus: job.status,
        reason: job.leaseToken > 1 ? "reclaim" : "claim",
      },
      `Job ${job.id} claimed by node ${job.lockedBy}`,
    );
  }

  return result;
}

export async function completeJob(input) {
  const result = await completeJobRepository({
    jobId: input.jobId,
    nodeId: input.nodeId,
    leaseToken: input.leaseToken,
    result: input.result ?? null,
  });

  if (result) {
    const { job } = result;
    let execTime = undefined;
    if (job.startedAt && job.finishedAt) {
      execTime =
        (new Date(job.finishedAt).getTime() -
          new Date(job.startedAt).getTime()) /
        1000;
      jobExecutionDuration.observe(
        { job_type: job.type },
        Math.max(0, execTime),
      );
    }

    if (job.status === "succeeded") {
      jobsCompletedTotal.inc({ job_type: job.type });
      jobTransitionsTotal.inc({
        from: "running",
        to: job.status,
        reason: "execution_success",
      });
      logger.info(
        {
          event: "job_transition",
          transitionEvent: "job_completed",
          jobId: job.id,
          jobType: job.type,
          nodeId: input.nodeId,
          leaseToken: input.leaseToken,
          fromStatus: "running",
          toStatus: job.status,
          reason: "execution_success",
          durationMs: execTime !== undefined ? execTime * 1000 : undefined,
        },
        `Job ${job.id} completed successfully`,
      );
    } else if (job.status === "failed") {
      jobsFailedTotal.inc({ job_type: job.type, reason: "execution_failed" });
      jobTransitionsTotal.inc({
        from: "running",
        to: job.status,
        reason: "execution_failed",
      });
      logger.error(
        {
          event: "job_transition",
          transitionEvent: "job_failed",
          jobId: job.id,
          jobType: job.type,
          nodeId: input.nodeId,
          leaseToken: input.leaseToken,
          fromStatus: "running",
          toStatus: job.status,
          reason: "execution_failed",
          durationMs: execTime !== undefined ? execTime * 1000 : undefined,
        },
        `Job ${job.id} failed during execution`,
      );
    }
  }

  return result;
}

export async function reclaimJobsForNode(nodeId) {
  const reclaimed = await reclaimJobsForNodeRepository(nodeId);

  for (const job of reclaimed) {
    jobsReclaimedTotal.inc({ job_type: job.type });
    if (job.status === "queued") {
      jobsQueuedGauge.inc({ job_type: job.type });
    } else if (job.status === "failed") {
      jobsFailedTotal.inc({
        job_type: job.type,
        reason: "reclaim_failed_max_retries",
      });
    }

    const reason =
      job.status === "failed"
        ? "reclaim_failed_max_retries"
        : "node_unreachable";
    jobTransitionsTotal.inc({ from: "running", to: job.status, reason });

    logger.warn(
      {
        event: "job_transition",
        transitionEvent: "job_reclaimed",
        jobId: job.id,
        jobType: job.type,
        nodeId: nodeId,
        fromStatus: "running",
        toStatus: job.status,
        reason:
          job.status === "failed"
            ? "reclaim_failed_max_retries"
            : "node_unreachable",
      },
      `Job ${job.id} reclaimed from node ${nodeId}`,
    );
  }

  return reclaimed;
}

export async function requestJobCancellation(jobId) {
  const result = await requestJobCancellationRepository(jobId);
  if (result && result.job) {
    const { job } = result;
    jobsCancelRequestedTotal.inc({ job_type: job.type });

    logger.info(
      {
        event: "cancellation_requested",
        jobId: job.id,
        jobType: job.type,
        status: job.status,
      },
      `Cancellation requested for job ${job.id}`,
    );

    if (job.status === "cancelled") {
      jobsCancelledTotal.inc({ job_type: job.type });
      jobsQueuedGauge.dec({ job_type: job.type });
      jobTransitionsTotal.inc({
        from: "queued",
        to: job.status,
        reason: "cancellation_requested",
      });

      logger.info(
        {
          event: "job_transition",
          transitionEvent: "job_cancelled",
          jobId: job.id,
          jobType: job.type,
          fromStatus: "queued",
          toStatus: job.status,
          reason: "cancellation_requested",
        },
        `Job ${job.id} cancelled`,
      );
    }
  }
  return result;
}

export async function acknowledgeJobCancellation(input) {
  const result = await acknowledgeJobCancellationRepository(input);
  if (result && result.job && result.job.status === "cancelled") {
    const { job } = result;
    jobsCancelledTotal.inc({ job_type: job.type });
    jobTransitionsTotal.inc({
      from: "running",
      to: job.status,
      reason: "cancellation_acknowledged",
    });

    logger.info(
      {
        event: "job_transition",
        transitionEvent: "cancellation_acknowledged",
        jobId: job.id,
        jobType: job.type,
        nodeId: input.nodeId,
        leaseToken: input.leaseToken,
        fromStatus: "running",
        toStatus: job.status,
        reason: "cancellation_acknowledged",
      },
      `Cancellation acknowledged for job ${job.id} by node ${input.nodeId}`,
    );
  }
  return result;
}

export async function renewJobLease(input) {
  const job = await renewJobLeaseRepository(input);
  if (job) {
    jobsLeaseRenewalsTotal.inc({ job_type: job.type });
    logger.debug(
      {
        event: "lease_renewed",
        jobId: job.id,
        jobType: job.type,
        nodeId: input.nodeId,
        leaseToken: input.leaseToken,
        status: job.status,
      },
      `Lease renewed for job ${job.id}`,
    );
  } else {
    jobsLeaseRenewalFailuresTotal.inc({ job_type: "unknown" });
    logger.warn(
      {
        event: "lease_renewal_rejected",
        jobId: input.jobId,
        nodeId: input.nodeId,
        leaseToken: input.leaseToken,
      },
      `Lease renewal rejected for job ${input.jobId}`,
    );
  }
  return job;
}

export async function getEventsForJob(jobId) {
  return await getJobEvents(jobId);
}

export async function getAllEvents(limit) {
  return await listAllJobEvents(limit);
}

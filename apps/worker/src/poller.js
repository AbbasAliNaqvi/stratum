import { config } from "./config.js";
import { executeJob } from "./executor.js";
import {
  workerJobsClaimedTotal,
  workerJobsCompletedTotal,
  workerJobsFailedTotal,
  workerJobsCancelledTotal,
  workerJobExecutionDuration,
  workerLeaseRenewalsTotal,
  workerLeaseRenewalFailuresTotal,
  workerLeaseLostTotal,
  workerPollErrorsTotal
} from "./metrics.js";
import { withSpan } from "@stratum/tracing";

export function createJobPoller({
  client,
  logger,
}) {
  let timer = null;
  let stopped = false;
  let executing = false;

  async function watchForCancellation(
    job,
    controller,
    state
  ) {
    while (
      !stopped &&
      !controller.signal.aborted &&
      !state.finished
    ) {
      try {
        const response = await client.getJob(
          job.id
        );

        const currentJob = response?.job;

        if (currentJob?.cancelRequestedAt) {
          state.cancelRequested = true;

          logger.info("Job cancellation detected", {
            jobId: job.id,
          });

          controller.abort();
          return;
        }
      } catch (error) {
        logger.warn("Cancellation check failed", {
          jobId: job.id,
          error: error.message,
        });
      }

      await new Promise((resolve) => {
        setTimeout(
          resolve,
          config.JOB_CANCEL_CHECK_INTERVAL_MS
        );
      });
    }
  }

  async function handleCancelledJob(
    job,
    leaseToken,
    state
  ) {
    if (!state.cancelRequested) {
      return false;
    }

    try {
      await client.acknowledgeJobCancellation(
        job.id,
        leaseToken
      );

      workerJobsCancelledTotal.inc({ job_type: job.type });

      logger.info("Job cancelled", {
        jobId: job.id,
        leaseToken,
      });

      return true;
    } catch (error) {
      logger.error(
        "Failed to acknowledge job cancellation",
        {
          jobId: job.id,
          leaseToken,
          error: error.message,
        }
      );

      return false;
    }
  }

  function startLeaseRenewal(
    job,
    leaseToken,
    state
  ) {
    let renewalTimer = null;

    async function renew() {
      if (
        stopped ||
        state.finished ||
        state.cancelRequested ||
        state.leaseLost
      ) {
        return;
      }

      try {
        const result =
          await client.renewJobLease(
            job.id,
            leaseToken
          );

        const renewedJob = result?.job;

        if (!renewedJob) {
          state.leaseLost = true;
          workerLeaseLostTotal.inc({ job_type: job.type });

          logger.warn(
            "Job lease lost",
            {
              jobId: job.id,
              leaseToken,
            }
          );

          return;
        }

        workerLeaseRenewalsTotal.inc({ job_type: job.type });

        const expiresAt = new Date(
          renewedJob.leaseExpiresAt
        ).getTime();

        const remaining =
          expiresAt - Date.now();

        const nextDelay = Math.max(
          1_000,
          Math.floor(remaining / 2)
        );

        renewalTimer = setTimeout(
          () => {
            void renew();
          },
          nextDelay
        );

        logger.debug(
          "Job lease renewed",
          {
            jobId: job.id,
            leaseToken,
            leaseExpiresAt:
              renewedJob.leaseExpiresAt,
          }
        );
      } catch (error) {
        if (error.status === 409) {
          state.leaseLost = true;
          workerLeaseLostTotal.inc({ job_type: job.type });

          logger.warn(
            "Job lease lost",
            {
              jobId: job.id,
              leaseToken,
            }
          );

          return;
        }

        workerLeaseRenewalFailuresTotal.inc({ job_type: job.type });

        logger.warn(
          "Job lease renewal failed",
          {
            jobId: job.id,
            leaseToken,
            error: error.message,
          }
        );

        renewalTimer = setTimeout(
          () => {
            void renew();
          },
          1_000
        );
      }
    }

    const initialExpiry =
      new Date(
        job.leaseExpiresAt
      ).getTime();

    const initialRemaining =
      initialExpiry - Date.now();

    const nextDelay = Math.max(
      1_000,
      Math.floor(
        initialRemaining / 2
      )
    );

    renewalTimer = setTimeout(
      () => {
        void renew();
      },
      nextDelay
    );

    return () => {
      if (renewalTimer) {
        clearTimeout(renewalTimer);
        renewalTimer = null;
      }
    };
  }

  async function pollOnce() {
    if (stopped || executing) {
      return;
    }

    try {
      const result =
        await client.claimJob();

      if (!result?.job) {
        return;
      }

      const job = result.job;
      const leaseToken = job.leaseToken;

      await withSpan("worker.execute", { traceparent: job.traceparent, attributes: { "job.type": job.type } }, async (span) => {
        workerJobsClaimedTotal.inc({ job_type: job.type });

        logger.info(
          "Job claimed",
          {
            jobId: job.id,
            type: job.type,
            leaseToken,
          }
        );

        executing = true;

        const controller =
          new AbortController();

        const state = {
          cancelRequested:
            Boolean(
              job.cancelRequestedAt
            ),
          leaseLost: false,
          finished: false,
        };

        const stopLeaseRenewal =
          startLeaseRenewal(
            job,
            leaseToken,
            state
          );

        const cancellationWatcher =
          watchForCancellation(
            job,
            controller,
            state
          );

        const startTime = Date.now();

        try {
          if (state.cancelRequested) {
            controller.abort();
          }

          const executionResult =
            await executeJob(job, {
              signal:
                controller.signal,
            });

          state.finished = true;

          workerJobExecutionDuration.observe({ job_type: job.type }, (Date.now() - startTime) / 1000);

          await cancellationWatcher;

          if (state.cancelRequested) {
            await handleCancelledJob(
              job,
              leaseToken,
              state
            );

            return;
          }

          if (state.leaseLost) {
            logger.warn(
              "Skipping completion because lease was lost",
              {
                jobId: job.id,
                leaseToken,
              }
            );

            return;
          }

          await client.completeJob(
            job.id,
            leaseToken,
            executionResult
          );

          workerJobsCompletedTotal.inc({ job_type: job.type });

          logger.info(
            "Job completed",
            {
              jobId: job.id,
              type: job.type,
              leaseToken,
            }
          );
          span.setStatus("ok");
        } catch (error) {
          state.finished = true;

          controller.abort();

          await cancellationWatcher;

          if (
            state.cancelRequested ||
            error.code === "JOB_CANCELLED"
          ) {
            await handleCancelledJob(
              job,
              leaseToken,
              {
                ...state,
                cancelRequested: true,
              }
            );

            return;
          }

          workerJobsFailedTotal.inc({ job_type: job.type });

          logger.error(
            "Job execution failed",
            {
              jobId: job.id,
              type: job.type,
              leaseToken,
              error: error.message,
            }
          );
          span.recordException(error);
        } finally {
          state.finished = true;

          stopLeaseRenewal();

          executing = false;
        }
      });
    } catch (error) {
      workerPollErrorsTotal.inc();
      logger.error(
        "Job polling failed",
        {
          nodeId: config.NODE_ID,
          error: error.message,
        }
      );
    }
  }

  function start() {
    if (timer) {
      return;
    }

    stopped = false;

    void pollOnce();

    timer = setInterval(() => {
      void pollOnce();
    }, config.JOB_POLL_INTERVAL_MS);
  }

  function stop() {
    stopped = true;

    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    start,
    stop,
  };
}
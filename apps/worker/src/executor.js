function sleep(durationMs, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      const error = new Error("Job cancellation requested");
      error.code = "JOB_CANCELLED";
      reject(error);
      return;
    }

    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, durationMs);

    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }

    function onAbort() {
      cleanup();

      const error = new Error(
        "Job cancellation requested"
      );

      error.code = "JOB_CANCELLED";

      reject(error);
    }

    signal?.addEventListener(
      "abort",
      onAbort,
      { once: true }
    );
  });
}

export async function executeJob(
  job,
  { signal } = {}
) {
  switch (job.type) {
    case "echo": {
      return {
        message: job.payload?.message ?? null,
      };
    }

    case "sleep": {
      const durationMs = Number(
        job.payload?.durationMs
      );

      if (
        !Number.isInteger(durationMs) ||
        durationMs < 0 ||
        durationMs > 300_000
      ) {
        throw new Error(
          "sleep job requires durationMs between 0 and 300000"
        );
      }

      await sleep(durationMs, signal);

      return {
        sleptMs: durationMs,
      };
    }

    default:
      throw new Error(
        `Unsupported job type: ${job.type}`
      );
  }
}
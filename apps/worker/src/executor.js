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

      const error = new Error("Job cancellation requested");

      error.code = "JOB_CANCELLED";

      reject(error);
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export async function executeJob(job, { signal } = {}) {
  switch (job.type) {
    case "echo": {
      return {
        message: job.payload?.message ?? null,
      };
    }

    case "sleep": {
      const durationMs = Number(job.payload?.durationMs);

      if (
        !Number.isInteger(durationMs) ||
        durationMs < 0 ||
        durationMs > 300_000
      ) {
        throw new Error("sleep job requires durationMs between 0 and 300000");
      }

      await sleep(durationMs, signal);

      return {
        sleptMs: durationMs,
      };
    }

    case "http": {
      const url = job.payload?.url;
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch (e) {
        throw new Error("Invalid URL provided for HTTP job");
      }

      const method = (job.payload?.method || "GET").toUpperCase();
      const validMethods = [
        "GET",
        "POST",
        "PUT",
        "DELETE",
        "PATCH",
        "HEAD",
        "OPTIONS",
      ];
      if (!validMethods.includes(method)) {
        throw new Error(`Invalid HTTP method: ${method}`);
      }

      let timeoutMs = 30000;
      if (job.payload?.timeout) {
        const match = String(job.payload.timeout).match(/^(\d+)(ms|s|m)?$/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (match[2] === "s") timeoutMs = val * 1000;
          else if (match[2] === "m") timeoutMs = val * 60000;
          else timeoutMs = val;
        }
      }

      const controller = new AbortController();
      let timeoutHandle;

      const onAbort = () => controller.abort();
      if (signal) {
        if (signal.aborted) {
          const err = new Error("Job cancellation requested");
          err.code = "JOB_CANCELLED";
          throw err;
        }
        signal.addEventListener("abort", onAbort);
      }

      timeoutHandle = setTimeout(
        () => controller.abort(new Error("Timeout")),
        timeoutMs,
      );

      const start = Date.now();
      let res;
      try {
        res = await fetch(parsedUrl.toString(), {
          method,
          signal: controller.signal,
        });
      } catch (e) {
        if (e.name === "AbortError") {
          if (signal?.aborted) {
            const err = new Error("Job cancellation requested");
            err.code = "JOB_CANCELLED";
            throw err;
          }
          throw new Error(`HTTP Request timed out after ${timeoutMs}ms`);
        }
        throw new Error(`HTTP Request failed: ${e.message}`);
      } finally {
        clearTimeout(timeoutHandle);
        if (signal) signal.removeEventListener("abort", onAbort);
      }

      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
      }

      let bodyText = "";
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let bytesRead = 0;
        const MAX_BYTES = 50 * 1024;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytesRead += value.byteLength;
          bodyText += decoder.decode(value, { stream: true });
          if (bytesRead > MAX_BYTES) {
            bodyText += "\n...[truncated]";
            await reader.cancel();
            break;
          }
        }
        bodyText += decoder.decode();
      }

      const duration = Date.now() - start;

      return {
        status: res.status,
        durationMs: duration,
        body: bodyText,
      };
    }

    case "command": {
      if (process.env.STRATUM_ENABLE_COMMAND_JOBS !== "true") {
        throw new Error(
          "Command execution is disabled. Set STRATUM_ENABLE_COMMAND_JOBS=true to enable.",
        );
      }
      const command = job.payload?.command;
      if (!command) throw new Error("Command job requires a command string");
      if (typeof command !== "string")
        throw new Error("Command must be a string");

      if (signal?.aborted) {
        const err = new Error("Job cancellation requested");
        err.code = "JOB_CANCELLED";
        throw err;
      }

      let timeoutMs = 60000;
      if (job.payload?.timeout) {
        const match = String(job.payload.timeout).match(/^(\d+)(ms|s|m)?$/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (match[2] === "s") timeoutMs = val * 1000;
          else if (match[2] === "m") timeoutMs = val * 60000;
          else timeoutMs = val;
        }
      }

      const start = Date.now();

      return new Promise((resolve, reject) => {
        let child;
        const onAbort = () => {
          if (child) child.kill("SIGKILL");
          const err = new Error("Job cancellation requested");
          err.code = "JOB_CANCELLED";
          reject(err);
        };

        if (signal) signal.addEventListener("abort", onAbort, { once: true });

        const MAX_BYTES = 50 * 1024;

        child = exec(
          command,
          { timeout: timeoutMs, killSignal: "SIGKILL", maxBuffer: MAX_BYTES },
          (error, out, err) => {
            if (signal) signal.removeEventListener("abort", onAbort);
            if (error) {
              if (error.killed) {
                reject(
                  new Error(
                    `Command timed out after ${timeoutMs}ms or was killed`,
                  ),
                );
                return;
              }
              reject(
                new Error(
                  `Command failed with exit code ${error.code}: ${err.substring(0, 200) || error.message.substring(0, 100)}`,
                ),
              );
              return;
            }
            resolve({
              exitCode: 0,
              durationMs: Date.now() - start,
              stdout: out,
              stderr: err,
            });
          },
        );
      });
    }

    default:
      throw new Error(`Unsupported job type: ${job.type}`);
  }
}

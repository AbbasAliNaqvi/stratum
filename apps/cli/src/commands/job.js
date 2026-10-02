import { Command } from "commander";

import {
  printJson,
  printError,
  printJobSummary,
  printJobTable,
  printJobEvents,
} from "../output.js";

export function registerJobCommands(program, { client }) {
  const job = program
    .command("job")
    .description("Manage jobs");

  /*
   * stratum job submit
   */
  job
    .command("submit")
    .description("Submit a new job to the control plane")
    .requiredOption("-t, --type <type>", "Job type (e.g. echo, sleep)")
    .option("-p, --payload <json>", "Job payload as JSON string", "{}")
    .option("--priority <number>", "Job priority (higher = sooner)", "0")
    .option("--max-retries <number>", "Maximum retry attempts", "3")
    .option("--idempotency-key <key>", "Idempotency key")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        let payload;

        try {
          payload = JSON.parse(options.payload);
        } catch {
          printError("Invalid JSON payload", {
            json: options.json,
          });

          process.exitCode = 1;
          return;
        }

        const priority = parseInt(options.priority, 10);

        if (Number.isNaN(priority)) {
          printError("Priority must be a number", {
            json: options.json,
          });

          process.exitCode = 1;
          return;
        }

        const maxRetries = parseInt(options.maxRetries, 10);

        if (Number.isNaN(maxRetries) || maxRetries < 0) {
          printError("Max retries must be a non-negative number", {
            json: options.json,
          });

          process.exitCode = 1;
          return;
        }

        const body = {
          type: options.type,
          payload,
          priority,
          maxRetries,
        };

        if (options.idempotencyKey) {
          body.idempotencyKey = options.idempotencyKey;
        }

        const result = await client.submitJob(body);

        if (options.json) {
          printJson(result);
          return;
        }

        console.log("\n  Job submitted successfully.");
        printJobSummary(result.job);
      } catch (error) {
        printError(error.message, {
          json: options.json,
        });

        process.exitCode = 1;
      }
    });

  /*
   * stratum job list
   */
  job
    .command("list")
    .description("List jobs")
    .option("-s, --status <status>", "Filter by status")
    .option("-t, --type <type>", "Filter by job type")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const result = await client.listJobs({
          status: options.status,
          type: options.type,
        });

        if (options.json) {
          printJson(result);
          return;
        }

        printJobTable(result.jobs ?? []);
      } catch (error) {
        printError(error.message, {
          json: options.json,
        });

        process.exitCode = 1;
      }
    });

  /*
   * stratum job status <id>
   */
  job
    .command("status")
    .description("Show detailed job status")
    .argument("<id>", "Job ID")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const result = await client.getJob(id);

        if (options.json) {
          printJson(result);
          return;
        }

        printJobSummary(result.job);
        printJobEvents(result.events);
      } catch (error) {
        if (error.status === 404) {
          printError(`Job not found: ${id}`, {
            json: options.json,
          });

          process.exitCode = 1;
          return;
        }

        printError(error.message, {
          json: options.json,
        });

        process.exitCode = 1;
      }
    });

  /*
   * stratum job cancel <id>
   */
  job
    .command("cancel")
    .description("Cancel a job")
    .argument("<id>", "Job ID")
    .option("--json", "Output as JSON")
    .action(async (id, options) => {
      try {
        const result = await client.cancelJob(id);

        if (options.json) {
          printJson(result);
          return;
        }

        const status = result.job?.status ?? "unknown";

        console.log(
          `\n  Job ${id} — ${status}\n`,
        );
      } catch (error) {
        if (error.status === 404) {
          printError(`Job not found: ${id}`, {
            json: options.json,
          });

          process.exitCode = 1;
          return;
        }

        if (error.status === 409) {
          printError(
            error.body?.error ??
              "Job cannot be cancelled in its current state",
            { json: options.json },
          );

          process.exitCode = 1;
          return;
        }

        printError(error.message, {
          json: options.json,
        });

        process.exitCode = 1;
      }
    });
}

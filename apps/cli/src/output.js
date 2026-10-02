/**
 * Output formatting for the Stratum CLI.
 *
 * Human-readable output by default, with --json
 * mode for machine consumption.
 */

export function formatTimestamp(ts) {
  if (!ts) {
    return "—";
  }

  return new Date(ts).toLocaleString();
}

export function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

export function printError(message, { json = false } = {}) {
  if (json) {
    console.error(
      JSON.stringify({ error: message }),
    );
  } else {
    console.error(`Error: ${message}`);
  }
}

export function printJobSummary(job) {
  const lines = [
    "",
    `  Job ID:       ${job.id}`,
    `  Type:         ${job.type}`,
    `  Status:       ${job.status}`,
    `  Priority:     ${job.priority}`,
  ];

  if (job.lockedBy) {
    lines.push(`  Locked By:    ${job.lockedBy}`);
    lines.push(`  Lease Token:  ${job.leaseToken}`);
    lines.push(
      `  Lease Expires: ${formatTimestamp(job.leaseExpiresAt)}`,
    );
  }

  lines.push(
    `  Retries:      ${job.retryCount}/${job.maxRetries}`,
  );

  if (job.idempotencyKey) {
    lines.push(`  Idempotency:  ${job.idempotencyKey}`);
  }

  lines.push(`  Created:      ${formatTimestamp(job.createdAt)}`);

  if (job.startedAt) {
    lines.push(`  Started:      ${formatTimestamp(job.startedAt)}`);
  }

  if (job.finishedAt) {
    lines.push(`  Finished:     ${formatTimestamp(job.finishedAt)}`);
  }

  if (job.cancelRequestedAt) {
    lines.push(
      `  Cancel Req:   ${formatTimestamp(job.cancelRequestedAt)}`,
    );
  }

  if (job.result) {
    lines.push(`  Result:       ${JSON.stringify(job.result)}`);
  }

  if (job.error) {
    lines.push(`  Error:        ${job.error}`);
  }

  lines.push("");

  console.log(lines.join("\n"));
}

export function printJobTable(jobs) {
  if (jobs.length === 0) {
    console.log("\n  No jobs found.\n");
    return;
  }

  const header =
    "  ID                                     TYPE         STATUS       PRIORITY";
  const separator =
    "  ─────────────────────────────────────── ──────────── ──────────── ────────";

  console.log("");
  console.log(header);
  console.log(separator);

  for (const job of jobs) {
    const id = job.id.padEnd(36);
    const type = (job.type ?? "").padEnd(12);
    const status = (job.status ?? "").padEnd(12);
    const priority = String(job.priority ?? 0);

    console.log(`  ${id}   ${type} ${status} ${priority}`);
  }

  console.log(`\n  Total: ${jobs.length}\n`);
}

export function printJobEvents(events) {
  if (!events || events.length === 0) {
    return;
  }

  console.log("  Events:");
  console.log(
    "  ─────────────────────────────────────────────────",
  );

  for (const event of events) {
    const time = formatTimestamp(event.createdAt);
    const type = (event.eventType ?? "").padEnd(18);
    const node = event.nodeId ?? "";

    console.log(`  ${time}  ${type} ${node}`);

    if (event.message) {
      console.log(`                               ${event.message}`);
    }
  }

  console.log("");
}

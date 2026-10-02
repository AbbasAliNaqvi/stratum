# PROGRESS

Chronological engineering log for the Stratum distributed backend control plane.

---

## Milestone: Lease Renewal

**Date:** 2026-10-02

### Problem

A real integration test revealed a distributed-systems bug: a worker executing a long-running job (e.g. `sleep 30s`) with a lease duration of 30s would lose its lease because the lease expired before the job finished. The control plane would reclaim the job and increment the lease token, causing the original worker to lose ownership.

### What Was Built

Implemented a full lease-renewal mechanism across the entire stack:

#### Control Plane — Repository

- Added `renewJobLease({ jobId, nodeId, leaseToken, leaseDurationMs })` to `repository.js`
- Renewal only succeeds when ALL conditions are true:
  - Job exists and `status = running`
  - `lockedBy = nodeId` and `leaseToken` matches
  - Current lease has NOT expired
  - `cancelRequestedAt IS NULL`
- On success: extends `leaseExpiresAt` without changing `leaseToken`
- Returns `null` on fencing/invalid renewal
- Does NOT create a `job_events` row for normal renewal

#### Control Plane — Service

- Added `renewJobLease(input)` to `service.js` following existing repository-wrapper pattern

#### Control Plane — Route

- Added `POST /jobs/:id/renew` to `routes.js`
- Request body: `{ nodeId, leaseToken }`
- Uses configured `JOB_LEASE_DURATION_MS` for renewal duration
- Returns HTTP 200 with `{ job }` on success
- Returns HTTP 409 on invalid/stale/expired/cancelled lease

#### Worker — Client

- Added `renewJobLease(jobId, leaseToken)` to `client.js`
- Calls `POST /jobs/:id/renew` with `{ nodeId, leaseToken }`

#### Worker — Poller

- Implemented `startLeaseRenewal()` in `poller.js` with:
  - Automatic renewal at ~half remaining lease
  - Minimum 1-second delay floor
  - HTTP 409 → `state.leaseLost = true` (stops renewal)
  - Network errors → retry after 1s
  - Stops renewal when job finishes or cancellation is detected
  - Lease loss prevents `completeJob()` from being called

### Files Changed

| File | Change |
|------|--------|
| `apps/control-plane/src/modules/jobs/repository.js` | Added `renewJobLease()` |
| `apps/control-plane/src/modules/jobs/service.js` | Added `renewJobLease()` wrapper |
| `apps/control-plane/src/modules/jobs/routes.js` | Added `POST /jobs/:id/renew` route |
| `apps/control-plane/src/modules/jobs/repository.test.js` | Added 5 lease renewal tests |
| `apps/control-plane/src/modules/nodes/monitor.test.js` | No changes (existing) |
| `apps/worker/src/client.js` | Added `renewJobLease()` |
| `apps/worker/src/poller.js` | Added lease renewal lifecycle |
| `apps/worker/src/executor.js` | No changes |
| `apps/worker/src/index.js` | No changes |
| `apps/worker/package.json` | Added `test` script |
| `apps/worker/src/poller.test.js` | Created with 7 tests |

### Tests

#### Control Plane (`repository.test.js` + `monitor.test.js`)

```
repository.test.js    16/16  (11 original + 5 lease renewal)
monitor.test.js        2/2

TOTAL                 18/18  ✅
```

New lease renewal tests:
1. ✅ Renews a valid lease and extends `leaseExpiresAt`
2. ✅ Rejects renewal with an invalid lease token
3. ✅ Rejects renewal when cancellation is requested
4. ✅ Rejects renewal when the lease has expired
5. ✅ Does not create an event on successful renewal

#### Worker (`poller.test.js`)

```
poller.test.js         7/7

TOTAL                  7/7  ✅
```

Worker poller tests:
1. ✅ Schedules lease renewal after claiming a job
2. ✅ Schedules another renewal after a successful one
3. ✅ Sets `leaseLost` on HTTP 409 and stops renewal
4. ✅ Retries renewal on network error
5. ✅ Does not renew after job finishes
6. ✅ Does not renew after cancellation is detected
7. ✅ Skips completion when lease is lost

#### Static Checks

```
node --check client.js    ✅
node --check poller.js    ✅
node --check index.js     ✅
node --check executor.js  ✅
```

### Integration Test Results

#### Long-running job (60s sleep with 30s lease)

```
Job claimed         leaseToken: 1  (09:06:19)
Job lease renewed   leaseToken: 1  (09:06:34)
Job lease renewed   leaseToken: 1  (09:06:49)
Job lease renewed   leaseToken: 1  (09:07:04)
Job completed       leaseToken: 1  (09:07:20)
```

Final database state:
- `status = succeeded`
- `leaseToken = 1` (never incremented)
- `lockedBy = null`
- `leaseExpiresAt = null`
- Events: `queued → claimed → completed` (no renewal events in DB)
- No reclaim occurred ✅

#### Cancellation flow

```
Job claimed              leaseToken: 1  (09:07:41)
Cancel requested                        (09:07:54)
Cancellation detected                   (09:07:54)
Job cancelled            leaseToken: 1  (09:07:54)
```

Final database state:
- `status = cancelled`
- `leaseToken = 1`
- `lockedBy = null`
- `leaseExpiresAt = null`
- No "lease lost" logged — cancellation remained semantically separate ✅

### Known Limitations

- No exponential backoff on renewal retry (uses fixed 1s delay)
- Worker does not abort execution on lease loss (job continues running but completion is skipped)

### Next Steps

- CLI for submitting jobs and inspecting status
- Observability layer (metrics, structured logging)
- AI diagnostics engine
- Policy/authorization engine
- Self-healing mechanisms

---

## Milestone: CLI Foundation + Job Operations

**Date:** 2026-10-02

### Problem

The control plane API was implemented, but interacting with it required manually crafting `curl` requests. A CLI was needed to provide a clean, human-readable interface for job submission and management, without duplicating existing business logic from the control plane.

### What Was Built

Created a new `@stratum/cli` package under `apps/cli` using `commander` for argument parsing. The CLI acts as a thin wrapper over the existing HTTP control plane APIs.

#### CLI Core Structure
- **bin/stratum.js**: Executable entry point.
- **src/program.js**: Dependency-injected program builder (allows testing without real HTTP calls).
- **src/config.js**: Simple environment-driven configuration (defaults `STRATUM_CONTROL_PLANE_URL` to `http://127.0.0.1:3000`).
- **src/client.js**: Lightweight `fetch` wrapper mapping CLI actions to control plane routes (`POST /jobs`, `GET /jobs`, `GET /jobs/:id`, `POST /jobs/:id/cancel`).
- **src/output.js**: Specialized output formatters for rendering human-readable tables, summaries, and JSON.
- **src/commands/job.js**: The primary command namespace.

#### Commands Implemented
- `stratum job submit`: Submits a job. Supports `-t, --type`, `-p, --payload`, `--priority`, `--max-retries`, and `--idempotency-key`.
- `stratum job list`: Lists jobs in a table. Supports `-s, --status` and `-t, --type` filters.
- `stratum job status <id>`: Fetches and displays job state, metadata, and event history.
- `stratum job cancel <id>`: Cancels a queued or running job.
- `--json`: Every command supports a `--json` flag to return raw machine-readable data instead of human-formatted output.

### Files Changed

| File | Change |
|------|--------|
| `package.json` | Updated `test` script to use `--if-present`. |
| `README.md` | Documented CLI architecture and commands; removed CLI from Roadmap. |
| `apps/cli/package.json` | Created basic package configuration. |
| `apps/cli/bin/stratum.js` | Created executable entry point. |
| `apps/cli/src/program.js` | Created core program builder. |
| `apps/cli/src/config.js` | Created environment configuration. |
| `apps/cli/src/client.js` | Created control plane HTTP client. |
| `apps/cli/src/output.js` | Created terminal formatters. |
| `apps/cli/src/commands/job.js` | Implemented `job` subcommand suite. |
| `apps/cli/src/cli.test.js` | Added comprehensive CLI test suite. |

### Tests

```
src/cli.test.js       25/25
```

Test suite explicitly covers:
1. Command parsing (help, version, subcommand help).
2. Option parsing and type validation for job submission.
3. Successful API responses and correct console output.
4. JSON formatting when `--json` is provided.
5. Error handling mapping HTTP 404/409/500 to user-friendly messages and correct non-zero exit codes.
6. Network timeout/connection failure handling.

### Integration Test Results

Manually verified against a live local control plane:
1. Ran `node apps/cli/bin/stratum.js job submit -t echo -p '{"msg":"hello"}' --json` -> Successfully submitted.
2. Ran `node apps/cli/bin/stratum.js job status <id>` -> Successfully fetched and displayed human-readable summary + event log.
3. Ran `node apps/cli/bin/stratum.js job list` -> Output correctly mapped jobs to a table.
4. Ran `node apps/cli/bin/stratum.js job submit -t sleep -p '{"durationMs": 100000}' --json` followed by `job cancel <id>` -> Job successfully cancelled.
5. *Cleaned up the test jobs manually from the database.*

### Known Limitations

- `job list` currently doesn't support pagination; it simply retrieves whatever the control plane returns.
- Output tables might wrap unpleasantly if the terminal is too narrow.

### Next Steps

- Observability layer (metrics, structured logging)
- AI diagnostics engine
- Policy/authorization engine
- Self-healing mechanisms

---

## Milestone: Observability Foundation — Metrics + Structured Telemetry

**Date:** 2026-10-02

### Problem

The distributed control plane and worker components lacked visibility. Diagnosing issues required ad-hoc inspection, and there was no way to systematically monitor job lifecycles, execution latencies, node liveness, or system health without directly querying the PostgreSQL database, which doesn't scale for metrics.

### What Was Built

Implemented a lightweight, dependency-free telemetry layer exposing Prometheus-compatible metrics and structured JSON logging.

#### `packages/metrics`
- Created a standalone Prometheus-compatible metrics registry supporting Counters, Gauges, and Histograms.
- Uses memory-bound data structures without relying on PostgreSQL or external daemons.
- Implemented Prometheus text exposition format rendering.

#### Control Plane Instrumentation
- Added structured JSON logging via `pino` (already available via `@stratum/logger`).
- Exposed `GET /metrics` HTTP endpoint.
- Handled HTTP request metrics via Fastify middleware.
- Instrumented Job Lifecycle (created, claimed, completed, failed, cancelled, reclaimed).
- Instrumented Node Lifecycle (registered, heartbeat received, stale nodes, recovered nodes).
- Added Execution and Queued Wait histograms for jobs.

#### Worker Instrumentation
- Migrated standard `console.log` statements to use a lightweight structural JSON logger.
- Instrumented Job Poller lifecycle (claimed, completed, failed, executed duration).
- Instrumented Node Heartbeats and Lease Renewals (renewals, failures, lease lost).
- Implemented a background metrics dump mechanism, writing Prometheus metrics to standard output every 60 seconds (since the worker does not have an HTTP server).

### Files Changed

| File | Change |
|------|--------|
| `packages/metrics/src/index.js` | Built lightweight metrics registry |
| `packages/metrics/src/index.test.js` | Added metrics registry unit tests |
| `packages/metrics/package.json` | Created new workspace package |
| `apps/control-plane/src/modules/metrics/index.js` | Configured CP metrics singletons |
| `apps/control-plane/src/app.js` | Exposed `/metrics` and HTTP instrumentation |
| `apps/control-plane/src/modules/jobs/service.js` | Added metrics and structural logging to job flows |
| `apps/control-plane/src/modules/nodes/service.js` | Added metrics and structural logging to node flows |
| `apps/control-plane/src/modules/nodes/monitor.js` | Added metrics for stale node reclamation |
| `apps/worker/src/metrics.js` | Configured Worker metrics singletons |
| `apps/worker/src/index.js` | Added heartbeat metrics and metrics dump |
| `apps/worker/src/poller.js` | Added job execution and lease metrics |
| `apps/worker/src/logger.js` | Restructured basic logger into structured JSON |
| `README.md` | Documented observability layer |

### Tests

```
packages/metrics (index.test.js)   4/4 ✅
control-plane tests               18/18 ✅
worker tests                       7/7 ✅
cli tests                         25/25 ✅

TOTAL                             54/54 ✅
```

### Integration Test Results

Manually verified against a live local control plane and worker:
1. Ran `node apps/cli/bin/stratum.js job submit -t echo -p '{"message": "final check"}'`.
2. Verified that structured logs correctly tracked the job lifecycle (created → claimed → completed) in the CP and Worker.
3. Queried `GET /metrics` and verified correctly formatted Prometheus metrics (Counters, Gauges, Histograms) dynamically updating in real-time.

### Known Limitations

- The worker metrics are only accessible via log parsing (dumped periodically), preventing immediate dynamic scraping by Prometheus.
- The metrics registries are localized per-process. In a multi-replica setup, each replica exposes its own metrics.

### Next Steps

- AI diagnostics engine
- Policy/authorization engine
- Self-healing mechanisms

---

## Milestone: Distributed Tracing Foundation

**Date:** 2026-10-02

### Problem

While metrics and structured logging provided basic visibility, it was impossible to correlate the lifecycle of a job across multiple asynchronous boundaries and distributed components. When a job was submitted via the CLI, executed by a worker, and completed, there was no unified identifier or context tying those operations together, making debugging difficult.

### What Was Built

Implemented an in-process, dependency-free distributed tracing foundation based on the W3C `traceparent` specification, utilizing `node:async_hooks` to propagate trace context across execution boundaries.

#### `packages/tracing`
- Created a standalone tracing package utilizing `AsyncLocalStorage` to manage the active span context.
- Implemented `Span` objects with `traceId`, `spanId`, `parentSpanId`, `attributes`, `status`, and `error`.
- Built W3C `traceparent` parsing and serialization.
- Created an extensible exporter interface, including a `ConsoleExporter` (configured via `STRATUM_TRACING_ENABLED`) and `InMemoryExporter` (for testing).

#### CLI Tracing
- Automatically creates a root trace span for each CLI command invocation.
- Propagates the `traceparent` context downstream via HTTP headers to the control plane.

#### Control Plane Tracing
- Wrapped Fastify route handlers in a trace context using the `onRequest` hook.
- Extracted incoming `traceparent` headers to establish parent-child relationships for incoming HTTP requests.
- Added a `traceparent` column to the `jobs` database table.
- Preserved the trace context at job creation time by injecting `traceparent` into the job row.

#### Worker Tracing
- Restored trace context from the `job.traceparent` field upon job claim.
- Wrapped the entire job execution lifecycle (including claims, executions, completions, and lease renewals) inside a `worker.execute` span.
- Automatically associated all worker structured logs with the active `traceId` and `spanId`.

#### Correlated Logging
- Integrated `@stratum/tracing` with `@stratum/logger`.
- Configured Pino log formatters to automatically inject `traceId` and `spanId` into all JSON logs when an active trace context exists, enabling seamless correlation in log aggregators.

### Files Changed

| File | Change |
|------|--------|
| `packages/tracing/*` | Built tracing implementation from scratch |
| `packages/logger/package.json` | Added tracing dependency |
| `packages/logger/src/index.js` | Configured Pino formatter to inject trace IDs |
| `apps/control-plane/package.json` | Added tracing dependency |
| `apps/control-plane/src/app.js` | Fastify middleware to start spans from headers |
| `apps/control-plane/src/db/schema.js` | Added `traceparent` column to `jobs` table |
| `apps/control-plane/src/modules/jobs/service.js` | Persisted traceparent during job creation |
| `apps/worker/package.json` | Added tracing dependency |
| `apps/worker/src/logger.js` | Configured worker logger to inject trace IDs |
| `apps/worker/src/poller.js` | Wrapped job execution in span |
| `apps/cli/package.json` | Added tracing dependency |
| `apps/cli/src/client.js` | Wrapped CLI requests in span and passed headers |

### Tests

```
packages/tracing (index.test.js)   7/7 ✅
control-plane tests               18/18 ✅
worker tests                       7/7 ✅
cli tests                         25/25 ✅

TOTAL                             57/57 ✅
```

### Integration Test Results

Manually verified full end-to-end tracing in an active cluster:
1. Ran CP and Worker with `STRATUM_TRACING_ENABLED=true`.
2. Submitted job via CLI: `node apps/cli/bin/stratum.js job submit -t echo ...`
3. Verified the CLI emitted a root span: `{"name":"CLI POST /jobs", "traceId":"<ID>"}`
4. Verified the CP emitted an HTTP span inheriting the `traceId` and pointing to the CLI's `spanId` as `parentSpanId`.
5. Verified the Worker logs all correctly included the exact same `traceId`, and the final `worker.execute` span pointed back to the CP's HTTP span as its parent.
6. Tested a long-running `sleep` job and verified that mid-execution logs (like lease renewals) automatically inherited the trace context.

### Next Steps

- Job State Machine (Transitions)
- Webhooks / Event Subscriptions
- AI Diagnostics Prototype
- Policy / Authorization Engine
- Self-Healing Operations

---

## Milestone: Explicit Job State Machine + Atomic Transitions

**Date:** 2026-10-02

### Problem

The job lifecycle status updates were scattered across `repository.js`. There was no centralized source of truth defining which states existed and what transitions were permissible. This lack of validation risked race conditions, data inconsistencies, and unintended behavior, such as a cancelled job becoming succeeded, or a running job accidentally reverting to queued through an invalid path.

### What Was Built

Introduced a strictly enforced, centralized state machine for the job lifecycle, preventing any invalid state mutations before they reach the database.

#### State Machine Definition
- Created `apps/control-plane/src/modules/jobs/state.js`.
- Defined a `JOB_STATES` enum (queued, running, succeeded, failed, cancelled).
- Configured a `VALID_TRANSITIONS` registry specifying exactly which transitions are allowed.
- Exported an `assertValidTransition(from, to)` helper that throws an `INVALID_STATE_TRANSITION` error if an invalid transition is attempted.
- Validated that terminal states (succeeded, failed, cancelled) can transition to themselves (idempotency) but cannot transition out.

#### Repository Refactor
- Integrated `assertValidTransition` across all state-mutating functions in `repository.js`:
  - `claimNextJob` (queued/running -> running)
  - `completeJob` (running -> succeeded/failed)
  - `reclaimJobsForNode` (running -> queued/failed)
  - `requestJobCancellation` (queued -> cancelled)
  - `acknowledgeJobCancellation` (running -> cancelled)
- Refactored functions like `completeJob` to explicitly read the target row `FOR UPDATE` first to fetch its current status, validate the transition using `assertValidTransition`, and only then execute the `UPDATE`.

#### Observability & Telemetry
- Added a new Prometheus metric: `jobTransitionsTotal = registry.counter({ name: "stratum_job_transitions_total" })`.
- Added labels `from`, `to`, and `reason` to track bounded state progression frequency across the system.
- Updated `service.js` structured logging to emit `job.transition` logs containing `fromStatus`, `toStatus`, and `reason` instead of simplistic lifecycle events, making observability state-aware.

### Files Changed

| File | Change |
|------|--------|
| `apps/control-plane/src/modules/jobs/state.js` | Created state machine definition |
| `apps/control-plane/src/modules/jobs/state.test.js` | Created state machine unit tests |
| `apps/control-plane/src/modules/jobs/repository.js` | Integrated state checks and `FOR UPDATE` reads |
| `apps/control-plane/src/modules/jobs/service.js` | Emitted transition metrics and updated logs |
| `apps/control-plane/src/modules/jobs/routes.js` | Mapped `INVALID_STATE_TRANSITION` to HTTP 409 |
| `apps/control-plane/src/modules/metrics/index.js` | Added `jobTransitionsTotal` metric |

### Tests

```
packages/tracing (index.test.js)   7/7 ✅
packages/metrics (index.test.js)   4/4 ✅
control-plane tests               31/31 ✅ (Including 13 new state machine tests)
worker tests                       7/7 ✅
cli tests                         25/25 ✅

TOTAL                             74/74 ✅
```

### Integration Test Results

Manually verified all lifecycle transitions end-to-end:
1. **Normal Flow**: Submitted a job, worker claimed it, worker successfully completed it (`queued` -> `running` -> `succeeded`).
2. **Immediate Cancellation**: Submitted a queued job and immediately cancelled it. Validated atomic transition `queued` -> `cancelled`.
3. **Running Cancellation**: Submitted a long-running job, allowed worker to claim it (`queued` -> `running`). Requested cancellation. Worker detected request and gracefully acknowledged it (`running` -> `cancelled`). Control plane perfectly enforced state rules and metrics observed all paths.
4. **Reclamation**: Force-stopped a worker mid-execution. Control plane successfully reclaimed the job (`running` -> `queued`) using the state-machine-approved transition.

### Next Steps

- Webhooks / Event Subscriptions
- AI Diagnostics Prototype
- Policy / Authorization Engine
- Self-Healing Operations

---

## Milestone: User Documentation UX Redesign

**Date:** 2026-10-02

### Objective
Redesign `docs/HOW_TO_USE_STRATUM.md` as a premium, extremely user-friendly product documentation page targeted at first-time users, prioritizing documentation UX over deep technical details.

### What Was Built
- Rewrote the entire user guide to be scannable, visually clean, and beginner-friendly.
- Added a "Your first 5 minutes" quick start section.
- Added clear, simple ASCII architecture and lifecycle diagrams.
- Grouped instructions logically (Prerequisites → Install → Environment → Start → Submit Job → Monitor → Troubleshoot).
- Replaced technical jargon with plain English (e.g., changed "Self-Healing" to "automatic job reclamation and retry" to accurately reflect the currently implemented system without overpromising future features).
- Added a Troubleshooting matrix and Common Commands cheat sheet.

### Verification Performed
- Validated all `.env` variables against the current repository state.
- Checked that database migration and script start commands precisely match `package.json`.
- Confirmed CLI syntax, job types (`echo` and `sleep`), `/health`, and `/metrics` APIs match the live endpoints.

### Files Changed
- `docs/HOW_TO_USE_STRATUM.md`
- `README.md` (Added direct link to user guide)

### Next Steps
- Webhooks / Event Subscriptions
- AI Diagnostics Prototype
- Policy / Authorization Engine

---

## Milestone: Zero-Configuration Runtime + Unified CLI

**Date:** 2026-10-02

### Original UX Problem
The product experience was heavily infrastructure-focused. Users had to manually manage `.env` files, run database migrations, and juggle separate terminal windows for the Control Plane and Worker processes. This created unnecessary friction and didn't feel like a polished, cohesive product.

### Design Decisions
- **Zero-Configuration Default:** The system now handles starting its own backend infrastructure without requiring the user to run multiple `npm run dev` commands manually.
- **Unified Interface:** The Stratum CLI (`stratum`) serves as the single entry point.
- **Interactive Control Panel:** Invoking the CLI with no arguments opens a clean, simple terminal dashboard to view status, jobs, workers, and submit new jobs interactively.

### Final User Workflow
```bash
npm install
npm link
stratum init
stratum
```

### Automation & Runtime Management
- **`stratum init`**: Detects dependencies, runs migrations, initializes the runtime directory, and spawns the Control Plane and Worker as background daemon processes.
- **Lifecycle Commands**: `start`, `stop`, `restart`, `status`, `doctor`, and `logs` automatically read and manage detached background PIDs securely.
- **Interactive Mode**: Replaced complex flags with interactive prompts when running jobs via the dashboard.

### Tests
- Validated lifecycle commands (`status`, `doctor`).
- Confirmed that backend execution semantics (PostgreSQL, state machine, observability, traces) remain strictly intact and unaffected by the new CLI orchestrator layer.
- Ran all 74 workspace integration tests (Pass: 74, Fail: 0).

### Known Limitations
- Background services are tied to the local machine and do not restart automatically on system reboot.
- The interactive UI relies on `readline` and is simple by design to avoid massive dependencies.

### Next Steps
- Webhooks / Event Subscriptions
- AI Diagnostics Prototype

---

## Milestone: Stratum Interactive Console UX v2

**Date:** 2026-10-02

### Objective
Redesign the interactive Stratum terminal from a numbered admin menu into a modern developer-oriented slash-command console inspired by contemporary interactive CLIs. The goal is to make Stratum feel like a real distributed work control product, not a basic job scheduler.

### Design Decisions
- **Eliminated the numbered menu**: The old `1 Run Job / 2 Jobs / 3 Workers / ...` navigation was replaced with a persistent input prompt (`›`) and a slash-command system.
- **Slash command architecture**: All interactive operations use a central command registry (`/work`, `/jobs`, `/workers`, `/status`, `/logs`, `/doctor`, `/model`, `/config`, `/help`, `/clear`, `/quit`) with aliases and tab-completion.
- **Shared UI primitives layer**: Created `apps/cli/src/ui.js` — a dedicated output module providing box-drawing, tables, key-value panels, status icons, spinners, colour helpers, and ANSI-safe formatting. Every visual element in the CLI renders through this layer.
- **Interactive selection menus**: `/work` uses arrow-key navigation with raw-mode stdin to let users select workload types without typing numbers.
- **Command history**: The readline-based REPL supports ↑/↓ history navigation within the session.
- **Box-drawn header**: The console opens with a compact status box showing system health, worker count, and queue metrics at a glance.
- **Terminal robustness**: Ctrl+C returns to prompt (does not crash), Ctrl+D exits cleanly, Escape cancels interactive selections, and raw mode is always properly restored on exit.
- **Product terminology**: User-facing language emphasizes "work", "workers", "runtime", "system" rather than "job scheduler" and "queue administration".
- **`/model` foundation**: Added as a truthful configuration surface for the future AI Diagnostics milestone. Currently shows `No AI model configured` with environment variable documentation. Does NOT fake AI functionality.

### What Was Built
- `apps/cli/src/ui.js` — Shared UI primitives (colours, box drawing, tables, key-value panels, spinners, status icons, time formatting)
- `apps/cli/src/interactive.js` — Complete rewrite: persistent REPL console with slash commands, autocomplete, command history, arrow-key selection, and polished output
- `apps/cli/src/ui.test.js` — 14 tests for UI primitives

### Slash Commands Implemented
| Command | Description |
| ------- | ----------- |
| `/work` | Interactive workload submission with arrow-key type selection |
| `/jobs [filter]` | Browse jobs with optional status filter |
| `/workers` | View registered worker nodes with heartbeat status |
| `/status` | Full system health overview using centralized health abstraction |
| `/logs` | Parsed structured log viewer from service log files |
| `/doctor` | Real diagnostic checks (Node, Control Plane, Workers) |
| `/model` | AI model configuration surface (future-ready) |
| `/config` | Safe runtime configuration display (no secrets) |
| `/help [cmd]` | Contextual help with per-command detail |
| `/clear` | Clear terminal screen |
| `/quit` | Clean exit |

### Verification Performed
- All 52 CLI tests pass (38 existing + 14 new UI tests).
- All 87 workspace tests pass across all workspaces.
- Direct CLI commands (`stratum status`, `stratum doctor`, `stratum job run`) remain fully functional.
- JSON mode (`--json`) remains operational.
- Terminal exits cleanly without leaving stdin in raw mode.

### Files Changed
- `apps/cli/src/interactive.js` (complete rewrite)
- `apps/cli/src/ui.js` (new)
- `apps/cli/src/ui.test.js` (new)
- `docs/HOW_TO_USE_STRATUM.md` (updated for slash commands)
- `PROGRESS.md` (this entry)

### Next Steps
- Real Workloads (HTTP jobs, command execution)
- AI Diagnostics Prototype (Groq API integration via `/model`)
- Webhooks / Event Subscriptions

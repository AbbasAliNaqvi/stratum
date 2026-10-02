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

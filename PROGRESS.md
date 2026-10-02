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

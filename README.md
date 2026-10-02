# Stratum

Distributed backend control plane for service orchestration, observability, intelligent diagnostics, and automated remediation.

## Architecture

```text
stratum/
├── apps/
│   ├── control-plane/    # Fastify API server
│   └── worker/           # Job execution worker
├── packages/             # Shared packages
├── infrastructure/       # Infrastructure configs
├── scripts/              # Utility scripts
├── tests/                # Integration tests
└── package.json          # npm workspaces root
```

## Stack

- **Runtime:** Node.js ≥ 22
- **API:** Fastify
- **Database:** PostgreSQL
- **ORM:** Drizzle
- **Testing:** Vitest
- **Package Manager:** npm workspaces

## Implemented Capabilities

### Control Plane

The control plane is a Fastify HTTP server that manages nodes and jobs.

#### Node APIs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/nodes` | Register a new worker node |
| `GET` | `/nodes` | List all registered nodes |
| `GET` | `/nodes/:nodeId` | Get node details |
| `POST` | `/nodes/:nodeId/heartbeat` | Send heartbeat from a worker |

#### Job APIs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/jobs` | Create a new job |
| `GET` | `/jobs` | List jobs (filterable by status, type) |
| `GET` | `/jobs/:id` | Get job details with event history |
| `POST` | `/jobs/claim` | Claim the next available job |
| `POST` | `/jobs/:id/complete` | Complete a running job |
| `POST` | `/jobs/:id/cancel` | Request job cancellation |
| `POST` | `/jobs/:id/cancel/acknowledge` | Acknowledge cancellation |
| `POST` | `/jobs/:id/renew` | Renew a job's lease |

#### Job States

```text
queued → running → succeeded
                 → failed
                 → cancelled
```

#### Lease Fencing

Every job has a `leaseToken` that increments when the job is reclaimed. Workers must present the correct token for completion, renewal, or cancellation acknowledgment. This prevents stale workers from interfering with jobs that have been reassigned.

#### Lease Renewal

Workers automatically renew their lease at approximately half the remaining lease duration. This prevents long-running jobs from being reclaimed while the worker is still actively executing them.

#### Cancellation

- Queued jobs are cancelled immediately
- Running jobs receive a cancellation request; the worker detects it, aborts execution, and acknowledges

#### Node Liveness

A background monitor detects nodes that have not sent a heartbeat within the configured timeout. Unreachable nodes have their jobs reclaimed (re-queued or failed depending on retry count).

### Worker

The worker is a standalone Node.js process that:

1. Registers with the control plane
2. Sends periodic heartbeats
3. Polls for available jobs
4. Executes jobs with abort support
5. Renews leases during long-running jobs
6. Detects and acknowledges cancellation requests
7. Completes or reports job results

#### Supported Job Types

| Type | Description |
|------|-------------|
| `echo` | Returns the input message |
| `sleep` | Sleeps for a specified duration (0–300000ms) |

## Setup

### Prerequisites

- Node.js ≥ 22
- PostgreSQL

### Install

```bash
npm install
```

### Environment

Copy `.example.env` to `.env` and configure:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/stratum
CONTROL_PLANE_HOST=127.0.0.1
CONTROL_PLANE_PORT=3000
JOB_LEASE_DURATION_MS=30000
HEARTBEAT_TIMEOUT_MS=30000
HEARTBEAT_CHECK_INTERVAL_MS=5000
```

Worker-specific env (also in `.env`):

```env
STRATUM_CONTROL_PLANE_URL=http://127.0.0.1:3000
STRATUM_NODE_ID=my-worker-01
STRATUM_HEARTBEAT_INTERVAL_MS=10000
STRATUM_REQUEST_TIMEOUT_MS=5000
STRATUM_JOB_POLL_INTERVAL_MS=2000
STRATUM_JOB_CANCEL_CHECK_INTERVAL_MS=500
```

### Database

```bash
npm run db:generate
npm run db:migrate
```

### Run

```bash
# Start the control plane
npm run dev

# Start a worker (in a separate terminal)
npm run dev --workspace=@stratum/worker
```

### Test

```bash
# Control plane tests (requires running PostgreSQL)
npm run test --workspace=@stratum/control-plane

# Worker unit tests
npm run test --workspace=@stratum/worker
```

## Roadmap

- [ ] CLI for job submission and status inspection
- [ ] Observability (metrics, structured logging, tracing)
- [ ] AI-powered diagnostics engine
- [ ] Policy/authorization engine for AI-proposed actions
- [ ] Self-healing mechanisms

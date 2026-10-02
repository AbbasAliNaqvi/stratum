# How to Use Stratum

Run reliable distributed jobs without manually managing workers, leases, retries, and job state.

Stratum is a distributed job execution engine. You submit a job, Stratum puts it in a queue, a worker executes it, and the control plane safely tracks its state from start to finish.

---

### Your first 5 minutes

1. Start PostgreSQL locally.
2. Start the Control Plane: `npm run dev --workspace=@stratum/control-plane`
3. Start a Worker: `npm run dev --workspace=@stratum/worker`
4. Submit a job: `node apps/cli/bin/stratum.js job submit --type echo --payload '{"message":"hello"}'`
5. Check its status: `node apps/cli/bin/stratum.js job list`

---

## What is Stratum?

Stratum is composed of four main parts:

```text
                  Stratum

               ┌──────────┐
               │   CLI    │
               └────┬─────┘
                    │
                    ▼
          ┌──────────────────┐
          │  Control Plane   │
          └────────┬─────────┘
                   │
                   ▼
             ┌───────────┐
             │ PostgreSQL│
             └─────┬─────┘
                   │
             ┌─────┴─────┐
             ▼           ▼
        ┌────────┐  ┌────────┐
        │Worker 1│  │Worker 2│
        └────────┘  └────────┘
```

- **CLI**: A command-line tool to submit, manage, and inspect jobs.
- **Control Plane**: The central HTTP server that tracks state and exposes APIs.
- **PostgreSQL**: The database that safely persists jobs, events, and node health.
- **Worker**: The background process that fetches jobs, executes them, and reports back.

---

## Prerequisites

✅ Node.js 22+  
✅ PostgreSQL 14+  
✅ Git  

You can verify your installation by running:
```bash
node --version
psql --version
git --version
```

---

## Installation

Follow these steps to set up the engine locally.

### Step 1 — Clone
Clone the repository and navigate into the Stratum directory:
```bash
git clone https://github.com/your-org/stratum.git
cd stratum
```

### Step 2 — Install dependencies
Install the required packages:
```bash
npm install
```

### Step 3 — Create database
Ensure PostgreSQL is running, then create your database:
```bash
createdb stratum
```

### Step 4 — Run migrations
Stratum requires database tables to store jobs and events. Apply the schema:
```bash
npm run db:migrate
```

---

## Environment Configuration

Stratum relies on an `.env` file in the root directory for configuration. You can edit the existing `.env` file to customize your setup.

| Variable | What it controls | Example |
| -------- | ---------------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/stratum` |
| `CONTROL_PLANE_PORT` | The API port the Control Plane binds to | `3000` |
| `STRATUM_CONTROL_PLANE_URL` | The API address the Worker/CLI uses to connect | `http://127.0.0.1:3000` |
| `STRATUM_NODE_ID` | (Optional) Unique identifier for the Worker | `worker-1` |
| `STRATUM_TRACING_ENABLED` | (Optional) Enables distributed tracing (`true`/`false`) | `true` |

---

## Starting Stratum

Keep both terminals running while you use Stratum.

### Terminal 1 — Control Plane
```bash
npm run dev --workspace=@stratum/control-plane
```

### Terminal 2 — Worker
```bash
npm run dev --workspace=@stratum/worker
```

**Is it running?**
You can instantly verify the Control Plane is healthy:
```bash
curl -s http://127.0.0.1:3000/health
```
Expected response: `{"status":"ok","db":"connected"}`

---

## Your First Job

The easiest way to use Stratum is through the built-in CLI.

### 1. Submit
Submit an `echo` job (which returns immediately):
```bash
node apps/cli/bin/stratum.js job submit --type echo --payload '{"message":"Hello Stratum"}'
```

### 2. List
See all jobs currently in the system:
```bash
node apps/cli/bin/stratum.js job list
```

### 3. Check status
Copy the `<JOB_ID>` from the list output and inspect its history:
```bash
node apps/cli/bin/stratum.js job status <JOB_ID>
```

### 4. Cancel
To gracefully cancel an ongoing or queued job:
```bash
node apps/cli/bin/stratum.js job cancel <JOB_ID>
```

---

## How a Job Moves Through Stratum

```text
                  Submit
                     │
                     ▼
                 ┌───────┐
                 │ QUEUED│
                 └───┬───┘
                     │
                 Worker claims
                     │
                     ▼
                ┌─────────┐
                │ RUNNING │
                └────┬────┘
          ┌──────────┼──────────┐
          ▼          ▼          ▼
      SUCCEEDED    FAILED    CANCELLED
```

- **QUEUED**: The job is waiting in the database for an available worker.
- **RUNNING**: A worker has claimed the job and is actively executing it.
- **SUCCEEDED**: The worker successfully finished the job.
- **FAILED**: The worker encountered an error or exhausted all retries.
- **CANCELLED**: The job was explicitly cancelled by the user.

---

## Long-Running Jobs

A lease is Stratum's way of saying “this worker currently owns this job.”

When you submit a long-running job, the worker periodically renews its lease with the Control Plane. This proves the worker is still alive and prevents the job from being reclaimed prematurely.

Let's submit a job that sleeps for 60 seconds:
```bash
node apps/cli/bin/stratum.js job submit --type sleep --payload '{"durationMs":60000}'
```

Behind the scenes, the worker manages the lease for you:

```text
Worker
  │
  ├── claim job
  │
  ├── execute
  │
  ├── renew lease
  │
  ├── renew lease
  │
  └── complete
```

---

## Failure Recovery

What happens if a worker loses network connection or its server crashes mid-execution? Stratum provides automatic job reclamation and retry.

```text
Worker
   │
   │ running job
   X  ← worker crashes
   │
   ▼
Control Plane detects stale worker
   │
   ▼
Job reclaimed
   │
   ▼
queued
   │
   ▼
another worker can retry it
```

Once a worker's lease expires without a renewal, the Control Plane safely takes the job back, increments its retry count, and places it back in the queue.

---

## Multiple Workers

Multiple workers can consume jobs from the same control plane. PostgreSQL-backed locking prevents two workers from successfully claiming the same job at the same time.

Open two new terminals and start two isolated workers:

```bash
# Terminal A
STRATUM_NODE_ID=worker-1 npm run dev --workspace=@stratum/worker
```

```bash
# Terminal B
STRATUM_NODE_ID=worker-2 npm run dev --workspace=@stratum/worker
```

If you submit a batch of jobs, you will see `worker-1` and `worker-2` safely load-balancing the work.

---

## JSON Mode

Add `--json` when you are scripting Stratum or want machine-readable output.

```bash
node apps/cli/bin/stratum.js job submit --type echo --payload '{"message":"Hello"}' --json
```

```json
{
  "job": {
    "id": "1234abcd-...",
    "type": "echo",
    "status": "queued",
    "priority": 0
  }
}
```

---

## See What Stratum Is Doing

Stratum offers built-in visibility endpoints:

### Health
Check database connectivity and system status:
```bash
curl -s http://127.0.0.1:3000/health
```

### Metrics
Stratum exposes standard Prometheus metrics for job throughput, active nodes, and queue sizes:
```bash
curl -s http://127.0.0.1:3000/metrics
```

### Active nodes
List all currently registered and active workers:
```bash
curl -s http://127.0.0.1:3000/nodes
```

### Job status
See the complete chronological event log (queued → claimed → succeeded) for a single job:
```bash
node apps/cli/bin/stratum.js job status <JOB_ID>
```

---

## Distributed Tracing

Tracing lets you follow one job across the CLI, Control Plane, and Worker.

```text
CLI
 ↓
Control Plane
 ↓
Worker
 ↓
Completion
```

When tracing is enabled, all components share the same **Trace ID**. You can search for this ID in your logs to see exactly how a job moved through the distributed system.

Start the Control Plane and Worker with tracing enabled:
```bash
STRATUM_TRACING_ENABLED=true npm run dev --workspace=@stratum/control-plane
```
```bash
STRATUM_TRACING_ENABLED=true npm run dev --workspace=@stratum/worker
```

Submit a job with tracing:
```bash
STRATUM_TRACING_ENABLED=true node apps/cli/bin/stratum.js job submit --type echo --payload '{"message":"trace me"}'
```

---

## Troubleshooting

| Problem | Check | Fix |
| ------- | ----- | --- |
| **PostgreSQL connection error** | Is PostgreSQL running? | Start PostgreSQL / verify `DATABASE_URL` in `.env` |
| **Control Plane unavailable** | Is port 3000 listening? | Run `npm run dev --workspace=@stratum/control-plane` |
| **Worker cannot connect** | Check `STRATUM_CONTROL_PLANE_URL` | Correct the URL in `.env` |
| **Jobs stay queued** | Is a Worker running? | Start a Worker |
| **Database table missing** | Were migrations run? | Run `npm run db:migrate` |
| **Job was reclaimed** | Worker probably became stale | Restart the Worker and inspect retry state |

---

## Common Commands

| Task | Command |
| ---- | ------- |
| **Install dependencies** | `npm install` |
| **Run migrations** | `npm run db:migrate` |
| **Start Control Plane** | `npm run dev --workspace=@stratum/control-plane` |
| **Start Worker** | `npm run dev --workspace=@stratum/worker` |
| **Submit job** | `node apps/cli/bin/stratum.js job submit -t <type> -p '<json>'` |
| **List jobs** | `node apps/cli/bin/stratum.js job list` |
| **Job status** | `node apps/cli/bin/stratum.js job status <id>` |
| **Cancel job** | `node apps/cli/bin/stratum.js job cancel <id>` |
| **Health Check** | `curl -s http://127.0.0.1:3000/health` |
| **View Metrics** | `curl -s http://127.0.0.1:3000/metrics` |

# How to Use Stratum

Run reliable distributed jobs without manually managing workers, leases, retries, and job state.

Stratum is a distributed job execution engine. You submit a job, Stratum puts it in a queue, a worker executes it, and the control plane safely tracks its state from start to finish.

---

### Quick Start

**1. Install**
```bash
npm install
```

**2. Initialize**
```bash
npm link
stratum init
```
*(This automatically connects to PostgreSQL, runs migrations, and starts the background Control Plane and Worker processes.)*

**3. Open Stratum**
```bash
stratum
```
*(This opens the unified control panel where you can run jobs and monitor the system.)*

---

## 1. What is Stratum?

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

- **CLI**: Your single terminal interface to manage everything.
- **Control Plane**: The central brain that tracks job state.
- **PostgreSQL**: The safe, persistent storage.
- **Worker**: The background process that executes jobs.

---

## 2. Prerequisites

✅ Node.js 22+
✅ PostgreSQL 14+
✅ Git

Verify your environment:
```bash
node --version
psql --version
git --version
```

---

## 3. The Unified CLI

Instead of manually starting multiple terminals and servers, Stratum manages its own local runtime.

### Start the engine
```bash
stratum start
```

### Stop the engine
```bash
stratum stop
```

### Check system status
```bash
stratum status
```

---

## 4. Running a Job

You can run jobs directly from the command line without opening the control panel.

### Run an immediate job
```bash
stratum job run --type echo --payload '{"message":"Hello Stratum"}'
```

### Run a long-running job
```bash
stratum job run --type sleep --payload '{"durationMs":60000}'
```

### List jobs
```bash
stratum job list
```

### Cancel a job
```bash
stratum job cancel <JOB_ID>
```

---

## 5. How a Job Moves Through Stratum

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

- **QUEUED**: Waiting for an available worker.
- **RUNNING**: A worker is currently executing it.
- **SUCCEEDED**: Completed successfully.
- **FAILED**: Encountered an error and exhausted all retries.
- **CANCELLED**: Aborted by the user.

---

## 6. Long-Running Jobs & Leases

A lease is Stratum's way of saying “this worker currently owns this job.”

When a job takes a long time (like a 60-second sleep), the worker periodically renews the lease in the background.

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

If a worker crashes, the lease expires. Stratum performs **automatic job reclamation and retry**, safely placing the job back into the queue for another worker.

---

## 7. Multiple Workers

Multiple workers can consume jobs from the same control plane. PostgreSQL-backed locking prevents two workers from successfully claiming the same job at the same time.

You can launch extra workers manually by specifying a unique node ID:
```bash
STRATUM_NODE_ID=worker-2 npm run dev --workspace=@stratum/worker
```

---

## 8. JSON Mode

Add `--json` when you are scripting Stratum or want machine-readable output.

```bash
stratum job run --type echo --payload '{"message":"Hello"}' --json
```

```json
{
  "job": {
    "id": "1234abcd-...",
    "type": "echo",
    "status": "queued"
  }
}
```

---

## 9. Troubleshooting

If something goes wrong, run the built-in doctor command:
```bash
stratum doctor
```

| Problem | Check | Fix |
| ------- | ----- | --- |
| **PostgreSQL connection error** | Is PostgreSQL running? | Start PostgreSQL / verify `DATABASE_URL` |
| **Control Plane unavailable** | Is port 3000 listening? | Run `stratum start` |
| **Jobs stay queued** | Is a Worker running? | Run `stratum status` |
| **Database table missing** | Were migrations run? | Run `stratum init` |

To view system logs:
```bash
stratum logs
```

---

## 10. Advanced Configuration

Stratum uses sensible defaults, but you can override them using an `.env` file in the root directory.

| Variable | What it controls | Example |
| -------- | ---------------- | ------- |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@localhost:5432/stratum` |
| `CONTROL_PLANE_PORT` | API port | `3000` |
| `STRATUM_CONTROL_PLANE_URL` | Worker/CLI API address | `http://127.0.0.1:3000` |
| `STRATUM_TRACING_ENABLED` | Distributed tracing | `true` |

Tracing lets you follow one job across the CLI, Control Plane, and Worker. When enabled, a unified Trace ID will appear in the logs.

---

## Common Commands

| Task | Command |
| ---- | ------- |
| **Initialize system** | `stratum init` |
| **Open control panel** | `stratum` |
| **Start background services** | `stratum start` |
| **Stop background services** | `stratum stop` |
| **System status** | `stratum status` |
| **View logs** | `stratum logs` |
| **Run diagnostics** | `stratum doctor` |
| **Run job directly** | `stratum job run -t echo` |
| **Cancel job** | `stratum job cancel <ID>` |

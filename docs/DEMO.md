# STRATUM Automation Demo

STRATUM includes a deterministic, built-in demo that proves the orchestration layer and distributed execution engine working together.

## Running the Demo

You can run the demo in two ways:

1. **Directly via CLI:**
   ```bash
   stratum demo
   ```

2. **Via the Interactive Console:**
   ```text
   › stratum
   › /demo
   ```

## What the Demo Does

The demo executes a **Data Processing Pipeline** workflow. This workflow simulates a real-world scenario with a mix of sequential dependencies and parallel execution branches.

### The Pipeline

```text
  validate
    ↓
  fetch
    ↓
  process-a  process-b  process-c  ← parallel
    ↓
  combine
```

1. **`validate`** (Echo task) - Validates input data.
2. **`fetch`** (Echo task) - Fetches source data. *Depends on `validate`*.
3. **`process-a`, `process-b`, `process-c`** - These three tasks process different partitions of the data. They *depend on `fetch`*, meaning they will all launch concurrently once `fetch` succeeds. `process-c` uses a timed delay task (`sleep`).
4. **`combine`** (Echo task) - Combines the results. *Depends on all three `process` tasks*.

## What It Proves

When you run the demo, STRATUM demonstrates:

- **Parallel Execution:** It distributes the `process-a`, `process-b`, and `process-c` tasks to available workers simultaneously.
- **Dependency Management:** The Orchestrator automatically holds dependent tasks until their upstream requirements succeed.
- **Result Collection:** The final `combine` task waits for the distributed completion of the parallel tasks.
- **Workflow Completion:** The system correctly identifies when all terminal nodes in the Directed Acyclic Graph (DAG) have completed and marks the overall `Run` as `succeeded`.

Under the hood, all these tasks are executed as **Jobs** by the existing distributed execution engine (with lease token fencing, retries, and cancellation), while the **Orchestrator** coordinates the overall **Workflow Run**.

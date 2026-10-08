# STRATUM Architecture

STRATUM is an Automation and Orchestration Platform. 
It allows developers to run tasks, coordinate multi-step workflows, schedule recurring execution, and reliably execute work across distributed workers.

## Architectural Layers

```text
STRATUM
│
├── User Experience
│   └── CLI / Interactive Console
│
├── Automation Layer
│   ├── tasks
│   ├── workflows
│   ├── schedules
│   ├── triggers (preview)
│   └── automation rules (preview)
│
├── Orchestration Layer
│   ├── dependencies
│   ├── parallel execution
│   ├── sequential execution
│   ├── retries
│   ├── cancellation
│   └── recovery
│
├── Execution Layer
│   ├── workers
│   ├── leases
│   ├── fencing
│   └── workload handlers
│
└── Observability Layer
    ├── logs
    ├── metrics
    └── traces
```

## Core Abstractions

1. **Task:** A single unit of work (e.g., HTTP request, Command, Delay).
2. **Workflow:** Multiple tasks connected by dependencies forming a Directed Acyclic Graph (DAG).
3. **Automation:** A durable, reusable workflow or task definition stored in PostgreSQL. Triggered by a manual action, a schedule, or an event.
4. **Run:** One actual execution instance of a task, workflow, or automation, permanently persisted in the database.

## How it works

```text
User
 ↓
CLI
 ↓
Automation / Workflow API (Persistent)
 ↓
Orchestrator
 ↓
Execution Tasks
 ↓
Control Plane / Queue
 ↓
Workers
 ↓
Results (Persisted to Database)
```

1. **The User Experience:** The interactive CLI allows users to intuitively define tasks (`/run`), automations (`/automate`), and schedules (`/schedule`).
2. **The Automation Layer (New & Durable):** Automations, Runs, Steps, and Schedules are stored persistently in the database, allowing users to restart the CLI without losing their work.
3. **The Orchestrator:** Resolves dependencies (DAGs) and submits "ready" tasks to the underlying execution engine. It tracks the overall `Run` state and pushes status updates to the durable database.
4. **The Execution Engine:** The reliable distributed engine. It handles job queueing, worker assignment (via leases and fencing), retries, cancellation, and recovery. The execution engine remains the robust foundation supporting the higher-level automation product.

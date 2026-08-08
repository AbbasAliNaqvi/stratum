import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  check
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";


export const nodes = pgTable("nodes", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),

  nodeId: text("node_id")
    .notNull()
    .unique(),

  hostname: text("hostname")
    .notNull(),

  cpuCores: integer("cpu_cores")
    .notNull(),

  memoryMb: integer("memory_mb")
    .notNull(),

  platform: text("platform"),

  status: text("status")
    .notNull()
    .default("registered"),

  lastHeartbeatAt: timestamp("last_heartbeat_at", {
    withTimezone: true
  })
    .notNull()
    .defaultNow(),

  createdAt: timestamp("created_at", {
    withTimezone: true
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true
  })
    .notNull()
    .defaultNow()
});


export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),

    type: text("type")
      .notNull(),

    payload: jsonb("payload")
      .notNull(),

    status: text("status")
      .notNull()
      .default("queued"),

    priority: integer("priority")
      .notNull()
      .default(0),

    maxRetries: integer("max_retries")
      .notNull()
      .default(3),

    retryCount: integer("retry_count")
      .notNull()
      .default(0),

    runAfter: timestamp("run_after", {
      withTimezone: true
    })
      .notNull()
      .defaultNow(),

    lockedBy: text("locked_by")
      .references(() => nodes.nodeId),

    leaseToken: integer("lease_token")
      .notNull()
      .default(0),

    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true
    }),

    startedAt: timestamp("started_at", {
      withTimezone: true
    }),

    finishedAt: timestamp("finished_at", {
      withTimezone: true
    }),

    result: jsonb("result"),

    error: text("error"),

    cancelRequestedAt: timestamp("cancel_requested_at", {
      withTimezone: true
    }),

    idempotencyKey: text("idempotency_key")
      .unique(),

    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },

  (table) => [
    check(
      "jobs_status_check",
      sql`${table.status} IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')`
    ),

    check(
      "jobs_retry_count_check",
      sql`${table.retryCount} <= ${table.maxRetries}`
    ),

    check(
      "jobs_running_lease_check",
      sql`${table.status} != 'running' OR (${table.lockedBy} IS NOT NULL AND ${table.leaseExpiresAt} IS NOT NULL)`
    ),

    index("jobs_claim_idx")
      .on(table.priority, table.createdAt)
      .where(sql`${table.status} = 'queued'`),

    index("jobs_locked_by_idx")
      .on(table.lockedBy)
      .where(sql`${table.status} = 'running'`)
  ]
);


export const jobEvents = pgTable(
  "job_events",
  {
    id: uuid("id")
      .primaryKey()
      .defaultRandom(),

    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),

    eventType: text("event_type")
      .notNull(),

    nodeId: text("node_id"),

    message: text("message"),

    createdAt: timestamp("created_at", {
      withTimezone: true
    })
      .notNull()
      .defaultNow()
  },

  (table) => [
    index("job_events_job_id_idx")
      .on(table.jobId, table.createdAt)
  ]
);
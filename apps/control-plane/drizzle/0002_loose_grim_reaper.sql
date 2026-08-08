CREATE TABLE "job_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"node_id" text,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_by" text,
	"lease_token" integer DEFAULT 0 NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"result" jsonb,
	"error" text,
	"cancel_requested_at" timestamp with time zone,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "jobs_status_check" CHECK ("jobs"."status" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
	CONSTRAINT "jobs_retry_count_check" CHECK ("jobs"."retry_count" <= "jobs"."max_retries"),
	CONSTRAINT "jobs_running_lease_check" CHECK ("jobs"."status" != 'running' OR ("jobs"."locked_by" IS NOT NULL AND "jobs"."lease_expires_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "job_events" ADD CONSTRAINT "job_events_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_locked_by_nodes_node_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."nodes"("node_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_events_job_id_idx" ON "job_events" USING btree ("job_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_claim_idx" ON "jobs" USING btree ("priority","created_at") WHERE "jobs"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "jobs_locked_by_idx" ON "jobs" USING btree ("locked_by") WHERE "jobs"."status" = 'running';
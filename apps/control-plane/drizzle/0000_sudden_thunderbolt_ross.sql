CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" text NOT NULL,
	"hostname" text NOT NULL,
	"cpu_cores" integer NOT NULL,
	"memory_mb" integer NOT NULL,
	"platform" text,
	"status" text DEFAULT 'registered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_node_id_unique" UNIQUE("node_id")
);

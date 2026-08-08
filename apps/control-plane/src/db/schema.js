import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const nodes = pgTable("nodes", {
  id: uuid("id").primaryKey().defaultRandom(),

  nodeId: text("node_id").notNull().unique(),

  hostname: text("hostname").notNull(),

  cpuCores: integer("cpu_cores").notNull(),

  memoryMb: integer("memory_mb").notNull(),

  platform: text("platform"),

  status: text("status").notNull().default("registered"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .notNull()
    .defaultNow(),
});
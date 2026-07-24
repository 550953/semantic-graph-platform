import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspace.js";

// ---------------------------------------------------------------------------
// Actor — universal participant: Human | AI | Service | External System
// Replaces a plain "user" table; extends naturally without schema changes.
// ---------------------------------------------------------------------------

export const actorTypeEnum = ["human", "ai", "service", "external"] as const;
export type ActorType = (typeof actorTypeEnum)[number];

export const actorsTable = pgTable("actors", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  type: text("type").$type<ActorType>().notNull().default("human"),
  name: text("name").notNull(),
  /** email is relevant only for human actors */
  email: text("email"),
  /** arbitrary type-specific metadata (avatar, model name, service URL, …) */
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActorSchema = createInsertSchema(actorsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectActorSchema = createSelectSchema(actorsTable);
export type InsertActor = z.infer<typeof insertActorSchema>;
export type Actor = typeof actorsTable.$inferSelect;

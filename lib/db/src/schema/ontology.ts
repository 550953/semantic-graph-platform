import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { workspacesTable } from "./workspace.js";

// ---------------------------------------------------------------------------
// NodeType — ontological basis for graph nodes
// e.g. "Requirement", "Service", "Actor", "Document", "SQLQuery" …
// ---------------------------------------------------------------------------
export const nodeTypesTable = pgTable("node_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  /** hex colour for visualisation */
  color: text("color"),
  /** icon identifier (lucide name or custom) */
  icon: text("icon"),
  /** extra schema / display config */
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  /** system types ship with the platform and cannot be deleted by users */
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNodeTypeSchema = createInsertSchema(nodeTypesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectNodeTypeSchema = createSelectSchema(nodeTypesTable);
export type InsertNodeType = z.infer<typeof insertNodeTypeSchema>;
export type NodeType = typeof nodeTypesTable.$inferSelect;

// ---------------------------------------------------------------------------
// EdgeType — ontological basis for graph edges
// e.g. "depends_on", "implements", "reviews", "owns" …
// ---------------------------------------------------------------------------
export const edgeTypesTable = pgTable("edge_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspacesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  /** optional constraint: only edges FROM this node type … */
  sourceNodeTypeId: uuid("source_node_type_id").references(
    () => nodeTypesTable.id,
    { onDelete: "set null" },
  ),
  /** … TO this node type are valid */
  targetNodeTypeId: uuid("target_node_type_id").references(
    () => nodeTypesTable.id,
    { onDelete: "set null" },
  ),
  isDirected: boolean("is_directed").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEdgeTypeSchema = createInsertSchema(edgeTypesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectEdgeTypeSchema = createSelectSchema(edgeTypesTable);
export type InsertEdgeType = z.infer<typeof insertEdgeTypeSchema>;
export type EdgeType = typeof edgeTypesTable.$inferSelect;

import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { actorsTable } from "./actor.js";
import { edgeTypesTable, nodeTypesTable } from "./ontology.js";
import { projectsTable } from "./workspace.js";

// ---------------------------------------------------------------------------
// Node — primary graph entity
// ---------------------------------------------------------------------------
export const nodesTable = pgTable("nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  nodeTypeId: uuid("node_type_id")
    .notNull()
    .references(() => nodeTypesTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  /**
   * Flexible, type-specific payload.
   * Validated at the application layer per NodeType.
   */
  properties: jsonb("properties").$type<Record<string, unknown>>().default({}),
  createdById: uuid("created_by_id").references(() => actorsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNodeSchema = createInsertSchema(nodesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectNodeSchema = createSelectSchema(nodesTable);
export type InsertNode = z.infer<typeof insertNodeSchema>;
export type Node = typeof nodesTable.$inferSelect;

// ---------------------------------------------------------------------------
// Edge — directed (or undirected per EdgeType) relationship between two Nodes
// ---------------------------------------------------------------------------
export const edgesTable = pgTable("edges", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  edgeTypeId: uuid("edge_type_id")
    .notNull()
    .references(() => edgeTypesTable.id, { onDelete: "restrict" }),
  sourceNodeId: uuid("source_node_id")
    .notNull()
    .references(() => nodesTable.id, { onDelete: "cascade" }),
  targetNodeId: uuid("target_node_id")
    .notNull()
    .references(() => nodesTable.id, { onDelete: "cascade" }),
  /** Weight, label, or any edge-level attributes */
  properties: jsonb("properties").$type<Record<string, unknown>>().default({}),
  createdById: uuid("created_by_id").references(() => actorsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEdgeSchema = createInsertSchema(edgesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectEdgeSchema = createSelectSchema(edgesTable);
export type InsertEdge = z.infer<typeof insertEdgeSchema>;
export type Edge = typeof edgesTable.$inferSelect;

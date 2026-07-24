import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { actorsTable } from "./actor.js";
import { projectsTable } from "./workspace.js";

// ---------------------------------------------------------------------------
// Issue / WorkItem — unified traceable unit
// Subtypes: task | defect | risk | change_request | improvement |
//           review_comment | technical_debt
// Lifecycle managed by FSM Engine (Phase 3).
// ---------------------------------------------------------------------------

export const issueTypeEnum = [
  "task",
  "defect",
  "risk",
  "change_request",
  "improvement",
  "review_comment",
  "technical_debt",
] as const;
export type IssueType = (typeof issueTypeEnum)[number];

export const issueStatusEnum = [
  "open",
  "in_progress",
  "in_review",
  "done",
  "cancelled",
  "blocked",
] as const;
export type IssueStatus = (typeof issueStatusEnum)[number];

export const issuePriorityEnum = ["critical", "high", "medium", "low"] as const;
export type IssuePriority = (typeof issuePriorityEnum)[number];

export const issuesTable = pgTable("issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  /** Discriminator — drives lifecycle rules (FSM Phase 3) */
  type: text("type").$type<IssueType>().notNull().default("task"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").$type<IssueStatus>().notNull().default("open"),
  priority: text("priority").$type<IssuePriority>().notNull().default("medium"),
  /** Who is doing the work */
  assigneeId: uuid("assignee_id").references(() => actorsTable.id, {
    onDelete: "set null",
  }),
  /** Who created / reported the issue */
  reporterId: uuid("reporter_id").references(() => actorsTable.id, {
    onDelete: "set null",
  }),
  /**
   * Parent issue for hierarchical decomposition (epic → story → task)
   * Self-referencing: nullable by default.
   */
  parentId: uuid("parent_id"),
  /** Flexible payload: due date, labels, linked nodes, etc. */
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIssueSchema = createInsertSchema(issuesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectIssueSchema = createSelectSchema(issuesTable);
export type InsertIssue = z.infer<typeof insertIssueSchema>;
export type Issue = typeof issuesTable.$inferSelect;

import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const domains = sqliteTable("domains", {
  id: integer().primaryKey({ autoIncrement: true }),
  pattern: text().notNull().unique(),
  addedAt: text("added_at").notNull(),
});

export const labelsLog = sqliteTable(
  "labels_log",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    postUri: text("post_uri").notNull().unique(),
    authorDid: text("author_did").notNull(),
    domain: text().notNull(),
    labeledAt: text("labeled_at").notNull(),
  },
  (table) => [
    index("labels_log_labeled_at_idx").on(table.labeledAt),
    index("labels_log_domain_idx").on(table.domain),
  ],
);

export const cursor = sqliteTable(
  "cursor",
  {
    id: integer().primaryKey(),
    cursorUs: integer("cursor_us").notNull(),
    postsScanned: integer("posts_scanned").notNull().default(0),
  },
  (table) => [check("cursor_single_row_check", sql`${table.id} = 1`)],
);

export type DomainRow = typeof domains.$inferSelect;
export type NewDomainRow = typeof domains.$inferInsert;
export type LabelLogRow = typeof labelsLog.$inferSelect;
export type CursorRow = typeof cursor.$inferSelect;

import { sql } from "drizzle-orm";
import { blob, check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const domains = sqliteTable("domains", {
  id: integer().primaryKey({ autoIncrement: true }),
  pattern: text().notNull().unique(),
  addedAt: text("added_at").notNull(),
});

export const labels = sqliteTable(
  "labels",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    src: text().notNull(),
    uri: text().notNull().unique(),
    val: text().notNull(),
    neg: integer({ mode: "boolean" }).notNull().default(false),
    cts: text().notNull(),
    cid: text(),
    exp: text(),
    sig: blob({ mode: "buffer" }).notNull(),
    domain: text().notNull(),
    authorDid: text("author_did").notNull(),
  },
  (table) => [index("labels_cts_idx").on(table.cts), index("labels_domain_idx").on(table.domain)],
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
export type LabelRow = typeof labels.$inferSelect;
export type CursorRow = typeof cursor.$inferSelect;

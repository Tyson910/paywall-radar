import type { NodeSavedSession, NodeSavedState } from "@atproto/oauth-client-node";

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
    postText: text("post_text"),
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

export const jetstreamCursors = sqliteTable("jetstream_cursors", {
  source: text().primaryKey(),
  cursorUs: integer("cursor_us").notNull(),
  postsScanned: integer("posts_scanned").notNull().default(0),
});

export const failedEvents = sqliteTable(
  "failed_events",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    cursorUs: integer("cursor_us"),
    did: text(),
    collection: text(),
    rkey: text(),
    reason: text().notNull(),
    payload: text().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("failed_events_created_at_idx").on(table.createdAt)],
);

export const oauthState = sqliteTable("oauth_state", {
  key: text().primaryKey(),
  value: text({ mode: "json" }).$type<NodeSavedState>().notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const oauthSessions = sqliteTable("oauth_sessions", {
  did: text().primaryKey(),
  value: text({ mode: "json" }).$type<NodeSavedSession>().notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const adminSession = sqliteTable(
  "admin_session",
  {
    id: integer().primaryKey(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [check("admin_session_single_row_check", sql`${table.id} = 1`)],
);

export type DomainRow = typeof domains.$inferSelect;
export type NewDomainRow = typeof domains.$inferInsert;
export type LabelRow = typeof labels.$inferSelect;
export type CursorRow = typeof cursor.$inferSelect;
export type JetstreamCursorRow = typeof jetstreamCursors.$inferSelect;
export type FailedEventRow = typeof failedEvents.$inferSelect;

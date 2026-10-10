import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { count } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { openDatabase } from "./connection.js";
import { initializeDatabase } from "./initialize.js";
import { publishLabelRevision, recordLabel } from "./labels.js";
import { labelEvents, labels } from "./models.js";
import { saveJetstreamCursorState } from "./state.js";

const fakeSig = new Uint8Array(64);

describe("recordLabel", () => {
  it("records each post at most once", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paywall-radar-labels-"));
    const databasePath = join(directory, "test.db");

    try {
      await initializeDatabase(databasePath);
      const { client, db } = await openDatabase(databasePath);

      try {
        const label = {
          src: "did:plc:labeler",
          uri: "at://did:plc:example/app.bsky.feed.post/abc123",
          val: "paywall",
          cts: new Date().toISOString(),
          sig: fakeSig,
          authorDid: "did:plc:example",
          domain: "nytimes.com",
        };

        const first = await recordLabel(db, label);
        expect(first).toEqual({ id: expect.any(Number), seq: expect.any(Number) });

        const second = await recordLabel(db, label);
        expect(second).toBeNull();

        const [result] = await db.select({ count: count() }).from(labels);
        expect(result?.count).toBe(1);
        const [eventResult] = await db.select({ count: count() }).from(labelEvents);
        expect(eventResult?.count).toBe(1);

        const revision = await publishLabelRevision(db, {
          ver: 1,
          src: label.src,
          uri: label.uri,
          val: label.val,
          cts: "2026-08-01T21:00:00.000Z",
          sig: new Uint8Array(64).fill(1),
        });

        expect(revision).toEqual({ id: first!.id, seq: first!.seq + 1 });
        const [revisedEventResult] = await db.select({ count: count() }).from(labelEvents);
        expect(revisedEventResult?.count).toBe(2);
      } finally {
        client.close();
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  // Regression test for the production SQLITE_BUSY storm: two Jetstream
  // consumers race label writes against cursor saves on one database.
  it("handles concurrent label writes and cursor saves without SQLITE_BUSY", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paywall-radar-labels-"));
    const databasePath = join(directory, "test.db");

    try {
      await initializeDatabase(databasePath);
      const { client, db } = await openDatabase(databasePath);

      try {
        const timeout = await client.execute("PRAGMA busy_timeout");
        expect(Number(timeout.rows[0]?.timeout)).toBe(5000);

        const baseLabel = {
          src: "did:plc:labeler",
          val: "paywall",
          cts: new Date().toISOString(),
          sig: fakeSig,
          authorDid: "did:plc:example",
          domain: "nytimes.com",
        };

        await Promise.all(
          Array.from({ length: 20 }, (_, index) =>
            index % 2 === 0
              ? recordLabel(db, {
                  ...baseLabel,
                  uri: `at://did:plc:example/app.bsky.feed.post/concurrent-${index}`,
                })
              : saveJetstreamCursorState(db, "us-west-2", {
                  cursorUs: index,
                  postsScanned: index,
                }),
          ),
        );

        const [labelCount] = await db.select({ count: count() }).from(labels);
        const [eventCount] = await db.select({ count: count() }).from(labelEvents);
        expect(labelCount?.count).toBe(10);
        expect(eventCount?.count).toBe(10);
      } finally {
        client.close();
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

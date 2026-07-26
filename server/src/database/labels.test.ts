import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { count } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { openDatabase } from "./connection.js";
import { initializeDatabase } from "./initialize.js";
import { recordLabel } from "./labels.js";
import { labels } from "./models.js";

const fakeSig = new Uint8Array(64);

describe("recordLabel", () => {
  it("records each post at most once", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paywall-radar-labels-"));
    const databasePath = join(directory, "test.db");

    try {
      await initializeDatabase(databasePath);
      const { client, db } = openDatabase(databasePath);

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
        expect(first).toEqual({ id: expect.any(Number) });

        const second = await recordLabel(db, label);
        expect(second).toBeNull();

        const [result] = await db.select({ count: count() }).from(labels);
        expect(result?.count).toBe(1);
      } finally {
        client.close();
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { count } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { openDatabase } from "./connection.js";
import { initializeDatabase } from "./initialize.js";
import { recordLabel } from "./labels.js";
import { labelsLog } from "./models.js";

describe("recordLabel", () => {
  it("records each post at most once", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paywall-radar-labels-"));
    const databasePath = join(directory, "test.db");

    try {
      await initializeDatabase(databasePath);
      const { client, db } = openDatabase(databasePath);

      try {
        const label = {
          postUri: "at://did:plc:example/app.bsky.feed.post/abc123",
          authorDid: "did:plc:example",
          domain: "nytimes.com",
        };

        expect(await recordLabel(db, label)).toBe(true);
        expect(await recordLabel(db, label)).toBe(false);

        const [result] = await db.select({ count: count() }).from(labelsLog);
        expect(result?.count).toBe(1);
      } finally {
        client.close();
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

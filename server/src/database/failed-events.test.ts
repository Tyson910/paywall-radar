import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { asc, count } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { openDatabase } from "./connection.js";
import { recordFailedEvent } from "./failed-events.js";
import { initializeDatabase } from "./initialize.js";
import { failedEvents } from "./models.js";

describe("recordFailedEvent", () => {
  it("stores diagnostic fields and caps retained failures", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paywall-radar-failures-"));
    const databasePath = join(directory, "test.db");

    try {
      await initializeDatabase(databasePath);
      const connection = await openDatabase(databasePath);

      for (let start = 0; start < 10_000; start += 500) {
        await connection.db.insert(failedEvents).values(
          Array.from({ length: 500 }, (_, offset) => {
            const index = start + offset;
            return {
              cursorUs: index,
              did: "did:plc:example",
              collection: "app.bsky.feed.post",
              rkey: `post-${index}`,
              reason: "invalid_post_event: missing record",
              payload: `payload-${index}`,
              createdAt: new Date().toISOString(),
            };
          }),
        );
      }

      for (let index = 10_000; index < 10_005; index += 1) {
        await recordFailedEvent(connection.db, {
          cursorUs: index,
          did: "did:plc:example",
          collection: "app.bsky.feed.post",
          rkey: `post-${index}`,
          reason: "invalid_post_event: missing record",
          payload: `payload-${index}`,
        });
      }

      const [total] = await connection.db.select({ value: count() }).from(failedEvents);
      const [oldest] = await connection.db
        .select()
        .from(failedEvents)
        .orderBy(asc(failedEvents.id))
        .limit(1);

      expect(total?.value).toBe(10_000);
      expect(oldest?.cursorUs).toBe(5);
      expect(oldest?.rkey).toBe("post-5");
      connection.client.close();
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

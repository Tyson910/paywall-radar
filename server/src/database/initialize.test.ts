import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { count, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { openDatabase } from "./connection.js";
import { initializeDatabase } from "./initialize.js";
import { cursor, domains } from "./models.js";

describe("initializeDatabase", () => {
  it("runs migrations and seeds a new database idempotently", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paywall-radar-db-"));
    const databasePath = join(directory, "test.db");

    try {
      const first = await initializeDatabase(databasePath);
      const firstConnection = await openDatabase(databasePath);
      const [cursorRow] = await firstConnection.db.select().from(cursor).where(eq(cursor.id, 1));
      firstConnection.client.close();

      expect(first.domainCount).toBe(17);
      expect(cursorRow).toMatchObject({ id: 1, cursorUs: 0, postsScanned: 0 });

      const second = await initializeDatabase(databasePath);
      const secondConnection = await openDatabase(databasePath);
      const [secondCount] = await secondConnection.db.select({ value: count() }).from(domains);
      secondConnection.client.close();

      expect(second.domainCount).toBe(17);
      expect(secondCount?.value).toBe(17);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

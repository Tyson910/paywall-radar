import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openDatabase } from "./connection.js";
import { initializeDatabase } from "./initialize.js";
import { loadCursorState, loadDomainPatterns, saveCursorState } from "./state.js";

describe("database state", () => {
  it("loads domains and persists cursor progress", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paywall-radar-state-"));
    const databasePath = join(directory, "test.db");

    try {
      await initializeDatabase(databasePath);
      const { client, db } = openDatabase(databasePath);

      try {
        const patterns = await loadDomainPatterns(db);
        expect(patterns).toContain("nytimes.com");
        expect(patterns).toContain("*.ft.com");
        expect(await loadCursorState(db)).toEqual({ cursorUs: 0, postsScanned: 0 });

        await saveCursorState(db, {
          cursorUs: 1_725_519_626_134_432,
          postsScanned: 42,
        });

        expect(await loadCursorState(db)).toEqual({
          cursorUs: 1_725_519_626_134_432,
          postsScanned: 42,
        });
      } finally {
        client.close();
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

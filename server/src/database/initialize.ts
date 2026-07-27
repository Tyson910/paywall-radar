import { fileURLToPath } from "node:url";

import { count } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";

import { parseDomainPatterns, paywalledDomainPatterns } from "../domains.js";

import { openDatabase } from "./connection.js";
import { cursor, domains } from "./models.js";

const migrationsFolder = fileURLToPath(new URL("./migrations", import.meta.url));

export interface DatabaseInitializationResult {
  domainCount: number;
}

export async function initializeDatabase(
  databasePath: string,
): Promise<DatabaseInitializationResult> {
  const { client, db } = openDatabase(databasePath);

  try {
    await migrate(db, { migrationsFolder });

    await db
      .insert(cursor)
      .values({ id: 1, cursorUs: 0, postsScanned: 0 })
      .onConflictDoNothing({ target: cursor.id });

    const now = new Date().toISOString();
    const seedRows = parseDomainPatterns(paywalledDomainPatterns).map((pattern) => ({
      pattern,
      addedAt: now,
    }));

    await db.insert(domains).values(seedRows).onConflictDoNothing({ target: domains.pattern });

    const [result] = await db.select({ count: count() }).from(domains);
    return { domainCount: result?.count ?? 0 };
  } finally {
    client.close();
  }
}

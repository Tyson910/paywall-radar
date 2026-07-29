import { eq } from "drizzle-orm";

import type { Database } from "./connection.js";

import { domains } from "./models.js";

export async function addDomain(db: Database, pattern: string) {
  const [row] = await db
    .insert(domains)
    .values({ pattern, addedAt: new Date().toISOString() })
    .onConflictDoNothing({ target: domains.pattern })
    .returning();
  return row ?? null;
}

export async function removeDomain(db: Database, pattern: string) {
  const [row] = await db.delete(domains).where(eq(domains.pattern, pattern)).returning();
  return row ?? null;
}

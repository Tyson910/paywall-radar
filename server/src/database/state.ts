import { eq } from "drizzle-orm";

import { parseDomainPatterns, type DomainPattern } from "../domains.js";

import type { Database } from "./connection.js";

import { cursor, domains } from "./models.js";

export interface CursorState {
  cursorUs: number;
  postsScanned: number;
}

export async function loadDomainPatterns(db: Database): Promise<DomainPattern[]> {
  const rows = await db.select({ pattern: domains.pattern }).from(domains);
  return parseDomainPatterns(rows.map((row) => row.pattern));
}

export async function loadCursorState(db: Database): Promise<CursorState> {
  const [row] = await db
    .select({
      cursorUs: cursor.cursorUs,
      postsScanned: cursor.postsScanned,
    })
    .from(cursor)
    .where(eq(cursor.id, 1));

  return row ?? { cursorUs: 0, postsScanned: 0 };
}

export async function saveCursorState(db: Database, state: CursorState): Promise<void> {
  await db
    .insert(cursor)
    .values({ id: 1, ...state })
    .onConflictDoUpdate({
      target: cursor.id,
      set: state,
    });
}

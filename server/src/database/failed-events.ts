import { desc, notInArray } from "drizzle-orm";

import type { Database } from "./connection.js";

import { failedEvents } from "./models.js";

const MAX_FAILED_EVENTS = 10_000;

export interface FailedEventInput {
  cursorUs?: number;
  did?: string;
  collection?: string;
  rkey?: string;
  reason: string;
  payload: string;
}

export async function recordFailedEvent(db: Database, event: FailedEventInput): Promise<void> {
  await db.insert(failedEvents).values({
    cursorUs: event.cursorUs ?? null,
    did: event.did ?? null,
    collection: event.collection ?? null,
    rkey: event.rkey ?? null,
    reason: event.reason,
    payload: event.payload,
    createdAt: new Date().toISOString(),
  });

  const retainedIds = db
    .select({ id: failedEvents.id })
    .from(failedEvents)
    .orderBy(desc(failedEvents.id))
    .limit(MAX_FAILED_EVENTS);

  await db.delete(failedEvents).where(notInArray(failedEvents.id, retainedIds));
}

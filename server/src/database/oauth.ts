import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
} from "@atproto/oauth-client-node";

import { eq } from "drizzle-orm";

import type { Database } from "./connection.js";

import { oauthSessions, oauthState } from "./models.js";

function parseStoredValue<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function createOAuthStores(db: Database): {
  stateStore: NodeSavedStateStore;
  sessionStore: NodeSavedSessionStore;
} {
  return {
    stateStore: {
      async set(key, value) {
        await db
          .insert(oauthState)
          .values({ key, value: JSON.stringify(value), updatedAt: new Date().toISOString() })
          .onConflictDoUpdate({
            target: oauthState.key,
            set: { value: JSON.stringify(value), updatedAt: new Date().toISOString() },
          });
      },
      async get(key) {
        const [row] = await db.select().from(oauthState).where(eq(oauthState.key, key)).limit(1);
        return row ? parseStoredValue<NodeSavedState>(row.value) : undefined;
      },
      async del(key) {
        await db.delete(oauthState).where(eq(oauthState.key, key));
      },
    },
    sessionStore: {
      async set(did, value) {
        await db
          .insert(oauthSessions)
          .values({ did, value: JSON.stringify(value), updatedAt: new Date().toISOString() })
          .onConflictDoUpdate({
            target: oauthSessions.did,
            set: { value: JSON.stringify(value), updatedAt: new Date().toISOString() },
          });
      },
      async get(did) {
        const [row] = await db
          .select()
          .from(oauthSessions)
          .where(eq(oauthSessions.did, did))
          .limit(1);
        return row ? parseStoredValue<NodeSavedSession>(row.value) : undefined;
      },
      async del(did) {
        await db.delete(oauthSessions).where(eq(oauthSessions.did, did));
      },
    },
  };
}

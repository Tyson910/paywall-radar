import type { NodeSavedSessionStore, NodeSavedStateStore } from "@atproto/oauth-client-node";

import { eq } from "drizzle-orm";

import type { Database } from "./connection.js";

import { oauthSessions, oauthState } from "./models.js";

export function createOAuthStores(db: Database): {
  stateStore: NodeSavedStateStore;
  sessionStore: NodeSavedSessionStore;
} {
  return {
    stateStore: {
      async set(key, value) {
        await db
          .insert(oauthState)
          .values({ key, value, updatedAt: new Date().toISOString() })
          .onConflictDoUpdate({
            target: oauthState.key,
            set: { value, updatedAt: new Date().toISOString() },
          });
      },
      async get(key) {
        const [row] = await db.select().from(oauthState).where(eq(oauthState.key, key)).limit(1);
        return row?.value;
      },
      async del(key) {
        await db.delete(oauthState).where(eq(oauthState.key, key));
      },
    },
    sessionStore: {
      async set(did, value) {
        await db
          .insert(oauthSessions)
          .values({ did, value, updatedAt: new Date().toISOString() })
          .onConflictDoUpdate({
            target: oauthSessions.did,
            set: { value, updatedAt: new Date().toISOString() },
          });
      },
      async get(did) {
        const [row] = await db
          .select()
          .from(oauthSessions)
          .where(eq(oauthSessions.did, did))
          .limit(1);
        return row?.value;
      },
      async del(did) {
        await db.delete(oauthSessions).where(eq(oauthSessions.did, did));
      },
    },
  };
}

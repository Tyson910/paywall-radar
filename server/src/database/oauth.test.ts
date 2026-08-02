import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NodeSavedState } from "@atproto/oauth-client-node";
import type { Client } from "@libsql/client";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Database } from "./connection.js";

import { openDatabase } from "./connection.js";
import { initializeDatabase } from "./initialize.js";
import { oauthState } from "./models.js";
import { createOAuthStores } from "./oauth.js";

describe("OAuth stores", () => {
  let directory: string;
  let client: Client;
  let db: Database;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "paywall-radar-oauth-"));
    const databasePath = join(directory, "test.db");
    await initializeDatabase(databasePath);
    ({ client, db } = openDatabase(databasePath));
  });

  afterEach(async () => {
    client.close();
    await rm(directory, { force: true, recursive: true });
  });

  it("prunes OAuth state older than ten minutes when storing new state", async () => {
    const value: NodeSavedState = {
      iss: "https://issuer.example",
      authMethod: { method: "none" },
      verifier: "verifier",
      dpopJwk: { kty: "EC", crv: "P-256", x: "x", y: "y", d: "d" },
    };
    await db.insert(oauthState).values({
      key: "expired",
      value,
      updatedAt: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    });

    await createOAuthStores(db).stateStore.set("current", value);

    const rows = await db.query.oauthState.findMany({
      columns: { key: true },
      orderBy: (state, { asc }) => asc(state.key),
    });
    expect(rows).toEqual([{ key: "current" }]);
  });
});

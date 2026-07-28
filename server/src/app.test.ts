import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Client } from "@libsql/client";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "./database/connection.js";

import { createApp } from "./app.js";
import { openDatabase } from "./database/connection.js";
import { initializeDatabase } from "./database/initialize.js";
import { LabelStream } from "./label-stream.js";

let directory: string;
let client: Client;
let db: Database;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "paywall-radar-app-"));
  const databasePath = join(directory, "test.db");
  await initializeDatabase(databasePath);
  ({ client, db } = openDatabase(databasePath));
});

afterAll(async () => {
  client.close();
  await rm(directory, { force: true, recursive: true });
});

describe("createApp", () => {
  it("serves routes without starting the process runtime", async () => {
    const app = createApp({ db, labelStream: new LabelStream() });

    const healthResponse = await app.request("/xrpc/_health");
    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({ version: 1 });

    const dashboardResponse = await app.request("/api/dashboard");
    expect(dashboardResponse.status).toBe(200);
    await expect(dashboardResponse.json()).resolves.toMatchObject({
      stats: {
        postsScanned: 0,
        labelsEmitted: 0,
        lastEventAt: null,
      },
    });
  });
});

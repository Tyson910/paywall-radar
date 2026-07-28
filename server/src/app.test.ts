import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
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

  it("serves the client entry for direct application routes", async () => {
    const clientDir = join(directory, "client");
    await mkdir(clientDir);
    await writeFile(join(clientDir, "index.html"), '<div id="root"></div>');
    const app = createApp({ db, labelStream: new LabelStream(), clientDir });

    const [homeResponse, dashboardResponse] = await Promise.all([
      app.request("/"),
      app.request("/dashboard"),
    ]);

    expect(homeResponse.status).toBe(200);
    expect(dashboardResponse.status).toBe(200);
    await expect(homeResponse.text()).resolves.toContain('id="root"');
    await expect(dashboardResponse.text()).resolves.toContain('id="root"');
  });
});

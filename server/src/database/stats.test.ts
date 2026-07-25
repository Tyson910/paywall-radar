import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Client } from "@libsql/client";

import type { Database } from "./connection.js";
import { openDatabase } from "./connection.js";
import { initializeDatabase } from "./initialize.js";
import { recordLabel } from "./labels.js";
import { getDashboardSnapshot } from "./stats.js";

let directory: string;
let client: Client;
let db: Database;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "paywall-radar-stats-"));
  const databasePath = join(directory, "test.db");
  await initializeDatabase(databasePath);
  ({ client, db } = openDatabase(databasePath));
});

afterAll(async () => {
  client.close();
  await rm(directory, { force: true, recursive: true });
});

describe("getDashboardSnapshot", () => {
  it("returns zeroes when no labels exist", async () => {
    const snapshot = await getDashboardSnapshot(db);

    expect(snapshot.stats).toEqual({
      postsScanned: 0,
      labelsEmitted: 0,
      lastEventAt: null,
    });
    expect(snapshot.volume).toEqual([]);
    expect(snapshot.topDomains).toEqual([]);
  });

  it("reflects recorded labels in stats, volume, and top domains", async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const labels = [
      { postUri: "at://did:plc:a/app.bsky.feed.post/1", authorDid: "did:plc:a", domain: "nytimes.com", labeledAt: twoHoursAgo.toISOString() },
      { postUri: "at://did:plc:b/app.bsky.feed.post/2", authorDid: "did:plc:b", domain: "nytimes.com", labeledAt: twoHoursAgo.toISOString() },
      { postUri: "at://did:plc:c/app.bsky.feed.post/3", authorDid: "did:plc:c", domain: "wsj.com", labeledAt: oneHourAgo.toISOString() },
      { postUri: "at://did:plc:d/app.bsky.feed.post/4", authorDid: "did:plc:d", domain: "nytimes.com", labeledAt: now.toISOString() },
    ];

    for (const label of labels) {
      await recordLabel(db, label);
    }

    const snapshot = await getDashboardSnapshot(db);

    expect(snapshot.stats.labelsEmitted).toBe(4);
    expect(snapshot.stats.lastEventAt).toBe(now.toISOString());

    expect(snapshot.topDomains).toEqual([
      { domain: "nytimes.com", labels: 3 },
      { domain: "wsj.com", labels: 1 },
    ]);

    expect(snapshot.volume.length).toBeGreaterThanOrEqual(2);
    const totalFromVolume = snapshot.volume.reduce((sum, point) => sum + point.labels, 0);
    expect(totalFromVolume).toBe(4);
  });

  it("excludes volume points older than 24 hours", async () => {
    const oldLabel = {
      postUri: "at://did:plc:e/app.bsky.feed.post/5",
      authorDid: "did:plc:e",
      domain: "wsj.com",
      labeledAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    };

    await recordLabel(db, oldLabel);

    const snapshot = await getDashboardSnapshot(db);

    expect(snapshot.stats.labelsEmitted).toBe(5);

    const totalFromVolume = snapshot.volume.reduce((sum, point) => sum + point.labels, 0);
    expect(totalFromVolume).toBe(4);
  });
});

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Client } from "@libsql/client";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Database } from "./connection.js";

import { openDatabase } from "./connection.js";
import { initializeDatabase } from "./initialize.js";
import { recordLabel } from "./labels.js";
import { getDashboardSnapshot } from "./stats.js";

let directory: string;
let client: Client;
let db: Database;

const fakeSig = new Uint8Array(64);

function makeLabel(overrides: { uri: string; authorDid: string; domain: string; cts: string }) {
  return {
    src: "did:plc:labeler",
    val: "paywall",
    sig: fakeSig,
    ...overrides,
  };
}

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
    expect(snapshot.recentLabels).toEqual([]);
  });

  it("reflects recorded labels in stats, volume, and top domains", async () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const testLabels = [
      makeLabel({
        uri: "at://did:plc:a/app.bsky.feed.post/1",
        authorDid: "did:plc:a",
        domain: "nytimes.com",
        cts: twoHoursAgo.toISOString(),
      }),
      makeLabel({
        uri: "at://did:plc:b/app.bsky.feed.post/2",
        authorDid: "did:plc:b",
        domain: "nytimes.com",
        cts: twoHoursAgo.toISOString(),
      }),
      makeLabel({
        uri: "at://did:plc:c/app.bsky.feed.post/3",
        authorDid: "did:plc:c",
        domain: "wsj.com",
        cts: oneHourAgo.toISOString(),
      }),
      makeLabel({
        uri: "at://did:plc:d/app.bsky.feed.post/4",
        authorDid: "did:plc:d",
        domain: "nytimes.com",
        cts: now.toISOString(),
      }),
    ];

    for (const label of testLabels) {
      await recordLabel(db, label);
    }

    const snapshot = await getDashboardSnapshot(db);

    expect(snapshot.stats.labelsEmitted).toBe(4);
    expect(snapshot.stats.lastEventAt).toBe(now.toISOString());

    expect(snapshot.topDomains).toEqual([
      { domain: "nytimes.com", labels: 3 },
      { domain: "wsj.com", labels: 1 },
    ]);

    expect(snapshot.recentLabels).toEqual([
      {
        uri: "at://did:plc:d/app.bsky.feed.post/4",
        authorDid: "did:plc:d",
        domain: "nytimes.com",
        createdAt: now.toISOString(),
        postText: null,
      },
      {
        uri: "at://did:plc:c/app.bsky.feed.post/3",
        authorDid: "did:plc:c",
        domain: "wsj.com",
        createdAt: oneHourAgo.toISOString(),
        postText: null,
      },
      {
        uri: "at://did:plc:b/app.bsky.feed.post/2",
        authorDid: "did:plc:b",
        domain: "nytimes.com",
        createdAt: twoHoursAgo.toISOString(),
        postText: null,
      },
      {
        uri: "at://did:plc:a/app.bsky.feed.post/1",
        authorDid: "did:plc:a",
        domain: "nytimes.com",
        createdAt: twoHoursAgo.toISOString(),
        postText: null,
      },
    ]);

    expect(snapshot.volume.length).toBeGreaterThanOrEqual(2);
    const totalFromVolume = snapshot.volume.reduce((sum, point) => sum + point.labels, 0);
    expect(totalFromVolume).toBe(4);
  });

  it("excludes volume points older than 24 hours", async () => {
    await recordLabel(
      db,
      makeLabel({
        uri: "at://did:plc:e/app.bsky.feed.post/5",
        authorDid: "did:plc:e",
        domain: "wsj.com",
        cts: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      }),
    );

    const snapshot = await getDashboardSnapshot(db);

    expect(snapshot.stats.labelsEmitted).toBe(5);

    const totalFromVolume = snapshot.volume.reduce((sum, point) => sum + point.labels, 0);
    expect(totalFromVolume).toBe(4);
  });
});

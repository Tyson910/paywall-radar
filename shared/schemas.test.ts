import { describe, expect, it } from "vitest";

import { dashboardSnapshotSchema } from "./schemas.js";

describe("dashboardSnapshotSchema", () => {
  const snapshot = {
    stats: {
      postsScanned: 120,
      labelsEmitted: 4,
      lastEventAt: "2026-07-25T04:00:00.000Z",
    },
    volume: [{ hour: "2026-07-25T04:00:00.000Z", labels: 4 }],
    topDomains: [{ domain: "example.com", labels: 4 }],
    recentLabels: [
      {
        uri: "at://did:plc:author/app.bsky.feed.post/example",
        authorDid: "did:plc:author",
        domain: "example.com",
        createdAt: "2026-07-25T04:00:00.000Z",
        postText: null,
      },
    ],
  };

  it("accepts a valid dashboard snapshot", () => {
    expect(dashboardSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("rejects negative or fractional counters", () => {
    expect(
      dashboardSnapshotSchema.safeParse({
        ...snapshot,
        stats: { ...snapshot.stats, postsScanned: -1 },
      }).success,
    ).toBe(false);
    expect(
      dashboardSnapshotSchema.safeParse({
        ...snapshot,
        volume: [{ ...snapshot.volume[0], labels: 1.5 }],
      }).success,
    ).toBe(false);
  });

  it("rejects invalid timestamps and empty domains", () => {
    expect(
      dashboardSnapshotSchema.safeParse({
        ...snapshot,
        volume: [{ ...snapshot.volume[0], hour: "not-a-timestamp" }],
      }).success,
    ).toBe(false);
    expect(
      dashboardSnapshotSchema.safeParse({
        ...snapshot,
        topDomains: [{ domain: "", labels: 1 }],
      }).success,
    ).toBe(false);
  });
});

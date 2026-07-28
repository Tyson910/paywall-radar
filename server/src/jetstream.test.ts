import { describe, expect, it } from "vitest";

import { parseDomainPatterns } from "./domains.js";
import { buildJetstreamUrl, processJetstreamMessage } from "./jetstream.js";

const patterns = parseDomainPatterns(["nytimes.com", "*.ft.com"]);

function createEvent(overrides: Record<string, unknown> = {}) {
  return {
    did: "did:plc:example",
    time_us: 1_725_519_626_134_432,
    kind: "commit",
    commit: {
      rev: "3l3qo2vutsw2b",
      operation: "create",
      collection: "app.bsky.feed.post",
      rkey: "3l3pte3p2e325",
      record: {
        $type: "app.bsky.feed.post",
        text: "An article",
        createdAt: "2026-07-25T05:00:00.000Z",
        facets: [
          {
            index: { byteStart: 0, byteEnd: 10 },
            features: [
              {
                $type: "app.bsky.richtext.facet#link",
                uri: "https://nytimes.com/example",
              },
            ],
          },
        ],
      },
      ...overrides,
    },
  };
}

describe("buildJetstreamUrl", () => {
  it("adds the post filter and optional cursor", () => {
    expect(
      buildJetstreamUrl("wss://jetstream2.us-east.bsky.network/subscribe", 1_725_519_626_134_432),
    ).toBe(
      "wss://jetstream2.us-east.bsky.network/subscribe?wantedCollections=app.bsky.feed.post&cursor=1725519626134432",
    );

    expect(buildJetstreamUrl("wss://jetstream2.us-east.bsky.network/subscribe", 0)).not.toContain(
      "cursor=",
    );
  });
});

describe("processJetstreamMessage", () => {
  it("validates and processes a post event", () => {
    expect(processJetstreamMessage(JSON.stringify(createEvent()), patterns)).toEqual({
      type: "post",
      cursorUs: 1_725_519_626_134_432,
      postUri: "at://did:plc:example/app.bsky.feed.post/3l3pte3p2e325",
      authorDid: "did:plc:example",
      postText: "An article",
      action: { val: "paywall", domain: "nytimes.com" },
    });
  });

  it("counts valid posts without paywalled links", () => {
    const event = createEvent({
      record: {
        text: "No link",
        createdAt: "2026-07-25T05:00:00.000Z",
      },
    });

    expect(processJetstreamMessage(JSON.stringify(event), patterns)).toMatchObject({
      type: "post",
      action: null,
    });
  });

  it("ignores deletes and non-commit events while advancing the cursor", () => {
    const deleted = createEvent({
      operation: "delete",
      record: undefined,
    });
    const identity = {
      did: "did:plc:example",
      time_us: 1_725_519_626_134_433,
      kind: "identity",
      identity: { did: "did:plc:example" },
    };

    expect(processJetstreamMessage(JSON.stringify(deleted), patterns)).toEqual({
      type: "ignored",
      cursorUs: 1_725_519_626_134_432,
    });
    expect(processJetstreamMessage(JSON.stringify(identity), patterns)).toEqual({
      type: "ignored",
      cursorUs: 1_725_519_626_134_433,
    });
  });

  it("rejects malformed JSON and create events without records", () => {
    expect(processJetstreamMessage("not json", patterns)).toEqual({
      type: "invalid",
    });
    expect(
      processJetstreamMessage(JSON.stringify(createEvent({ record: undefined })), patterns),
    ).toEqual({ type: "invalid" });
  });
});

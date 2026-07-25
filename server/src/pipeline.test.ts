import type { PostRecord } from "#shared/schemas.js";
import { describe, expect, it } from "vitest";

import { parseDomainPatterns } from "./domains.js";
import { processPost } from "./pipeline.js";

const patterns = parseDomainPatterns(["nytimes.com", "*.ft.com"]);

function createPost(overrides: Partial<PostRecord> = {}): PostRecord {
  return {
    text: "A post with a link",
    createdAt: "2026-07-25T05:00:00.000Z",
    ...overrides,
  };
}

describe("processPost", () => {
  it("labels an exact domain linked from a facet", () => {
    const post = createPost({
      facets: [
        {
          index: { byteStart: 0, byteEnd: 10 },
          features: [
            {
              $type: "app.bsky.richtext.facet#link",
              uri: "https://nytimes.com/2026/07/25/example",
            },
          ],
        },
      ],
    });

    expect(processPost(post, patterns)).toEqual({
      val: "paywall",
      domain: "nytimes.com",
    });
  });

  it("labels a wildcard domain linked from an external embed", () => {
    const post = createPost({
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://www.ft.com/content/example",
          title: "Example",
        },
      },
    });

    expect(processPost(post, patterns)).toEqual({
      val: "paywall",
      domain: "www.ft.com",
    });
  });

  it("deduplicates hostnames found in facets and embeds", () => {
    const post = createPost({
      facets: [
        {
          index: { byteStart: 0, byteEnd: 10 },
          features: [
            {
              $type: "app.bsky.richtext.facet#link",
              uri: "https://www.ft.com/first",
            },
            {
              $type: "app.bsky.richtext.facet#link",
              uri: "https://www.ft.com/second",
            },
          ],
        },
      ],
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: "https://www.ft.com/third",
          title: "Third",
        },
      },
    });

    expect(processPost(post, patterns)).toEqual({
      val: "paywall",
      domain: "www.ft.com",
    });
  });

  it("ignores non-link facets and non-paywalled URLs", () => {
    const post = createPost({
      facets: [
        {
          index: { byteStart: 0, byteEnd: 10 },
          features: [{ $type: "app.bsky.richtext.facet#mention", did: "did:plc:example" }],
        },
        {
          index: { byteStart: 11, byteEnd: 20 },
          features: [
            {
              $type: "app.bsky.richtext.facet#link",
              uri: "https://example.com/free",
            },
          ],
        },
      ],
    });

    expect(processPost(post, patterns)).toBeNull();
  });

  it("skips shortened and malformed URLs", () => {
    const post = createPost({
      facets: [
        {
          index: { byteStart: 0, byteEnd: 10 },
          features: [
            { $type: "app.bsky.richtext.facet#link", uri: "https://t.co/example" },
            { $type: "app.bsky.richtext.facet#link", uri: "not a url" },
          ],
        },
      ],
    });

    expect(processPost(post, patterns)).toBeNull();
  });
});

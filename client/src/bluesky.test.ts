import { describe, expect, it } from "vitest";

import { blueskyPostUrl } from "./bluesky.js";

describe("blueskyPostUrl", () => {
  it("keeps DID colons intact in Bluesky profile paths", () => {
    expect(
      blueskyPostUrl(
        "did:plc:b5c4zkfl35kwkhctliczqgsq",
        "at://did:plc:b5c4zkfl35kwkhctliczqgsq/app.bsky.feed.post/3mrpp52zmys2h",
      ),
    ).toBe("https://bsky.app/profile/did:plc:b5c4zkfl35kwkhctliczqgsq/post/3mrpp52zmys2h");
  });
});

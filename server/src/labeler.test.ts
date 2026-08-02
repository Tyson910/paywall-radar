import { Secp256k1Keypair, verifySignature } from "@atproto/crypto";
import { decodeAll, encode } from "@atproto/lex-cbor";
import { describe, expect, it } from "vitest";
import * as z from "zod";

import {
  encodeErrorFrame,
  encodeLabelsFrame,
  formatLabelForHttp,
  loadSigningKey,
  signLabel,
} from "./labeler.js";

describe("signLabel", () => {
  it("produces a signed label with a 64-byte signature", async () => {
    const keypair = await Secp256k1Keypair.create({ exportable: true });

    const signed = await signLabel(
      {
        src: "did:plc:test",
        uri: "at://did:plc:user/app.bsky.feed.post/abc",
        val: "paywall",
        cts: "2026-07-26T00:00:00.000Z",
      },
      keypair,
    );

    expect(signed.ver).toBe(1);
    expect(signed).not.toHaveProperty("neg");
    expect(signed.sig).toBeInstanceOf(Uint8Array);
    expect(signed.sig.length).toBe(64);
    const bytes = encode({
      ver: 1,
      src: signed.src,
      uri: signed.uri,
      val: signed.val,
      cts: signed.cts,
    });
    await expect(verifySignature(keypair.did(), bytes, signed.sig)).resolves.toBe(true);
  });

  it("excludes undefined optional fields", async () => {
    const keypair = await Secp256k1Keypair.create({ exportable: true });

    const signed = await signLabel(
      {
        src: "did:plc:test",
        uri: "at://did:plc:user/app.bsky.feed.post/abc",
        val: "paywall",
        cts: "2026-07-26T00:00:00.000Z",
      },
      keypair,
    );

    expect(signed.cid).toBeUndefined();
    expect(signed.exp).toBeUndefined();
    expect("cid" in signed).toBe(false);
    expect("exp" in signed).toBe(false);
  });
});

describe("loadSigningKey", () => {
  it("imports a hex-encoded private key", async () => {
    const original = await Secp256k1Keypair.create({ exportable: true });
    const exported = await original.export();
    const hex = Buffer.from(exported).toString("hex");

    const imported = await loadSigningKey(hex);
    expect(imported.did()).toBe(original.did());
  });
});

describe("encodeLabelsFrame", () => {
  it("produces two concatenated CBOR chunks", async () => {
    const keypair = await Secp256k1Keypair.create({ exportable: true });
    const signed = await signLabel(
      {
        src: "did:plc:test",
        uri: "at://did:plc:user/app.bsky.feed.post/abc",
        val: "paywall",
        cts: "2026-07-26T00:00:00.000Z",
      },
      keypair,
    );

    const frame = encodeLabelsFrame(42, signed);
    expect(frame).toBeInstanceOf(Uint8Array);
    expect(frame.length).toBeGreaterThan(0);

    const chunks = [...decodeAll(frame)];
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ op: 1, t: "#labels" });
    const body = z
      .object({ seq: z.number(), labels: z.array(z.record(z.string(), z.unknown())) })
      .parse(chunks[1]);
    expect(body.seq).toBe(42);
    expect(body.labels).toHaveLength(1);
    expect(body.labels[0]).not.toHaveProperty("neg");
  });
});

describe("encodeErrorFrame", () => {
  it("encodes an error frame with op -1", () => {
    const frame = encodeErrorFrame("FutureCursor", "cursor is in the future");
    const chunks = [...decodeAll(frame)];
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ op: -1 });
    expect(chunks[1]).toEqual({ error: "FutureCursor", message: "cursor is in the future" });
  });
});

describe("formatLabelForHttp", () => {
  it("converts sig to $bytes base64 format", async () => {
    const keypair = await Secp256k1Keypair.create({ exportable: true });
    const signed = await signLabel(
      {
        src: "did:plc:test",
        uri: "at://did:plc:user/app.bsky.feed.post/abc",
        val: "paywall",
        cts: "2026-07-26T00:00:00.000Z",
      },
      keypair,
    );

    const http = formatLabelForHttp(signed);
    expect(http.sig).toEqual({ $bytes: expect.any(String) });
    expect(http.ver).toBe(1);
    expect(http.src).toBe("did:plc:test");
    expect(http).not.toHaveProperty("cid");
    expect(http).not.toHaveProperty("exp");
    expect(http).not.toHaveProperty("neg");
  });
});

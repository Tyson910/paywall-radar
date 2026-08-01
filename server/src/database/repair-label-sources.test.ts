import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Secp256k1Keypair, verifySignature } from "@atproto/crypto";
import { type LexValue, encode } from "@atproto/lex-cbor";
import { describe, expect, it } from "vitest";

import { openDatabase } from "./connection.js";
import { initializeDatabase } from "./initialize.js";
import { labels } from "./models.js";
import { prepareLabelRepair, repairLabelSources } from "./repair-label-sources.js";

describe("repairLabelSources", () => {
  it("canonically re-signs, resequences, and runs only once", async () => {
    const directory = await mkdtemp(join(tmpdir(), "paywall-radar-repair-"));
    const databasePath = join(directory, "test.db");

    try {
      await initializeDatabase(databasePath);
      const { client, db } = openDatabase(databasePath);

      try {
        const keypair = await Secp256k1Keypair.create({ exportable: true });
        const correctSource = "did:plc:labeler";
        await db.insert(labels).values([
          {
            src: keypair.did(),
            uri: "at://did:plc:one/app.bsky.feed.post/one",
            val: "paywall",
            neg: false,
            cts: "2026-08-01T00:00:00.000Z",
            sig: Buffer.alloc(64),
            domain: "example.com",
            authorDid: "did:plc:one",
          },
          {
            src: correctSource,
            uri: "at://did:plc:two/app.bsky.feed.post/two",
            val: "paywall",
            neg: false,
            cts: "2026-08-01T00:00:01.000Z",
            sig: Buffer.alloc(64),
            domain: "example.com",
            authorDid: "did:plc:two",
          },
        ]);

        await prepareLabelRepair(db);
        const result = await repairLabelSources(
          db,
          {
            fromSource: keypair.did(),
            toSource: correctSource,
            signer: keypair,
            resequence: true,
          },
          true,
        );

        expect(result).toMatchObject({
          matched: 2,
          repaired: 2,
          alreadyCompleted: false,
          firstId: 1,
          lastId: 2,
          newFirstId: 3,
          newLastId: 4,
        });

        const repaired = await db.select().from(labels).orderBy(labels.id);
        expect(repaired.map((row) => row.id)).toEqual([3, 4]);
        expect(repaired.every((row) => row.src === correctSource)).toBe(true);

        for (const row of repaired) {
          const bytes = encode({
            ver: 1,
            src: row.src,
            uri: row.uri,
            val: row.val,
            cts: row.cts,
          } as LexValue);
          await expect(
            verifySignature(keypair.did(), bytes, new Uint8Array(row.sig)),
          ).resolves.toBe(true);
        }

        const second = await repairLabelSources(
          db,
          {
            fromSource: keypair.did(),
            toSource: correctSource,
            signer: keypair,
            resequence: true,
          },
          true,
        );
        expect(second).toMatchObject({ repaired: 0, alreadyCompleted: true });
        expect((await db.select().from(labels).orderBy(labels.id)).map((row) => row.id)).toEqual([
          3, 4,
        ]);
      } finally {
        client.close();
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

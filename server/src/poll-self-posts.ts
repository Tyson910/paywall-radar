import type { Secp256k1Keypair } from "@atproto/crypto";

import { z } from "zod";

import { postRecordSchema } from "#shared/schemas.js";

import type { Database } from "./database/connection.js";
import type { DomainPattern } from "./domains.js";
import type { LabelStream } from "./label-stream.js";

import { recordLabel } from "./database/labels.js";
import { signLabel } from "./labeler.js";
import { processPost } from "./pipeline.js";

const didDocSchema = z.object({
  service: z
    .array(z.object({ id: z.string(), serviceEndpoint: z.string() }))
    .optional(),
});

const listRecordsSchema = z.object({
  records: z.array(z.object({ uri: z.string(), cid: z.string(), value: z.unknown() })),
});

export interface PollSelfPostsDeps {
  did: string;
  patterns: readonly DomainPattern[];
  keypair: Secp256k1Keypair;
  db: Database;
  labelStream: LabelStream;
}

/**
 * Labeler accounts are excluded from the Jetstream firehose, so our
 * own posts never arrive via the WebSocket consumer. This function
 * fetches the labeler's recent posts directly from its PDS and labels
 * any that match a monitored domain. Safe to call repeatedly —
 * recordLabel deduplicates on URI.
 */
export async function pollSelfPosts({
  did,
  patterns,
  keypair,
  db,
  labelStream,
}: PollSelfPostsDeps): Promise<{ posts: number; labeled: number }> {
  const didRes = await fetch(`https://plc.directory/${did}`);
  if (!didRes.ok) throw new Error(`PLC directory returned ${didRes.status}`);
  const didDoc = didDocSchema.parse(await didRes.json());
  const pdsUrl = didDoc.service?.find((s) => s.id === "#atproto_pds")?.serviceEndpoint;
  if (!pdsUrl) throw new Error(`No #atproto_pds service for ${did}`);

  const url = new URL(`${pdsUrl}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set("repo", did);
  url.searchParams.set("collection", "app.bsky.feed.post");
  url.searchParams.set("limit", "20");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`listRecords returned ${res.status}`);

  const data = listRecordsSchema.parse(await res.json());

  let labeled = 0;
  for (const record of data.records) {
    const parsed = postRecordSchema.safeParse(record.value);
    if (!parsed.success) continue;

    const action = processPost(parsed.data, patterns);
    if (!action) continue;

    const signed = await signLabel(
      { src: did, uri: record.uri, val: action.val, cts: new Date().toISOString() },
      keypair,
    );
    const inserted = await recordLabel(db, {
      ...signed,
      domain: action.domain,
      authorDid: did,
      postText: parsed.data.text,
    });

    if (inserted) {
      labelStream.publish(inserted.id, signed);
      labeled++;
    }
  }

  return { posts: data.records.length, labeled };
}

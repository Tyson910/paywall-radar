import type { Database } from "./connection.js";

import { labels } from "./models.js";

export interface LabelRecord {
  src: string;
  uri: string;
  val: string;
  neg?: boolean;
  cts: string;
  cid?: string | null;
  exp?: string | null;
  sig: Uint8Array;
  domain: string;
  authorDid: string;
  postText?: string | null;
}

export async function recordLabel(
  db: Database,
  label: LabelRecord,
): Promise<{ id: number } | null> {
  const inserted = await db
    .insert(labels)
    .values({
      src: label.src,
      uri: label.uri,
      val: label.val,
      neg: label.neg ?? false,
      cts: label.cts,
      cid: label.cid ?? null,
      exp: label.exp ?? null,
      sig: Buffer.from(label.sig),
      domain: label.domain,
      authorDid: label.authorDid,
      postText: label.postText ?? null,
    })
    .onConflictDoNothing({ target: labels.uri })
    .returning({ id: labels.id });

  return inserted[0] ?? null;
}

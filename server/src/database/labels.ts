import { eq } from "drizzle-orm";

import type { SignedLabel } from "../labeler.js";

import type { Database } from "./connection.js";

import { labelEvents, labels } from "./models.js";

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
): Promise<{ id: number; seq: number } | null> {
  return db.transaction(async (tx) => {
    const inserted = await tx
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

    const row = inserted[0];
    if (!row) return null;

    const [event] = await tx
      .insert(labelEvents)
      .values(toEventValues(label))
      .returning({ seq: labelEvents.seq });

    if (!event) throw new Error("Failed to append label publication event");
    return { id: row.id, seq: event.seq };
  });
}

interface PublicationLabel {
  src: string;
  uri: string;
  val: string;
  neg?: boolean;
  cts: string;
  cid?: string | null;
  exp?: string | null;
  sig: Uint8Array;
}

function toEventValues(label: PublicationLabel) {
  return {
    src: label.src,
    uri: label.uri,
    val: label.val,
    neg: label.neg ?? false,
    cts: label.cts,
    cid: label.cid ?? null,
    exp: label.exp ?? null,
    sig: Buffer.from(label.sig),
  };
}

export async function loadLabelByUri(db: Database, uri: string) {
  const [row] = await db.select().from(labels).where(eq(labels.uri, uri));
  return row ?? null;
}

export async function publishLabelRevision(
  db: Database,
  label: SignedLabel,
): Promise<{ id: number; seq: number } | null> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(labels)
      .set({
        src: label.src,
        val: label.val,
        neg: label.neg ?? false,
        cts: label.cts,
        cid: label.cid ?? null,
        exp: label.exp ?? null,
        sig: Buffer.from(label.sig),
      })
      .where(eq(labels.uri, label.uri))
      .returning({ id: labels.id });

    if (!updated) return null;

    const [event] = await tx
      .insert(labelEvents)
      .values(toEventValues(label))
      .returning({ seq: labelEvents.seq });

    if (!event) throw new Error("Failed to append label publication event");
    return { id: updated.id, seq: event.seq };
  });
}

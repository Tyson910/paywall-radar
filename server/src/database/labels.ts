import { eq } from "drizzle-orm";

import type { SignedLabel } from "../labeler.js";

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

function eventArgs(label: PublicationLabel) {
  return [
    label.src,
    label.uri,
    label.val,
    label.neg ? 1 : 0,
    label.cts,
    label.cid ?? null,
    label.exp ?? null,
    Buffer.from(label.sig),
  ];
}

// `db.transaction()` opens a second connection per call; that connection has
// no busy_timeout, so its BEGIN IMMEDIATE fails instantly with SQLITE_BUSY
// whenever another write holds the lock. `client.batch` runs on the one
// shared connection (which has busy_timeout set) inside a single immediate
// transaction, so writes serialize and wait for the lock instead of failing.
// `changes()` guards the event insert so it only runs when the first
// statement actually wrote a row, mirroring the old in-transaction branching.
const appendEventSql = `
  insert into label_events (src, uri, val, neg, cts, cid, exp, sig)
  select ?, ?, ?, ?, ?, ?, ?, ? where changes() = 1
  returning seq
`;

export async function recordLabel(
  db: Database,
  label: LabelRecord,
): Promise<{ id: number; seq: number } | null> {
  const [labelResult, eventResult] = await db.$client.batch(
    [
      {
        sql: `
          insert into labels (src, uri, val, neg, cts, cid, exp, sig, domain, author_did, post_text)
          values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict (uri) do nothing
          returning id
        `,
        args: [
          label.src,
          label.uri,
          label.val,
          label.neg ? 1 : 0,
          label.cts,
          label.cid ?? null,
          label.exp ?? null,
          Buffer.from(label.sig),
          label.domain,
          label.authorDid,
          label.postText ?? null,
        ],
      },
      { sql: appendEventSql, args: eventArgs(label) },
    ],
    "write",
  );

  const id = labelResult?.rows[0]?.id;
  if (typeof id !== "number") return null;

  const seq = eventResult?.rows[0]?.seq;
  if (typeof seq !== "number") {
    throw new Error("Failed to append label publication event");
  }

  return { id, seq };
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

export async function loadLabelByUri(db: Database, uri: string) {
  const [row] = await db.select().from(labels).where(eq(labels.uri, uri));
  return row ?? null;
}

export async function publishLabelRevision(
  db: Database,
  label: SignedLabel,
): Promise<{ id: number; seq: number } | null> {
  const [updateResult, eventResult] = await db.$client.batch(
    [
      {
        sql: `
          update labels
          set src = ?, val = ?, neg = ?, cts = ?, cid = ?, exp = ?, sig = ?
          where uri = ?
          returning id
        `,
        args: [
          label.src,
          label.val,
          label.neg ? 1 : 0,
          label.cts,
          label.cid ?? null,
          label.exp ?? null,
          Buffer.from(label.sig),
          label.uri,
        ],
      },
      { sql: appendEventSql, args: eventArgs(label) },
    ],
    "write",
  );

  const id = updateResult?.rows[0]?.id;
  if (typeof id !== "number") return null;

  const seq = eventResult?.rows[0]?.seq;
  if (typeof seq !== "number") {
    throw new Error("Failed to append label publication event");
  }

  return { id, seq };
}

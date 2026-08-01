import { and, eq } from "drizzle-orm";

import { type LabelSigner, type SignedLabel, signLabel } from "../labeler.js";

import type { Database } from "./connection.js";

import { labels } from "./models.js";

export interface RepairLabelSourcesOptions {
  fromSource: string;
  toSource: string;
  signer: LabelSigner;
}

export interface RepairLabelSourcesResult {
  matched: number;
  repaired: number;
  firstId?: number;
  lastId?: number;
}

export async function repairLabelSources(
  db: Database,
  { fromSource, toSource, signer }: RepairLabelSourcesOptions,
  write: boolean,
): Promise<RepairLabelSourcesResult> {
  const rows = await db.select().from(labels).where(eq(labels.src, fromSource)).orderBy(labels.id);
  const firstId = rows.at(0)?.id;
  const lastId = rows.at(-1)?.id;

  if (!write || rows.length === 0) {
    return {
      matched: rows.length,
      repaired: 0,
      ...(firstId != null && { firstId }),
      ...(lastId != null && { lastId }),
    };
  }

  let repaired = 0;
  await db.transaction(async (tx) => {
    for (const row of rows) {
      const repairedLabel: SignedLabel = await signLabel(
        {
          src: toSource,
          uri: row.uri,
          val: row.val,
          neg: row.neg,
          cts: row.cts,
          ...(row.cid != null && { cid: row.cid }),
          ...(row.exp != null && { exp: row.exp }),
        },
        signer,
      );

      const updated = await tx
        .update(labels)
        .set({ src: toSource, sig: Buffer.from(repairedLabel.sig) })
        .where(and(eq(labels.id, row.id), eq(labels.src, fromSource)))
        .returning({ id: labels.id });

      if (updated.length !== 1) {
        throw new Error(`Label ${String(row.id)} changed during repair; rolling back`);
      }
      repaired += 1;
    }
  });

  return {
    matched: rows.length,
    repaired,
    ...(firstId != null && { firstId }),
    ...(lastId != null && { lastId }),
  };
}

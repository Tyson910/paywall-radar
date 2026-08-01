import { eq, sql } from "drizzle-orm";

import { type LabelSigner, signLabel } from "../labeler.js";

import type { Database } from "./connection.js";

import { labels } from "./models.js";

const repairName = "canonical-label-signatures-v1";

export interface RepairLabelSourcesOptions {
  fromSource: string;
  toSource: string;
  signer: LabelSigner;
  resequence: boolean;
}

export interface RepairLabelSourcesResult {
  matched: number;
  repaired: number;
  alreadyCompleted: boolean;
  firstId?: number;
  lastId?: number;
  newFirstId?: number;
  newLastId?: number;
}

export async function prepareLabelRepair(db: Database): Promise<void> {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS maintenance_repairs (
      name TEXT PRIMARY KEY NOT NULL,
      completed_at TEXT NOT NULL
    )
  `);
}

export async function repairLabelSources(
  db: Database,
  { fromSource, toSource, signer, resequence }: RepairLabelSourcesOptions,
  write: boolean,
): Promise<RepairLabelSourcesResult> {
  const [completed] = write
    ? await db.all<{ name: string }>(sql`
        SELECT name FROM maintenance_repairs WHERE name = ${repairName}
      `)
    : [];
  const rows = await db.select().from(labels).orderBy(labels.id);
  const firstId = rows.at(0)?.id;
  const lastId = rows.at(-1)?.id;

  if (completed || !write || rows.length === 0) {
    return {
      matched: rows.length,
      repaired: 0,
      alreadyCompleted: completed != null,
      ...(firstId != null && { firstId }),
      ...(lastId != null && { lastId }),
    };
  }

  const repairedRows: Array<{ id: number; source: string; sig: Buffer }> = [];
  const signingBatchSize = 32;
  for (let index = 0; index < rows.length; index += signingBatchSize) {
    const batch = rows.slice(index, index + signingBatchSize);
    const signedBatch = await Promise.all(
      batch.map(async (row) => {
        const source = row.src === fromSource ? toSource : row.src;
        if (source !== toSource) {
          throw new Error(`Label ${String(row.id)} has unexpected source ${source}`);
        }

        const repaired = await signLabel(
          {
            src: source,
            uri: row.uri,
            val: row.val,
            neg: row.neg,
            cts: row.cts,
            ...(row.cid != null && { cid: row.cid }),
            ...(row.exp != null && { exp: row.exp }),
          },
          signer,
        );
        return { id: row.id, source, sig: Buffer.from(repaired.sig) };
      }),
    );
    repairedRows.push(...signedBatch);
  }

  const sequenceOffset = resequence ? (lastId ?? 0) : 0;
  await db.transaction(async (tx) => {
    for (const row of repairedRows) {
      const updated = await tx
        .update(labels)
        .set({ src: row.source, sig: row.sig })
        .where(eq(labels.id, row.id))
        .returning({ id: labels.id });

      if (updated.length !== 1) {
        throw new Error(`Label ${String(row.id)} changed during repair; rolling back`);
      }
    }

    if (sequenceOffset > 0) {
      // Negate first so shifted primary keys cannot collide with existing IDs.
      await tx.run(sql`UPDATE labels SET id = -id`);
      await tx.run(sql`UPDATE labels SET id = -id + ${sequenceOffset}`);
      await tx.run(sql`
        UPDATE sqlite_sequence
        SET seq = ${sequenceOffset + (lastId ?? 0)}
        WHERE name = 'labels'
      `);
    }

    await tx.run(sql`
      INSERT INTO maintenance_repairs (name, completed_at)
      VALUES (${repairName}, ${new Date().toISOString()})
    `);
  });

  return {
    matched: rows.length,
    repaired: repairedRows.length,
    alreadyCompleted: false,
    ...(firstId != null && { firstId }),
    ...(lastId != null && { lastId }),
    ...(firstId != null && { newFirstId: firstId + sequenceOffset }),
    ...(lastId != null && { newLastId: lastId + sequenceOffset }),
  };
}

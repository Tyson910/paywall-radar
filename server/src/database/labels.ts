import type { Database } from "./connection.js";
import { labelsLog } from "./models.js";

export interface LabelRecord {
  postUri: string;
  authorDid: string;
  domain: string;
}

export async function recordLabel(db: Database, label: LabelRecord): Promise<boolean> {
  const inserted = await db
    .insert(labelsLog)
    .values({
      ...label,
      labeledAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: labelsLog.postUri })
    .returning({ id: labelsLog.id });

  return inserted.length === 1;
}

import { count, desc, max, sql } from "drizzle-orm";

import type { DashboardSnapshot } from "#shared/schemas.js";

import type { Database } from "./connection.js";
import { cursor, labelsLog } from "./models.js";

export async function getDashboardSnapshot(db: Database): Promise<DashboardSnapshot> {
  const [stats, volume, topDomains] = await Promise.all([
    getStatsSummary(db),
    getHourlyVolume(db),
    getTopDomains(db),
  ]);

  return { stats, volume, topDomains };
}

async function getStatsSummary(db: Database) {
  const [cursorRow] = await db
    .select({ postsScanned: cursor.postsScanned })
    .from(cursor);

  const [labelsRow] = await db
    .select({
      labelsEmitted: count(),
      lastEventAt: max(labelsLog.labeledAt),
    })
    .from(labelsLog);

  return {
    postsScanned: cursorRow?.postsScanned ?? 0,
    labelsEmitted: labelsRow?.labelsEmitted ?? 0,
    lastEventAt: labelsRow?.lastEventAt ?? null,
  };
}

async function getHourlyVolume(db: Database) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select({
      hour: sql<string>`strftime('%Y-%m-%dT%H:00:00.000Z', ${labelsLog.labeledAt})`,
      labels: count(),
    })
    .from(labelsLog)
    .where(sql`${labelsLog.labeledAt} >= ${cutoff}`)
    .groupBy(sql`strftime('%Y-%m-%dT%H:00:00.000Z', ${labelsLog.labeledAt})`)
    .orderBy(sql`strftime('%Y-%m-%dT%H:00:00.000Z', ${labelsLog.labeledAt})`);

  return rows.map((row) => ({ hour: row.hour, labels: row.labels }));
}

async function getTopDomains(db: Database) {
  const rows = await db
    .select({
      domain: labelsLog.domain,
      labels: count(),
    })
    .from(labelsLog)
    .groupBy(labelsLog.domain)
    .orderBy(desc(count()));

  return rows.map((row) => ({ domain: row.domain, labels: row.labels }));
}

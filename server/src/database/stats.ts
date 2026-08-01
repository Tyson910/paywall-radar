import { and, count, desc, eq, gt, max, sql } from "drizzle-orm";

import type { DashboardSnapshot, MonitoredDomain, RecentLabelsPage } from "#shared/schemas.js";

import type { Database } from "./connection.js";

import { cursor, domains, jetstreamCursors, labels } from "./models.js";

export async function getDashboardSnapshot(db: Database): Promise<DashboardSnapshot> {
  const [stats, volume, topDomains, recentLabels] = await Promise.all([
    getStatsSummary(db),
    getHourlyVolume(db),
    getTopDomains(db),
    getRecentLabels(db),
  ]);

  return { stats, volume, topDomains, recentLabels };
}

async function getStatsSummary(db: Database) {
  const [[jetstreamRow], [cursorRow]] = await Promise.all([
    db.select({ postsScanned: max(jetstreamCursors.postsScanned) }).from(jetstreamCursors),
    db.select({ postsScanned: cursor.postsScanned }).from(cursor),
  ]);

  const [labelsRow] = await db
    .select({
      labelsEmitted: count(),
      lastEventAt: max(labels.cts),
    })
    .from(labels);

  return {
    postsScanned: jetstreamRow?.postsScanned ?? cursorRow?.postsScanned ?? 0,
    labelsEmitted: labelsRow?.labelsEmitted ?? 0,
    lastEventAt: labelsRow?.lastEventAt ?? null,
  };
}

async function getHourlyVolume(db: Database) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .select({
      hour: sql<string>`strftime('%Y-%m-%dT%H:00:00.000Z', ${labels.cts})`,
      labels: count(),
    })
    .from(labels)
    .where(sql`${labels.cts} >= ${cutoff}`)
    .groupBy(sql`strftime('%Y-%m-%dT%H:00:00.000Z', ${labels.cts})`)
    .orderBy(sql`strftime('%Y-%m-%dT%H:00:00.000Z', ${labels.cts})`);

  return rows;
}

function apexDomain(hostname: string): string {
  const parts = hostname.split(".");
  return parts.slice(-2).join(".");
}

async function getTopDomains(db: Database) {
  const rows = await db
    .select({
      domain: labels.domain,
      labels: count(),
    })
    .from(labels)
    .groupBy(labels.domain);

  const grouped = new Map<string, number>();
  for (const row of rows) {
    const apex = apexDomain(row.domain);
    grouped.set(apex, (grouped.get(apex) ?? 0) + row.labels);
  }

  return Array.from(grouped, ([domain, labels]) => ({ domain, labels })).sort(
    (a, b) => b.labels - a.labels,
  );
}

async function getRecentLabels(db: Database) {
  const rows = await db
    .select({
      uri: labels.uri,
      authorDid: labels.authorDid,
      domain: labels.domain,
      createdAt: labels.cts,
      postText: labels.postText,
    })
    .from(labels)
    .orderBy(desc(labels.cts), desc(labels.id))
    .limit(10);

  return rows;
}

export async function getMonitoredDomains(db: Database): Promise<MonitoredDomain[]> {
  const rows = await db
    .select({ pattern: domains.pattern, addedAt: domains.addedAt })
    .from(domains)
    .orderBy(domains.pattern);

  return rows;
}

const LABELS_PAGE_SIZE = 10;

export async function getRecentLabelsPage(
  db: Database,
  opts: { cursor?: number; domain?: string },
): Promise<RecentLabelsPage> {
  const conditions = [];
  if (opts.cursor) conditions.push(gt(labels.id, 0), sql`${labels.id} < ${opts.cursor}`);
  if (opts.domain) conditions.push(eq(labels.domain, opts.domain));

  const rows = await db
    .select({
      id: labels.id,
      uri: labels.uri,
      authorDid: labels.authorDid,
      domain: labels.domain,
      createdAt: labels.cts,
      postText: labels.postText,
    })
    .from(labels)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(labels.id))
    .limit(LABELS_PAGE_SIZE + 1);

  const hasMore = rows.length > LABELS_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, LABELS_PAGE_SIZE) : rows;
  const nextCursor = hasMore ? page[page.length - 1]!.id : null;

  return {
    labels: page.map(({ id: _, ...label }) => label),
    nextCursor,
  };
}

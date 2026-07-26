import type { StatsSummary } from "#shared/schemas.js";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-6 py-5 dark:border-neutral-700">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

export function StatsCards({ stats }: { stats: StatsSummary }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <Card label="Posts scanned" value={formatCount(stats.postsScanned)} />
      <Card label="Labels emitted" value={formatCount(stats.labelsEmitted)} />
      {stats.lastEventAt && (
        <Card label="Last label" value={formatRelativeTime(stats.lastEventAt)} />
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";

import { dashboardQueryOptions } from "../api.js";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-6 py-4 text-center dark:border-neutral-700">
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{label}</p>
    </div>
  );
}

export function LiveStats() {
  const { data } = useQuery(dashboardQueryOptions());

  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard label="Posts scanned" value={formatCount(data.stats.postsScanned)} />
      <StatCard label="Labels emitted" value={formatCount(data.stats.labelsEmitted)} />
    </div>
  );
}

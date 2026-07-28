import { useQuery } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import type { StatsSummary, VolumePoint } from "#shared/schemas.js";

import { dashboardQueryOptions, domainsQueryOptions } from "../api.js";
import { DomainsMonitored } from "../components/DomainsMonitored.js";
import { QueryGuard } from "../components/QueryGuard.js";
import { RecentLabels } from "../components/RecentLabels.js";
import { Skeleton } from "../components/Skeleton.js";
import { TopDomains } from "../components/TopDomains.js";
import { VolumeChart } from "../components/VolumeChart.js";

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

function subscribeToLocation(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

function getLocationSearch() {
  return window.location.search;
}

function useDomainFilter() {
  const search = useSyncExternalStore(subscribeToLocation, getLocationSearch);
  const domain = new URLSearchParams(search).get("domain") ?? undefined;

  const setDomain = useCallback((d: string) => {
    const next = new URLSearchParams(window.location.search);
    next.set("domain", d);
    window.history.pushState({}, "", `?${next.toString()}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  const clearDomain = useCallback(() => {
    const next = new URLSearchParams(window.location.search);
    next.delete("domain");
    const qs = next.toString();
    window.history.pushState({}, "", qs ? `?${qs}` : window.location.pathname);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, []);

  return { domain, setDomain, clearDomain };
}

function Tile({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl bg-white p-6 shadow-sm dark:border dark:border-neutral-700/50 dark:bg-neutral-800 dark:shadow-none ${className}`}
    >
      {children}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Tile>
      <p className="text-sm font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{value}</p>
    </Tile>
  );
}

function StatusPulse({ lastEventAt }: { lastEventAt: string | null }) {
  let color: string;
  let label: string;

  if (!lastEventAt) {
    color = "bg-neutral-400";
    label = "No data";
  } else {
    const seconds = Math.floor((Date.now() - new Date(lastEventAt).getTime()) / 1000);
    if (seconds < 1800) {
      color = "bg-emerald-500";
      label = "Active";
    } else if (seconds < 7200) {
      color = "bg-amber-500";
      label = "Quiet";
    } else {
      color = "bg-red-500";
      label = "Stale";
    }
  }

  return (
    <Tile className="flex flex-col items-start justify-center gap-2">
      <div className="flex flex-row items-center">
        <span className={`size-3 rounded-full ${color} mr-1.5 animate-pulse`} />
        <p className="text-sm font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Status
        </p>
      </div>
      <p className="text-2xl font-bold tracking-tight">{label}</p>
    </Tile>
  );
}

function BentoSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl lg:col-span-2 lg:row-span-2" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-32 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl lg:col-span-3" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl lg:col-span-4" />
    </div>
  );
}

function DashboardContent({
  stats,
  volume,
  topDomains,
  domain,
  onDomainClick,
  onClearFilter,
}: {
  stats: StatsSummary;
  volume: VolumePoint[];
  topDomains: { domain: string; labels: number }[];
  domain?: string;
  onDomainClick: (domain: string) => void;
  onClearFilter: () => void;
}) {
  const domainsQuery = useQuery(domainsQueryOptions());

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
      <StatTile label="Posts scanned" value={formatCount(stats.postsScanned)} />
      <StatTile label="Labels emitted" value={formatCount(stats.labelsEmitted)} />

      <Tile className="flex flex-col lg:col-span-2 lg:row-span-2">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Labels per hour (24h)
        </p>
        <div className="min-h-50 flex-1">
          <VolumeChart data={volume} />
        </div>
      </Tile>

      <StatTile
        label="Last label"
        value={stats.lastEventAt ? formatRelativeTime(stats.lastEventAt) : "—"}
      />
      <StatusPulse lastEventAt={stats.lastEventAt} />

      <Tile className="lg:col-span-full">
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Top paywalled domains
        </p>
        <TopDomains data={topDomains} onDomainClick={onDomainClick} />
      </Tile>

      <Tile className="lg:col-span-4">
        {domainsQuery.isSuccess ? (
          <DomainsMonitored data={domainsQuery.data} onDomainClick={onDomainClick} />
        ) : (
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Domains monitored
            </p>
            <Skeleton className="mt-2 h-12 w-20 rounded" />
          </div>
        )}
      </Tile>

      <Tile className="lg:col-span-4">
        <RecentLabels domain={domain} onClearFilter={onClearFilter} />
      </Tile>
    </div>
  );
}

export function Dashboard() {
  const query = useQuery(dashboardQueryOptions());
  const { domain, setDomain, clearDomain } = useDomainFilter();

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900">
      <div className="mx-auto max-w-7xl p-5">
        <p className="mb-5 text-sm text-neutral-400 dark:text-neutral-500">
          <a href="/" className="hover:text-neutral-600 dark:hover:text-neutral-300">
            Paywall Radar
          </a>
          <span className="mx-1.5">/</span>
          Dashboard
        </p>

        <QueryGuard query={query} pending={() => <BentoSkeleton />}>
          {(data) => (
            <DashboardContent
              stats={data.stats}
              volume={data.volume}
              topDomains={data.topDomains}
              domain={domain}
              onDomainClick={setDomain}
              onClearFilter={clearDomain}
            />
          )}
        </QueryGuard>
      </div>
    </div>
  );
}

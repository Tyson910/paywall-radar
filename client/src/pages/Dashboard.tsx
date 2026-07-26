import { useQuery } from "@tanstack/react-query";

import { dashboardQueryOptions } from "../api.js";
import { QueryGuard } from "../components/QueryGuard.js";
import { StatsCards } from "../components/StatsCards.js";
import { TopDomains } from "../components/TopDomains.js";
import { VolumeChart } from "../components/VolumeChart.js";

export function Dashboard() {
  const query = useQuery(dashboardQueryOptions());

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <a
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          Home
        </a>
      </div>

      <QueryGuard query={query} skeletonType="card">
        {(data) => (
          <div className="space-y-10">
            <StatsCards stats={data.stats} />

            <section>
              <h2 className="mb-4 text-lg font-semibold">Labels per hour (last 24h)</h2>
              <VolumeChart data={data.volume} />
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold">Top paywalled domains</h2>
              <TopDomains data={data.topDomains} />
            </section>
          </div>
        )}
      </QueryGuard>
    </div>
  );
}

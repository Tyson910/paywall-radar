import { useQuery } from "@tanstack/react-query";

import { dashboardQueryOptions, domainsQueryOptions } from "../api.js";

function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}

export function LiveStats() {
  const { data } = useQuery(dashboardQueryOptions());
  const { data: domains } = useQuery(domainsQueryOptions());

  if (!data) {
    return (
      <div>
        <h2 className="section-heading">What it’s seen</h2>
        <p className="mt-3 text-sm text-stone-500">Listening for live activity…</p>
      </div>
    );
  }

  const stats = [
    { value: formatCount(data.stats.postsScanned), label: "posts scanned" },
    { value: formatCount(data.stats.labelsEmitted), label: "paywalls labeled" },
    ...(domains ? [{ value: formatCount(domains.length), label: "domains watched" }] : []),
  ];

  return (
    <div>
      <h2 className="section-heading">What it’s seen</h2>
      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-5 sm:gap-x-12">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dd className="text-xl font-semibold tracking-tight text-stone-900 tabular-nums">
              {stat.value}
            </dd>
            <dt className="mt-0.5 text-sm text-stone-500">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}

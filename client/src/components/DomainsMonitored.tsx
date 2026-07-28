import type { MonitoredDomain } from "#shared/schemas.js";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export function DomainsMonitored({
  data,
  onDomainClick,
}: {
  data: MonitoredDomain[];
  onDomainClick: (domain: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
        {data.length} domains monitored
      </p>

      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 lg:grid-cols-3">
        {data.map((d) => {
          const displayName = d.pattern.replace(/^\*\./, "");
          return (
            <li key={d.pattern}>
              <button
                type="button"
                onClick={() => onDomainClick(displayName)}
                className="flex w-full items-baseline justify-between gap-2 py-1 text-left text-sm hover:text-blue-600 dark:hover:text-blue-400"
              >
                <span className="font-medium text-neutral-700 dark:text-neutral-300">
                  {displayName}
                </span>
                <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
                  {formatDate(d.addedAt)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

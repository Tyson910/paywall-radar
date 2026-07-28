import type { DomainCount } from "#shared/schemas.js";

const BAR_COLOR_LIGHT = "#2a78d6";
const BAR_COLOR_DARK = "#3987e5";

export function TopDomains({
  data,
  onDomainClick,
}: {
  data: DomainCount[];
  onDomainClick?: (domain: string) => void;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-neutral-400 dark:text-neutral-500">
        No domains labeled yet
      </div>
    );
  }

  const max = data[0]?.labels ?? 1;

  return (
    <div className="space-y-3">
      {data.map((entry) => (
        <button
          key={entry.domain}
          type="button"
          className="block w-full text-left hover:opacity-80"
          onClick={() => onDomainClick?.(entry.domain)}
        >
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="text-neutral-700 dark:text-neutral-300">{entry.domain}</span>
            <span className="font-medium tabular-nums">{entry.labels.toLocaleString()}</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${(entry.labels / max) * 100}%`,
                backgroundColor: `var(--top-domains-bar, ${BAR_COLOR_LIGHT})`,
              }}
            />
          </div>
        </button>
      ))}
      <style>{`
        @media (prefers-color-scheme: dark) {
          :root:where(:not([data-theme="light"])) { --top-domains-bar: ${BAR_COLOR_DARK}; }
        }
        :root[data-theme="dark"] { --top-domains-bar: ${BAR_COLOR_DARK}; }
      `}</style>
    </div>
  );
}

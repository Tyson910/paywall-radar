import { useQuery } from "@tanstack/react-query";

import { dashboardQueryOptions } from "../api.js";
import { blueskyPostUrl } from "../bluesky.js";

import { PostText } from "./PostText.js";

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

export function LiveStats() {
  const { data } = useQuery(dashboardQueryOptions());

  if (!data) return null;

  const latestLabel = data.recentLabels[0];

  return (
    <div>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-neutral-500 dark:text-neutral-400">
        <span>
          <strong className="text-3xl font-semibold tracking-tight text-neutral-950 tabular-nums dark:text-white">
            {formatCount(data.stats.postsScanned)}
          </strong>{" "}
          posts checked
        </span>
        <span className="text-neutral-300 dark:text-neutral-700" aria-hidden="true">
          /
        </span>
        <span>
          <strong className="text-3xl font-semibold tracking-tight text-neutral-950 tabular-nums dark:text-white">
            {formatCount(data.stats.labelsEmitted)}
          </strong>{" "}
          paywalls found
        </span>
      </p>
      {latestLabel && (
        <div className="mt-8 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">Last tagged post</p>
          <a
            href={blueskyPostUrl(latestLabel.authorDid, latestLabel.uri)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-2 font-medium hover:text-blue-600 dark:hover:text-blue-400"
          >
            {latestLabel.domain}
            <span className="font-normal text-neutral-400">
              {formatRelativeTime(latestLabel.createdAt)} ↗
            </span>
          </a>
          <PostText authorDid={latestLabel.authorDid} uri={latestLabel.uri} />
        </div>
      )}
    </div>
  );
}

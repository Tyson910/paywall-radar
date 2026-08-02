import { useInfiniteQuery } from "@tanstack/react-query";

import type { RecentLabel } from "#shared/schemas.js";

import { labelsQueryOptions } from "../api.js";
import { blueskyPostUrl } from "../bluesky.js";

import { PostText } from "./PostText.js";

function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function LabelRow({ label }: { label: RecentLabel }) {
  const postUrl = blueskyPostUrl(label.authorDid, label.uri);

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <a
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5"
          >
            <span className="font-medium text-neutral-800 group-hover:text-blue-600 dark:text-neutral-200 dark:group-hover:text-blue-400">
              {label.domain}
            </span>
            <span
              aria-hidden="true"
              className="text-sm text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-neutral-600"
            >
              ↗
            </span>
          </a>
          <p className="mt-0.5 text-sm text-neutral-400 dark:text-neutral-500">
            {formatRelativeTime(label.createdAt)}
          </p>
        </div>
      </div>
      <PostText authorDid={label.authorDid} uri={label.uri} />
    </div>
  );
}

const MAX_LABELS = 100;

export function RecentLabels({
  domain,
  onClearFilter,
}: {
  domain?: string;
  onClearFilter: () => void;
}) {
  const query = useInfiniteQuery(labelsQueryOptions(domain));
  const allLabels = query.data?.pages.flatMap((p) => p.labels) ?? [];
  const atLimit = allLabels.length >= MAX_LABELS;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
          Recently labeled posts
        </p>
        {domain && (
          <button
            type="button"
            onClick={onClearFilter}
            className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60"
          >
            {domain}
            <span aria-hidden="true">&times;</span>
          </button>
        )}
      </div>

      {query.isPending && (
        <div className="space-y-4 py-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="h-3 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      )}

      {query.isSuccess && allLabels.length === 0 && (
        <div className="flex h-32 items-center justify-center text-neutral-400 dark:text-neutral-500">
          {domain ? `No posts labeled for ${domain}` : "No posts labeled yet"}
        </div>
      )}

      {allLabels.length > 0 && (
        <div className="divide-y divide-neutral-100 dark:divide-neutral-700">
          {allLabels.map((label) => (
            <LabelRow key={label.uri} label={label} />
          ))}
        </div>
      )}

      {query.hasNextPage && !atLimit && (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="mt-4 w-full rounded-lg bg-neutral-100 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-200 disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
        >
          {query.isFetchingNextPage ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";

import { LiveStats } from "../components/LiveStats.js";

export function Home() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-4xl font-bold tracking-tight">Paywall Radar</h1>
      <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-300">
        A Bluesky labeler that warns you when posts link to paywalled content. Subscribe to see
        paywall indicators on posts in your feed.
      </p>

      <div className="mt-8 flex flex-wrap gap-4">
        <a
          href="https://bsky.app/profile/paywall-radar.bsky.social"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
        >
          Subscribe on Bluesky
        </a>
        <Link
          to="/dashboard"
          className="rounded-lg border border-neutral-300 px-6 py-3 font-medium text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          View Dashboard
        </Link>
      </div>

      <div className="mt-12">
        <LiveStats />
      </div>

      <Link
        to="/login"
        className="mt-10 inline-block text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      >
        Domain administration
      </Link>
    </main>
  );
}

import { Link } from "@tanstack/react-router";

import { LiveStats } from "../components/LiveStats.js";

const blueskyProfileUrl = "https://bsky.app/profile/paywall-radar.bsky.social";

function ScreenshotPlaceholder() {
  return (
    <figure>
      <div className="flex aspect-4/3 items-center justify-center rounded-xl border border-neutral-300 bg-neutral-100 p-8 dark:border-neutral-700 dark:bg-neutral-900">
          <img src="/example.jpeg" />
        {/* <div className="max-w-xs text-center">
          <p className="font-medium text-neutral-700 dark:text-neutral-200">
            Bluesky screenshot goes here
          </p>
          <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            Use a post from your own account that shows the Paywall label.
          </p>
        </div> */}
      </div>
      <figcaption className="sr-only mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        Paywall Radar adds a small notice to matching posts.
      </figcaption>
    </figure>
  );
}

export function Home() {
  return (
    <main>
      <header className="mx-auto max-w-6xl px-6 py-6">
        <a href="/" className="font-semibold tracking-tight">
          Paywall Radar
        </a>
      </header>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-14 md:grid-cols-2 md:items-center md:gap-16 md:pb-28 md:pt-20">
        <div>
          <h1 className="max-w-lg text-5xl font-semibold tracking-[-0.045em] text-balance sm:text-6xl">
            Know when a link is paywalled before you open it.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-8 text-neutral-600 dark:text-neutral-300">
            Paywall Radar adds a label to paywalled links in your Bluesky feed.
          </p>
          <a
            href={blueskyProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          >
            Subscribe on Bluesky
          </a>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            It’s free, and it doesn’t hide or block posts.
          </p>
        </div>

        <ScreenshotPlaceholder />
      </section>

      <section className="border-y border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">How to subscribe</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-12">
            <li>
              <p className="text-sm text-neutral-400">01</p>
              <p className="mt-2 font-medium">
                <a
                  href={blueskyProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-neutral-300 underline-offset-4 hover:text-blue-600 dark:decoration-neutral-700 dark:hover:text-blue-400"
                >
                  Open Paywall Radar in Bluesky.
                </a>
              </p>
            </li>
            <li>
              <p className="text-sm text-neutral-400">02</p>
              <p className="mt-2 font-medium">Tap “Subscribe to Labeler.”</p>
            </li>
            <li>
              <p className="text-sm text-neutral-400">03</p>
              <p className="mt-2 font-medium">That’s it. The labels will appear in your feed.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
        <h2 className="text-2xl font-semibold tracking-tight">Live activity</h2>
        <div className="mt-7">
          <LiveStats />
        </div>
        <Link
          to="/dashboard"
          className="mt-7 inline-block text-sm text-neutral-600 underline decoration-neutral-300 underline-offset-4 hover:text-neutral-950 dark:text-neutral-300 dark:decoration-neutral-700 dark:hover:text-white"
        >
          See what it’s finding
        </Link>
      </section>

      <section className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <h2 className="text-2xl font-semibold tracking-tight">A few details</h2>
          <div className="mt-8 grid gap-x-12 gap-y-10 md:grid-cols-3">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
                Does it block posts?
              </h3>
              <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                No. It adds a notice and leaves the choice to you.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
                Does it cost anything?
              </h3>
              <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">No.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-neutral-950 dark:text-white">
                Which sites does it detect?
              </h3>
              <p className="mt-3 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
                The list covers major paywalled publications and changes over time.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-8 text-sm text-neutral-500 dark:text-neutral-400">
          <p>Paywall Radar</p>
          <div className="flex gap-5">
            <Link to="/dashboard" className="hover:text-neutral-950 dark:hover:text-white">
              Dashboard
            </Link>
            <a
              href="https://github.com/Tyson910/paywall-radar"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-neutral-950 dark:hover:text-white"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

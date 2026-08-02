import { Link } from "@tanstack/react-router";

import { LiveStats } from "../components/LiveStats.js";

const blueskyProfileUrl = "https://bsky.app/profile/paywall-radar.bsky.social";
// const makerProfileUrl = "https://bsky.app/profile/tysons.bsky.social";

function RadarMark() {
  return (
    <svg
      aria-hidden="true"
      className="h-8 w-8 -rotate-3 text-blue-600"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M28.6 28.2A14.2 14.2 0 1 1 31.7 13"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M24.5 24.8a9.3 9.3 0 1 1 2.1-12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".45"
      />
      <text
        x="17.6"
        y="21.5"
        fill="currentColor"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontSize="11"
        fontWeight="650"
        textAnchor="middle"
      >
        @
      </text>
      <path d="m25.8 10.2 4.4-4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Home() {
  return (
    <main className="home-page min-h-screen">
      <div className="home-shell">
        <header className="flex items-center justify-between py-6 sm:py-8">
          <a href="/" className="flex items-center gap-2.5" aria-label="Paywall Radar home">
            <RadarMark />
            <span className="text-sm font-semibold tracking-[-0.01em] text-stone-900">
              Paywall Radar
            </span>
          </a>
        </header>

        <section className="pb-10 pt-14 sm:pb-12 sm:pt-20">
          <h1 className="max-w-4xl text-[2.65rem] font-semibold leading-[1.06] tracking-[-0.045em] text-stone-950 sm:text-[3.8rem]">
            See the paywall before you click.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600">
            Paywall Radar adds a small label to paywalled links in your Bluesky feed. It won’t hide
            the post or stop you from opening it.
          </p>
          <a
            href={blueskyProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="subscribe-link mt-7 inline-flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-[15px] font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          >
            Subscribe on Bluesky
            <span aria-hidden="true">↗</span>
          </a>
        </section>

        <figure>
          <img
            src="/example.jpeg"
            alt="A Bluesky post with a Paywall label above a New York Times Cooking link"
            className="block h-auto w-full rounded-lg border border-stone-200 bg-white"
          />
          <figcaption className="mt-3 text-sm leading-6 text-stone-500">
            The label sits above the post, where you can notice it without it getting in the way.
          </figcaption>
        </figure>

        <section className="content-section">
          <h2 className="section-heading">How to turn it on</h2>
          <ol className="mt-5 space-y-3 text-[15px] leading-7 text-stone-700">
            <li className="flex gap-3">
              <span className="step-number">1.</span>
              <span>
                Open{" "}
                <a
                  href={blueskyProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="quiet-link font-medium text-stone-900"
                >
                  Paywall Radar on Bluesky
                </a>
                .
              </span>
            </li>
            <li className="flex gap-3">
              <span className="step-number">2.</span>
              <span>
                Choose <strong className="font-medium text-stone-900">Subscribe to Labeler</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="step-number">3.</span>
              <span>That’s it. Labels will start showing up in your feed.</span>
            </li>
          </ol>
        </section>

        <section className="content-section">
          <LiveStats />
        </section>

        <section className="content-section space-y-4 text-[15px] leading-7 text-stone-600">
          <p className="max-w-2xl">
            I made Paywall Radar because I kept opening links without realizing they were paywalled.
            Paywalls help fund journalism; this is just a little more context before you click.
          </p>

        </section>

        <footer className="mt-16 flex items-center justify-between border-t border-stone-200 py-7 text-sm text-stone-500 sm:mt-24">
          <span>Paywall Radar</span>
          <div className="flex gap-5">
            <Link to="/dashboard" className="quiet-link">
              Dashboard
            </Link>
            <a
              href="https://github.com/Tyson910/paywall-radar"
              target="_blank"
              rel="noopener noreferrer"
              className="quiet-link"
            >
              Source
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}

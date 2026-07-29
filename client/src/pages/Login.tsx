import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";

import { apiErrorMessage, beginLogin, sessionQueryOptions } from "../api.js";

const errorMessages: Record<string, string> = {
  unauthorized: "That account is not authorized to manage domains.",
  login_failed: "Login failed. Please try again.",
};

export function Login() {
  const { error } = useSearch({ from: "/login" });
  const session = useQuery(sessionQueryOptions());
  const [username, setUsername] = useState("");
  const login = useMutation({
    mutationFn: () => beginLogin(`${username.trim().toLowerCase()}.bsky.social`),
    onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
  });

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-800">
        ← Paywall Radar
      </Link>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Admin login</h1>
      <p className="mt-3 text-neutral-600 dark:text-neutral-300">
        Sign in with the Bluesky account authorized to manage monitored domains.
      </p>

      {error && (
        <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">
          {errorMessages[error] ?? "Login failed."}
        </p>
      )}

      {session.data?.authenticated ? (
        <Link
          to="/admin/domains"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
        >
          Manage domains
        </Link>
      ) : (
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            login.mutate();
          }}
        >
          <label className="block">
            <span className="text-sm font-medium">Bluesky username</span>
            <span className="mt-2 flex overflow-hidden rounded-lg border border-neutral-300 bg-white focus-within:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900">
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                pattern="[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
                maxLength={63}
                required
                className="min-w-0 flex-1 bg-transparent px-4 py-3 outline-none"
              />
              <span className="flex items-center border-l border-neutral-200 bg-neutral-50 px-3 text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800">
                .bsky.social
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {login.isPending ? "Redirecting…" : "Continue with Bluesky"}
          </button>
          {login.isError && (
            <p className="text-sm text-red-600">{apiErrorMessage(login.error, "Login failed")}</p>
          )}
        </form>
      )}
    </main>
  );
}

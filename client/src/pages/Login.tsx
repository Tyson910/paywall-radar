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
  const [handle, setHandle] = useState("");
  const login = useMutation({
    mutationFn: () => beginLogin(handle),
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
            <span className="text-sm font-medium">Bluesky handle</span>
            <input
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              placeholder="you.bsky.social"
              autoComplete="username"
              required
              className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 outline-none focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
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

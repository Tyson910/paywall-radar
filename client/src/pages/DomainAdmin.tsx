import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  addDomain as addDomainRequest,
  apiErrorMessage,
  adminDomainsQueryOptions,
  deleteDomain as deleteDomainRequest,
  logout as logoutRequest,
  pollSelfPosts,
  republishLabel as republishLabelRequest,
  sessionQueryOptions,
} from "../api.js";

export function DomainAdmin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const domains = useQuery(adminDomainsQueryOptions());
  const [pattern, setPattern] = useState("");
  const [labelUri, setLabelUri] = useState("");

  const refreshDomains = async () => {
    await queryClient.invalidateQueries({ queryKey: adminDomainsQueryOptions().queryKey });
  };

  const addDomain = useMutation({
    mutationFn: addDomainRequest,
    onSuccess: async () => {
      setPattern("");
      await refreshDomains();
    },
  });
  const deleteDomain = useMutation({
    mutationFn: deleteDomainRequest,
    onSuccess: refreshDomains,
  });
  const logout = useMutation({
    mutationFn: logoutRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sessionQueryOptions().queryKey });
      await navigate({ to: "/login" });
    },
  });
  const poll = useMutation({ mutationFn: pollSelfPosts });
  const republish = useMutation({
    mutationFn: republishLabelRequest,
    onSuccess: () => setLabelUri(""),
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-800">
            Paywall Radar
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Monitored domains</h1>
        </div>
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
        >
          Log out
        </button>
      </div>

      <form
        className="mt-8 flex gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          addDomain.mutate(pattern);
        }}
      >
        <input
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
          placeholder="example.com or *.example.com"
          required
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={addDomain.isPending}
          className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-60"
        >
          Add
        </button>
      </form>

      {(addDomain.isError || deleteDomain.isError) && (
        <p className="mt-3 text-sm text-red-600">
          {apiErrorMessage(addDomain.error ?? deleteDomain.error, "Domain update failed")}
        </p>
      )}

      <div className="mt-8 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        {domains.data?.map((domain) => (
          <div
            key={domain.pattern}
            className="flex items-center justify-between gap-4 border-b border-neutral-200 px-4 py-3 last:border-b-0 dark:border-neutral-800"
          >
            <code className="text-sm">{domain.pattern}</code>
            <button
              type="button"
              onClick={() => deleteDomain.mutate(domain.pattern)}
              disabled={deleteDomain.isPending}
              className="text-sm font-medium text-red-600 hover:text-red-800 disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        ))}
        {domains.isPending && <p className="p-4 text-neutral-500">Loading domains…</p>}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Self-post labeling</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Check the labeler account's recent posts and label any with paywall links.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => poll.mutate()}
            disabled={poll.isPending}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-60"
          >
            {poll.isPending ? "Checking…" : "Poll now"}
          </button>
          {poll.isSuccess && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              {poll.data.posts} posts checked, {poll.data.labeled} newly labeled
            </p>
          )}
          {poll.isError && (
            <p className="text-sm text-red-600">{apiErrorMessage(poll.error, "Poll failed")}</p>
          )}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold">Republish a label</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Re-sign an existing label and append it at a new publication sequence.
        </p>
        <form
          className="mt-3 flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            republish.mutate(labelUri);
          }}
        >
          <input
            value={labelUri}
            onChange={(event) => setLabelUri(event.target.value)}
            placeholder="at://did:plc:…/app.bsky.feed.post/…"
            required
            className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            disabled={republish.isPending}
            className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white disabled:opacity-60"
          >
            {republish.isPending ? "Republishing…" : "Republish"}
          </button>
        </form>
        {republish.isSuccess && (
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
            Published at sequence {republish.data.seq}
          </p>
        )}
        {republish.isError && (
          <p className="mt-3 text-sm text-red-600">
            {apiErrorMessage(republish.error, "Republish failed")}
          </p>
        )}
      </div>
    </main>
  );
}

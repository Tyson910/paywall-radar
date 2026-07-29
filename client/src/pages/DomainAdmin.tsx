import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import {
  addDomain as addDomainRequest,
  apiErrorMessage,
  adminDomainsQueryOptions,
  deleteDomain as deleteDomainRequest,
  logout as logoutRequest,
  sessionQueryOptions,
} from "../api.js";

export function DomainAdmin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const domains = useQuery(adminDomainsQueryOptions());
  const [pattern, setPattern] = useState("");

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
    </main>
  );
}

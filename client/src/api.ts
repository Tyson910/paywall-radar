import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { hc } from "hono/client";

import type { DashboardRoutes } from "#server/routes.js";

const client = hc<DashboardRoutes>("/api");

export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard"] as const,
    queryFn: async () => {
      const res = await client.dashboard.$get();
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      return res.json();
    },
    staleTime: 10_000,
  });
}

export function domainsQueryOptions() {
  return queryOptions({
    queryKey: ["domains"] as const,
    queryFn: async () => {
      const res = await client.domains.$get();
      if (!res.ok) throw new Error("Failed to fetch domains");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function labelsQueryOptions(domain?: string) {
  return infiniteQueryOptions({
    queryKey: ["labels", { domain }] as const,
    queryFn: async ({ pageParam }) => {
      const res = await client.labels.$get({
        query: {
          ...(pageParam ? { cursor: String(pageParam) } : {}),
          ...(domain ? { domain } : {}),
        },
      });
      if (!res.ok) throw new Error("Failed to fetch labels");
      return res.json();
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 10_000,
  });
}

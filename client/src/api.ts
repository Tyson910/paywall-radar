import { queryOptions } from "@tanstack/react-query";
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

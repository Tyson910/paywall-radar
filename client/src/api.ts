import { queryOptions } from "@tanstack/react-query";

import type { DashboardSnapshot } from "#shared/schemas.js";

export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard"] as const,
    queryFn: async (): Promise<DashboardSnapshot> => {
      const response = await fetch("/api/dashboard");
      if (!response.ok) throw new Error("Failed to fetch dashboard data");
      return response.json() as Promise<DashboardSnapshot>;
    },
    staleTime: 10_000,
  });
}

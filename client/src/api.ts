import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { DetailedError, hc, parseResponse } from "hono/client";

import type { AdminRoutes } from "#server/admin-routes.js";
import type { AuthRoutes } from "#server/auth-routes.js";
import type { DashboardRoutes } from "#server/routes.js";

const dashboardClient = hc<DashboardRoutes>("/api");
const authClient = hc<AuthRoutes>("/");
const adminClient = hc<AdminRoutes>("/api/admin");

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DetailedError) {
    const detail: unknown = error.detail;
    const data =
      typeof detail === "object" && detail !== null && "data" in detail ? detail.data : undefined;
    if (typeof data === "object" && data && "error" in data && typeof data.error === "string") {
      return data.error;
    }
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function dashboardQueryOptions() {
  return queryOptions({
    queryKey: ["dashboard"] as const,
    queryFn: () => parseResponse(dashboardClient.dashboard.$get()),
    staleTime: 10_000,
  });
}

export function domainsQueryOptions() {
  return queryOptions({
    queryKey: ["domains"] as const,
    queryFn: () => parseResponse(dashboardClient.domains.$get()),
    staleTime: 60_000,
  });
}

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: ["session"] as const,
    queryFn: () => parseResponse(authClient.api.session.$get()),
    staleTime: 30_000,
  });
}

export function adminDomainsQueryOptions() {
  return queryOptions({
    queryKey: ["admin", "domains"] as const,
    queryFn: () => parseResponse(adminClient.domains.$get()),
  });
}

export function labelsQueryOptions(domain?: string) {
  return infiniteQueryOptions({
    queryKey: ["labels", { domain }] as const,
    queryFn: async ({ pageParam }: { pageParam: number | undefined }) => {
      return parseResponse(
        dashboardClient.labels.$get({
          query: {
            ...(pageParam ? { cursor: String(pageParam) } : {}),
            ...(domain ? { domain } : {}),
          },
        }),
      );
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 10_000,
  });
}

export function beginLogin(handle: string) {
  return parseResponse(authClient.oauth.login.$post({ json: { handle } }));
}

export function logout() {
  return parseResponse(authClient.oauth.logout.$post());
}

export function addDomain(pattern: string) {
  return parseResponse(adminClient.domains.$post({ json: { pattern } }));
}

export function deleteDomain(pattern: string) {
  return parseResponse(adminClient.domains.$delete({ json: { pattern } }));
}

export function pollSelfPosts() {
  return parseResponse(adminClient["poll-self-posts"].$post());
}

export function republishLabel(uri: string) {
  return parseResponse(adminClient.labels.republish.$post({ json: { uri } }));
}

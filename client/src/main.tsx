import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
  RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./app.css";
import { adminDomainsQueryOptions, sessionQueryOptions } from "./api.js";
import { Home } from "./pages/Home.js";
import { Login } from "./pages/Login.js";

const queryClient = new QueryClient();

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/dashboard",
  validateSearch: (search: Record<string, unknown>): { domain?: string } => {
    return typeof search.domain === "string" ? { domain: search.domain } : {};
  },
  component: lazyRouteComponent(() => import("./pages/Dashboard.js"), "Dashboard"),
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  validateSearch: (search: Record<string, unknown>): { error?: string } => {
    return typeof search.error === "string" ? { error: search.error } : {};
  },
  component: Login,
});

const adminDomainsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin/domains",
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions());
    if (!session.authenticated) throw redirect({ to: "/login" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(adminDomainsQueryOptions()),
  component: lazyRouteComponent(() => import("./pages/DomainAdmin.js"), "DomainAdmin"),
});

const routeTree = rootRoute.addChildren([homeRoute, dashboardRoute, loginRoute, adminDomainsRoute]);
const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

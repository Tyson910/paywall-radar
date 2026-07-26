import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

import "./app.css";
import { LiveStats } from "./components/LiveStats.js";
import { Skeleton } from "./components/Skeleton.js";
import { SuspenseSkeleton } from "./components/SuspenseSkeleton.js";

const Dashboard = lazy(() =>
  import("./pages/Dashboard.js").then((m) => ({ default: m.Dashboard })),
);

const queryClient = new QueryClient();

const statsRoot = document.getElementById("live-stats");
if (statsRoot) {
  createRoot(statsRoot).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <LiveStats />
      </QueryClientProvider>
    </StrictMode>,
  );
}

const appRoot = document.getElementById("root")!;
if (window.location.pathname === "/dashboard") {
  createRoot(appRoot).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Suspense
          fallback={
            <SuspenseSkeleton>
              <div className="mx-auto max-w-4xl space-y-4 px-6 py-10">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </SuspenseSkeleton>
          }
        >
          <Dashboard />
        </Suspense>
      </QueryClientProvider>
    </StrictMode>,
  );
}

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

const isDashboard = window.location.pathname === "/dashboard";

const statsRoot = document.getElementById("live-stats");
if (statsRoot && !isDashboard) {
  createRoot(statsRoot).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <LiveStats />
      </QueryClientProvider>
    </StrictMode>,
  );
}

const appRoot = document.getElementById("root")!;
if (isDashboard) {
  const homepageContent = document.querySelector(".mx-auto.max-w-2xl");
  if (homepageContent instanceof HTMLElement) homepageContent.style.display = "none";

  createRoot(appRoot).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Suspense
          fallback={
            <SuspenseSkeleton>
              <div className="min-h-screen bg-neutral-100 p-5 dark:bg-neutral-900">
                <div className="mx-auto max-w-7xl">
                  <Skeleton className="mb-5 h-4 w-40 rounded-2xl" />
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-32 rounded-2xl lg:col-span-2 lg:row-span-2" />
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-32 rounded-2xl" />
                    <Skeleton className="h-40 rounded-2xl lg:col-span-3" />
                    <Skeleton className="h-40 rounded-2xl" />
                  </div>
                </div>
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

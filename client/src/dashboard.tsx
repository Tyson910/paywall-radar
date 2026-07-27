import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";

import "./app.css";
import { Skeleton } from "./components/Skeleton.js";
import { SuspenseSkeleton } from "./components/SuspenseSkeleton.js";

const Dashboard = lazy(() =>
  import("./pages/Dashboard.js").then((m) => ({ default: m.Dashboard })),
);

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense
        fallback={
          <SuspenseSkeleton>
            <div className="min-h-screen p-5">
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

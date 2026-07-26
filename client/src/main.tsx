import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./app.css";
import { LiveStats } from "./components/LiveStats.js";
import { Dashboard } from "./pages/Dashboard.js";

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
        <Dashboard />
      </QueryClientProvider>
    </StrictMode>,
  );
}

import { Hono } from "hono";

import type { Database } from "./database/connection.js";
import { getDashboardSnapshot } from "./database/stats.js";

export function createDashboardRoutes(db: Database) {
  return new Hono().get("/dashboard", async (c) => {
    return c.json(await getDashboardSnapshot(db));
  });
}

export type DashboardRoutes = ReturnType<typeof createDashboardRoutes>;

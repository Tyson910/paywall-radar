import { Hono } from "hono";

import type { Database } from "./database/connection.js";

import {
  getDashboardSnapshot,
  getMonitoredDomains,
  getRecentLabelsPage,
} from "./database/stats.js";

export function createDashboardRoutes(db: Database) {
  return new Hono()
    .get("/dashboard", async (c) => {
      return c.json(await getDashboardSnapshot(db));
    })
    .get("/domains", async (c) => {
      return c.json(await getMonitoredDomains(db));
    })
    .get("/labels", async (c) => {
      const cursorParam = c.req.query("cursor");
      const domain = c.req.query("domain");
      const opts: { cursor?: number; domain?: string } = {};
      if (cursorParam) opts.cursor = Number(cursorParam);
      if (domain) opts.domain = domain;
      return c.json(await getRecentLabelsPage(db, opts));
    });
}

export type DashboardRoutes = ReturnType<typeof createDashboardRoutes>;

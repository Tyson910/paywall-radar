import type { LabelerServer } from "@skyware/labeler";

import type { Database } from "./database/connection.js";
import { getDashboardSnapshot } from "./database/stats.js";

export function registerDashboardRoutes(labeler: LabelerServer, db: Database): void {
  labeler.app.get("/api/dashboard", async () => {
    return getDashboardSnapshot(db);
  });
}

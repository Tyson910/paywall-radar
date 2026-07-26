import { existsSync } from "node:fs";
import { resolve } from "node:path";

import fastifyStatic from "@fastify/static";
import type { LabelerServer } from "@skyware/labeler";

import type { Database } from "./database/connection.js";
import { getDashboardSnapshot } from "./database/stats.js";

export function registerDashboardRoutes(labeler: LabelerServer, db: Database): void {
  labeler.app.get("/api/dashboard", async () => {
    return getDashboardSnapshot(db);
  });
}

export async function registerStaticFiles(
  labeler: LabelerServer,
  clientDir: string,
): Promise<void> {
  const root = resolve(clientDir);

  if (!existsSync(root)) {
    console.warn(`Static file directory not found: ${root} — skipping static serving`);
    return;
  }

  await labeler.app.register(fastifyStatic, {
    root,
    wildcard: false,
  });

  labeler.app.setNotFoundHandler((_request, reply) => {
    return reply.sendFile("index.html");
  });
}

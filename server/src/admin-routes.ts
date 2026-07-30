import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { AuthService } from "./auth.js";
import type { Database } from "./database/connection.js";
import type { DomainPattern } from "./domains.js";

import { audit } from "./audit.js";
import { getAuthenticatedDid, trustedOrigin } from "./auth-routes.js";
import { addDomain, removeDomain } from "./database/domains.js";
import { loadDomainPatterns } from "./database/state.js";
import { getMonitoredDomains } from "./database/stats.js";
import { parseDomainPattern } from "./domains.js";

const domainPatternSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .refine((value) => {
    try {
      parseDomainPattern(value);
      return true;
    } catch {
      return false;
    }
  })
  .transform(parseDomainPattern);
const domainInputSchema = z.object({ pattern: domainPatternSchema });
const validateDomainInput = sValidator("json", domainInputSchema, (result, c) => {
  if (!result.success) return c.json({ error: "Invalid domain pattern" }, 400);
});

async function refreshPatterns(db: Database, patterns: DomainPattern[]): Promise<void> {
  patterns.splice(0, patterns.length, ...(await loadDomainPatterns(db)));
}

export function createAdminRoutes(db: Database, auth: AuthService, patterns: DomainPattern[]) {
  const routes = new Hono();

  routes.use("*", async (c, next) => {
    if (!(await getAuthenticatedDid(c, auth))) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  return routes
    .get("/domains", async (c) => c.json(await getMonitoredDomains(db)))
    .post("/domains", trustedOrigin(auth.publicUrl), validateDomainInput, async (c) => {
      const input = c.req.valid("json");
      const row = await addDomain(db, input.pattern);
      await refreshPatterns(db, patterns);
      audit(row ? "domain.created" : "domain.already_exists", {
        actor: auth.adminDid,
        pattern: input.pattern,
      });
      return c.json(
        { domain: row ?? { pattern: input.pattern }, created: row != null },
        row ? 201 : 200,
      );
    })
    .delete("/domains", trustedOrigin(auth.publicUrl), validateDomainInput, async (c) => {
      const input = c.req.valid("json");
      const row = await removeDomain(db, input.pattern);
      await refreshPatterns(db, patterns);
      if (!row) {
        audit("domain.delete_not_found", { actor: auth.adminDid, pattern: input.pattern });
        return c.json({ error: "Domain pattern not found" }, 404);
      }
      audit("domain.deleted", { actor: auth.adminDid, pattern: input.pattern });
      return c.json({ success: true });
    });
}

export type AdminRoutes = ReturnType<typeof createAdminRoutes>;

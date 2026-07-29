import type { Context } from "hono";

import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import { z } from "zod";

import type { AuthService } from "./auth.js";

const SESSION_COOKIE = "paywall_radar_session";
const loginSchema = z.object({ handle: z.string().trim().min(1).max(253) });
const validateLogin = sValidator("json", loginSchema, (result, c) => {
  if (!result.success) return c.json({ error: "A valid handle is required" }, 400);
});

function cookieOptions(auth: AuthService) {
  return {
    httpOnly: true,
    secure: auth.secureCookies,
    sameSite: "Lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  } as const;
}

export async function getAuthenticatedDid(c: Context, auth: AuthService): Promise<string | null> {
  const value = await getSignedAdminDid(c, auth);
  if (!value) return null;

  try {
    await auth.restore(value);
    return value;
  } catch {
    return null;
  }
}

async function getSignedAdminDid(c: Context, auth: AuthService): Promise<string | null> {
  const value = await getSignedCookie(c, auth.sessionSecret, SESSION_COOKIE);
  if (typeof value !== "string" || value !== auth.adminDid) return null;
  return value;
}

export function createAuthRoutes(auth: AuthService) {
  return new Hono()
    .get("/oauth/client-metadata.json", (c) => c.json(auth.clientMetadata))
    .get("/.well-known/jwks.json", (c) => c.json(auth.jwks))
    .post("/oauth/login", csrf(), validateLogin, async (c) => {
      const redirectUrl = await auth.authorize(c.req.valid("json").handle);
      return c.json({ redirectUrl: redirectUrl.toString() });
    })
    .get("/oauth/callback", async (c) => {
      try {
        const did = await auth.callback(new URL(c.req.url).searchParams);
        if (did !== auth.adminDid) {
          await auth.revoke(did);
          return c.redirect("/login?error=unauthorized");
        }

        await setSignedCookie(c, SESSION_COOKIE, did, auth.sessionSecret, cookieOptions(auth));
        return c.redirect("/admin/domains");
      } catch {
        return c.redirect("/login?error=login_failed");
      }
    })
    .post("/oauth/logout", csrf(), async (c) => {
      const did = await getSignedAdminDid(c, auth);
      if (did) await auth.revoke(did).catch(() => undefined);
      deleteCookie(c, SESSION_COOKIE, cookieOptions(auth));
      return c.json({ success: true });
    })
    .get("/api/session", async (c) => {
      const did = await getAuthenticatedDid(c, auth);
      return c.json({ authenticated: did != null, did });
    });
}

export type AuthRoutes = ReturnType<typeof createAuthRoutes>;

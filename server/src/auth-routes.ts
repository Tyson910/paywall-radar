import type { Context, MiddlewareHandler } from "hono";

import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import { z } from "zod";

import type { AuthService } from "./auth.js";

import { audit } from "./audit.js";

const SESSION_COOKIE = "paywall_radar_session";
const SECURE_SESSION_COOKIE = "__Host-paywall_radar_session";
const loginSchema = z.object({ handle: z.string().trim().min(1).max(253) });
const validateLogin = sValidator("json", loginSchema, (result, c) => {
  if (!result.success) return c.json({ error: "A valid handle is required" }, 400);
});

export function trustedOrigin(origin: string): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.header("origin") !== origin) return c.text("Forbidden", 403);
    await next();
  };
}

function cookieOptions(auth: AuthService) {
  return {
    httpOnly: true,
    secure: auth.secureCookies,
    sameSite: "Lax" as const,
    path: "/",
    maxAge: auth.sessionMaxAge,
  } as const;
}

function sessionCookieName(auth: AuthService): string {
  return auth.secureCookies ? SECURE_SESSION_COOKIE : SESSION_COOKIE;
}

export async function getAuthenticatedDid(c: Context, auth: AuthService): Promise<string | null> {
  const token = await getSignedSessionToken(c, auth);
  if (!token) return null;

  try {
    return (await auth.restoreSession(token)) ? auth.adminDid : null;
  } catch {
    return null;
  }
}

async function getSignedSessionToken(c: Context, auth: AuthService): Promise<string | null> {
  const value = await getSignedCookie(c, auth.sessionSecret, sessionCookieName(auth));
  if (typeof value !== "string") return null;
  return value;
}

export function createAuthRoutes(auth: AuthService) {
  return new Hono()
    .get("/oauth/client-metadata.json", (c) => c.json(auth.clientMetadata))
    .get("/.well-known/jwks.json", (c) => c.json(auth.jwks))
    .post("/oauth/login", trustedOrigin(auth.publicUrl), validateLogin, async (c) => {
      const { handle } = c.req.valid("json");
      audit("oauth.login.started", { handle });
      const redirectUrl = await auth.authorize(handle);
      return c.json({ redirectUrl: redirectUrl.toString() });
    })
    .get("/oauth/callback", async (c) => {
      try {
        const did = await auth.callback(new URL(c.req.url).searchParams);
        if (did !== auth.adminDid) {
          await auth.revoke(did);
          audit("oauth.login.denied", { did });
          return c.redirect("/login?error=unauthorized");
        }

        const token = await auth.createSession();
        await setSignedCookie(
          c,
          sessionCookieName(auth),
          token,
          auth.sessionSecret,
          cookieOptions(auth),
        );
        audit("oauth.login.succeeded", { did });
        return c.redirect("/admin/domains");
      } catch (error) {
        audit("oauth.login.failed", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return c.redirect("/login?error=login_failed");
      }
    })
    .post("/oauth/logout", trustedOrigin(auth.publicUrl), async (c) => {
      const token = await getSignedSessionToken(c, auth);
      if (token) await auth.clearSession(token);
      let revoked = true;
      if (token) {
        try {
          await auth.revoke(auth.adminDid);
        } catch (error) {
          revoked = false;
          audit("oauth.logout.revocation_failed", {
            did: auth.adminDid,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
      deleteCookie(c, sessionCookieName(auth), cookieOptions(auth));
      audit("oauth.logout.succeeded", { did: auth.adminDid, revoked });
      return c.json({ success: true });
    })
    .get("/api/session", async (c) => {
      const did = await getAuthenticatedDid(c, auth);
      return c.json({ authenticated: did != null });
    });
}

export type AuthRoutes = ReturnType<typeof createAuthRoutes>;

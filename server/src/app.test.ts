import { generateKeyPairSync } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { Client } from "@libsql/client";

import { generateSignedCookie } from "hono/cookie";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AuthService } from "./auth.js";
import type { Database } from "./database/connection.js";

import { createApp } from "./app.js";
import { createAuthService } from "./auth.js";
import { openDatabase } from "./database/connection.js";
import { initializeDatabase } from "./database/initialize.js";
import { loadDomainPatterns } from "./database/state.js";
import { LabelStream } from "./label-stream.js";

let directory: string;
let client: Client;
let db: Database;
let testClientMetadata: AuthService["clientMetadata"];

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "paywall-radar-app-"));
  const databasePath = join(directory, "test.db");
  await initializeDatabase(databasePath);
  ({ client, db } = openDatabase(databasePath));
  testClientMetadata = (
    await createAuthService(db, {
      adminDid: "did:plc:admin",
      publicUrl: "http://127.0.0.1:4100",
      sessionSecret: "a-secure-session-secret-that-is-long-enough",
    })
  ).clientMetadata;
});

afterAll(async () => {
  client.close();
  await rm(directory, { force: true, recursive: true });
});

describe("createApp", () => {
  it("serves routes without starting the process runtime", async () => {
    const app = createApp({ db, labelStream: new LabelStream() });

    const healthResponse = await app.request("/xrpc/_health");
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.headers.get("x-content-type-options")).toBe("nosniff");
    expect(healthResponse.headers.get("x-frame-options")).toBe("DENY");
    expect(healthResponse.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(healthResponse.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'none'",
    );
    expect(healthResponse.headers.has("strict-transport-security")).toBe(false);
    await expect(healthResponse.json()).resolves.toEqual({ version: 1 });

    const dashboardResponse = await app.request("/api/dashboard");
    expect(dashboardResponse.status).toBe(200);
    await expect(dashboardResponse.json()).resolves.toMatchObject({
      stats: {
        postsScanned: 0,
        labelsEmitted: 0,
        lastEventAt: null,
      },
    });
  });

  it("serves the client entry for direct application routes", async () => {
    const clientDir = join(directory, "client");
    await mkdir(clientDir);
    await writeFile(join(clientDir, "index.html"), '<div id="root"></div>');
    const app = createApp({ db, labelStream: new LabelStream(), clientDir });

    const [homeResponse, dashboardResponse] = await Promise.all([
      app.request("/"),
      app.request("/dashboard"),
    ]);

    expect(homeResponse.status).toBe(200);
    expect(dashboardResponse.status).toBe(200);
    await expect(homeResponse.text()).resolves.toContain('id="root"');
    await expect(dashboardResponse.text()).resolves.toContain('id="root"');
  });

  it("restricts domain management to the authenticated admin and refreshes live patterns", async () => {
    const adminDid = "did:plc:admin";
    const sessionSecret = "a-secure-session-secret-that-is-long-enough";
    const auth: AuthService = {
      adminDid,
      clientMetadata: testClientMetadata,
      jwks: { keys: [] },
      publicUrl: "http://127.0.0.1:4100",
      sessionSecret,
      secureCookies: false,
      sessionMaxAge: 60 * 60 * 24,
      authorize: async () => new URL("https://example.com/authorize"),
      callback: async () => adminDid,
      createSession: async () => "session-token",
      restoreSession: async () => true,
      clearSession: async () => undefined,
      revoke: async () => undefined,
    };
    const patterns = await loadDomainPatterns(db);
    let republishedUri: string | undefined;
    const adminDeps = {
      db,
      auth,
      patterns,
      pollSelfPosts: async () => ({ posts: 0, labeled: 0 }),
      republishLabel: async (uri: string) => {
        republishedUri = uri;
        return { seq: 50_315 };
      },
    };
    const app = createApp({ db, labelStream: new LabelStream(), auth, adminDeps });

    const unauthorized = await app.request("/api/admin/domains");
    expect(unauthorized.status).toBe(401);
    expect((await app.request("/api/domains")).status).toBe(200);

    const cookie = await generateSignedCookie(
      "paywall_radar_session",
      "session-token",
      sessionSecret,
    );
    const headers = {
      Cookie: cookie,
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:4100",
    };
    const created = await app.request("/api/admin/domains", {
      method: "POST",
      headers,
      body: JSON.stringify({ pattern: "  *.Example.com " }),
    });
    expect(created.status).toBe(201);
    expect(patterns).toContain("*.example.com");

    const removed = await app.request("/api/admin/domains", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ pattern: "*.example.com" }),
    });
    expect(removed.status).toBe(200);
    expect(patterns).not.toContain("*.example.com");

    const labelUri = "at://did:plc:example/app.bsky.feed.post/abc123";
    const republished = await app.request("/api/admin/labels/republish", {
      method: "POST",
      headers,
      body: JSON.stringify({ uri: labelUri }),
    });
    expect(republished.status).toBe(200);
    await expect(republished.json()).resolves.toEqual({ seq: 50_315 });
    expect(republishedUri).toBe(labelUri);
  });

  it("sets an admin session after the OAuth callback", async () => {
    const adminDid = "did:plc:admin";
    const auth: AuthService = {
      adminDid,
      clientMetadata: testClientMetadata,
      jwks: { keys: [] },
      publicUrl: "http://127.0.0.1:4100",
      sessionSecret: "a-secure-session-secret-that-is-long-enough",
      secureCookies: false,
      sessionMaxAge: 60 * 60 * 24,
      authorize: async () => new URL("https://example.com/authorize"),
      callback: async () => adminDid,
      createSession: async () => "session-token",
      restoreSession: async () => true,
      clearSession: async () => undefined,
      revoke: async () => undefined,
    };
    const app = createApp({ db, labelStream: new LabelStream(), auth });

    const response = await app.request("/oauth/callback?code=test&state=test");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin/domains");
    expect(response.headers.get("set-cookie")).toContain("paywall_radar_session=");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=86400");
  });

  it("does not disclose the admin DID in the session response", async () => {
    const adminDid = "did:plc:admin";
    const sessionSecret = "a-secure-session-secret-that-is-long-enough";
    const auth: AuthService = {
      adminDid,
      clientMetadata: testClientMetadata,
      jwks: { keys: [] },
      publicUrl: "http://127.0.0.1:4100",
      sessionSecret,
      secureCookies: false,
      sessionMaxAge: 60 * 60 * 24,
      authorize: async () => new URL("https://example.com/authorize"),
      callback: async () => adminDid,
      createSession: async () => "session-token",
      restoreSession: async () => true,
      clearSession: async () => undefined,
      revoke: async () => undefined,
    };
    const app = createApp({ db, labelStream: new LabelStream(), auth });
    const cookie = await generateSignedCookie(
      "paywall_radar_session",
      "session-token",
      sessionSecret,
    );

    const response = await app.request("/api/session", { headers: { Cookie: cookie } });

    await expect(response.json()).resolves.toEqual({ authenticated: true });
  });

  it("rejects OAuth login requests from an untrusted origin", async () => {
    const auth: AuthService = {
      adminDid: "did:plc:admin",
      clientMetadata: testClientMetadata,
      jwks: { keys: [] },
      publicUrl: "https://paywall-radar.example",
      sessionSecret: "a-secure-session-secret-that-is-long-enough",
      secureCookies: true,
      sessionMaxAge: 60 * 60 * 24,
      authorize: async () => new URL("https://example.com/authorize"),
      callback: async () => "did:plc:admin",
      createSession: async () => "session-token",
      restoreSession: async () => true,
      clearSession: async () => undefined,
      revoke: async () => undefined,
    };
    const app = createApp({ db, labelStream: new LabelStream(), auth });

    const response = await app.request("/oauth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
      body: JSON.stringify({ handle: "admin.bsky.social" }),
    });

    expect(response.status).toBe(403);
  });

  it("configures loopback OAuth metadata for local development", async () => {
    const auth = await createAuthService(db, {
      adminDid: "did:plc:admin",
      publicUrl: "http://127.0.0.1:4100",
      sessionSecret: "a-secure-session-secret-that-is-long-enough",
    });
    const app = createApp({ db, labelStream: new LabelStream(), auth });

    const response = await app.request("/oauth/client-metadata.json");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      scope: "atproto",
      redirect_uris: ["http://127.0.0.1:4100/oauth/callback"],
    });
  });

  it("accepts a PKCS#8 PEM OAuth private key for production metadata", async () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const auth = await createAuthService(db, {
      adminDid: "did:plc:admin",
      publicUrl: "https://paywall-radar.example",
      sessionSecret: "a-secure-session-secret-that-is-long-enough",
      oauthPrivateKey: pem,
    });

    expect(auth.clientMetadata.token_endpoint_auth_method).toBe("private_key_jwt");
    expect(auth.jwks.keys).toHaveLength(1);
    expect(JSON.stringify(auth.jwks)).not.toContain('"d"');
  });

  it("rotates the opaque admin session token on each login", async () => {
    const auth = await createAuthService(db, {
      adminDid: "did:plc:admin",
      publicUrl: "http://127.0.0.1:4100",
      sessionSecret: "a-secure-session-secret-that-is-long-enough",
    });

    const previousToken = await auth.createSession();
    const currentToken = await auth.createSession();

    expect(currentToken).not.toBe(previousToken);
    await expect(auth.restoreSession(previousToken)).resolves.toBe(false);
  });
});

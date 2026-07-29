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

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "paywall-radar-app-"));
  const databasePath = join(directory, "test.db");
  await initializeDatabase(databasePath);
  ({ client, db } = openDatabase(databasePath));
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
      clientMetadata: {} as AuthService["clientMetadata"],
      jwks: { keys: [] },
      publicUrl: "http://127.0.0.1:4100",
      sessionSecret,
      secureCookies: false,
      authorize: async () => new URL("https://example.com/authorize"),
      callback: async () => adminDid,
      restore: async () => undefined,
      revoke: async () => undefined,
    };
    const patterns = await loadDomainPatterns(db);
    const app = createApp({ db, labelStream: new LabelStream(), auth, domainPatterns: patterns });

    const unauthorized = await app.request("/api/admin/domains");
    expect(unauthorized.status).toBe(401);
    expect((await app.request("/api/domains")).status).toBe(200);

    const cookie = await generateSignedCookie("paywall_radar_session", adminDid, sessionSecret);
    const headers = { Cookie: cookie, "Content-Type": "application/json" };
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
  });

  it("sets an admin session after the OAuth callback", async () => {
    const adminDid = "did:plc:admin";
    const auth: AuthService = {
      adminDid,
      clientMetadata: {} as AuthService["clientMetadata"],
      jwks: { keys: [] },
      publicUrl: "http://127.0.0.1:4100",
      sessionSecret: "a-secure-session-secret-that-is-long-enough",
      secureCookies: false,
      authorize: async () => new URL("https://example.com/authorize"),
      callback: async () => adminDid,
      restore: async () => undefined,
      revoke: async () => undefined,
    };
    const app = createApp({ db, labelStream: new LabelStream(), auth });

    const response = await app.request("/oauth/callback?code=test&state=test");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin/domains");
    expect(response.headers.get("set-cookie")).toContain("paywall_radar_session=");
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
});

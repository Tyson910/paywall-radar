import { createHash, randomBytes } from "node:crypto";

import { safeFetchWrap } from "@atproto-labs/fetch-node";
import {
  buildAtprotoLoopbackClientMetadata,
  JoseKey,
  NodeOAuthClient,
  oauthClientMetadataSchema,
  requestLocalLock,
} from "@atproto/oauth-client-node";
import { eq } from "drizzle-orm";

import type { Database } from "./database/connection.js";

import { adminSession } from "./database/models.js";
import { createOAuthStores } from "./database/oauth.js";

const APP_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface AuthService {
  readonly adminDid: string;
  readonly clientMetadata: NodeOAuthClient["clientMetadata"];
  readonly jwks: NodeOAuthClient["jwks"];
  readonly publicUrl: string;
  readonly sessionSecret: string;
  readonly secureCookies: boolean;
  readonly sessionMaxAge: number;
  authorize(handle: string): Promise<URL>;
  callback(params: URLSearchParams): Promise<string>;
  createSession(): Promise<string>;
  restoreSession(token: string): Promise<boolean>;
  clearSession(token: string): Promise<void>;
  revoke(did: string): Promise<void>;
}

export interface AuthOptions {
  adminDid: string;
  publicUrl: string;
  sessionSecret: string;
  oauthPrivateKey?: string;
}

export async function createAuthService(db: Database, options: AuthOptions): Promise<AuthService> {
  if (!options.adminDid.startsWith("did:")) {
    throw new Error("ADMIN_DID must be a DID");
  }
  if (options.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }

  const publicUrl = new URL(options.publicUrl);
  const callbackUrl = new URL("/oauth/callback", publicUrl).toString();
  const isLoopback = publicUrl.hostname === "127.0.0.1" || publicUrl.hostname === "[::1]";
  let keyset: JoseKey[] | undefined;

  const clientMetadata = isLoopback
    ? buildAtprotoLoopbackClientMetadata({
        scope: "atproto",
        redirect_uris: [callbackUrl],
      })
    : oauthClientMetadataSchema.parse({
        client_id: new URL("/oauth/client-metadata.json", publicUrl).toString(),
        client_name: "Paywall Radar",
        client_uri: publicUrl.toString(),
        redirect_uris: [callbackUrl],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        scope: "atproto",
        application_type: "web",
        token_endpoint_auth_method: "private_key_jwt",
        token_endpoint_auth_signing_alg: "ES256",
        jwks_uri: new URL("/.well-known/jwks.json", publicUrl).toString(),
        dpop_bound_access_tokens: true,
      });

  if (!isLoopback) {
    if (!options.oauthPrivateKey) {
      throw new Error("OAUTH_PRIVATE_KEY is required when PUBLIC_URL is not loopback");
    }
    const privateKey = options.oauthPrivateKey.replaceAll("\\n", "\n");
    keyset = [await JoseKey.fromImportable(privateKey, "paywall-radar")];
  }

  const stores = createOAuthStores(db);
  const safeFetch = safeFetchWrap();
  const client = new NodeOAuthClient({
    clientMetadata,
    ...(keyset ? { keyset } : {}),
    stateStore: stores.stateStore,
    sessionStore: stores.sessionStore,
    requestLock: requestLocalLock,
    fetch: (input, init) =>
      safeFetch(input, {
        ...init,
        redirect: init?.redirect ?? "error",
      }),
  });

  return {
    adminDid: options.adminDid,
    clientMetadata: client.clientMetadata,
    jwks: client.jwks,
    publicUrl: publicUrl.origin,
    sessionSecret: options.sessionSecret,
    secureCookies: publicUrl.protocol === "https:",
    sessionMaxAge: APP_SESSION_MAX_AGE_SECONDS,
    authorize: (handle) => client.authorize(handle, { scope: "atproto" }),
    callback: async (params) => {
      const { session } = await client.callback(params);
      return session.did;
    },
    createSession: async () => {
      const token = randomBytes(32).toString("base64url");
      await db
        .insert(adminSession)
        .values({
          id: 1,
          tokenHash: hashSessionToken(token),
          expiresAt: new Date(Date.now() + APP_SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
        })
        .onConflictDoUpdate({
          target: adminSession.id,
          set: {
            tokenHash: hashSessionToken(token),
            expiresAt: new Date(Date.now() + APP_SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
          },
        });
      return token;
    },
    restoreSession: async (token) => {
      const row = await db.query.adminSession.findFirst({
        where: (session, { eq }) => eq(session.tokenHash, hashSessionToken(token)),
      });
      if (!row || row.expiresAt <= new Date().toISOString()) return false;
      await client.restore(options.adminDid);
      return true;
    },
    clearSession: async (token) => {
      await db.delete(adminSession).where(eq(adminSession.tokenHash, hashSessionToken(token)));
    },
    revoke: (did) => client.revoke(did),
  };
}

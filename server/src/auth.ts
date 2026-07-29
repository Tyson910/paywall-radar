import {
  buildAtprotoLoopbackClientMetadata,
  JoseKey,
  NodeOAuthClient,
  oauthClientMetadataSchema,
  requestLocalLock,
} from "@atproto/oauth-client-node";

import type { Database } from "./database/connection.js";

import { createOAuthStores } from "./database/oauth.js";

export interface AuthService {
  readonly adminDid: string;
  readonly clientMetadata: NodeOAuthClient["clientMetadata"];
  readonly jwks: NodeOAuthClient["jwks"];
  readonly publicUrl: string;
  readonly sessionSecret: string;
  readonly secureCookies: boolean;
  authorize(handle: string): Promise<URL>;
  callback(params: URLSearchParams): Promise<string>;
  restore(did: string): Promise<void>;
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
    keyset = [await JoseKey.fromJWK(options.oauthPrivateKey)];
  }

  const stores = createOAuthStores(db);
  const client = new NodeOAuthClient({
    clientMetadata,
    ...(keyset ? { keyset } : {}),
    stateStore: stores.stateStore,
    sessionStore: stores.sessionStore,
    requestLock: requestLocalLock,
  });

  return {
    adminDid: options.adminDid,
    clientMetadata: client.clientMetadata,
    jwks: client.jwks,
    publicUrl: publicUrl.origin,
    sessionSecret: options.sessionSecret,
    secureCookies: publicUrl.protocol === "https:",
    authorize: (handle) => client.authorize(handle, { scope: "atproto" }),
    callback: async (params) => {
      const { session } = await client.callback(params);
      return session.did;
    },
    restore: async (did) => {
      await client.restore(did);
    },
    revoke: (did) => client.revoke(did),
  };
}

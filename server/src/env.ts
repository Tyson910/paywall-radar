import * as z from "zod";

const httpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Must be an HTTP or HTTPS URL");

export const runtimeEnvSchema = z
  .object({
    DID: z.string({ error: "DID is required" }).trim().startsWith("did:"),
    SIGNING_KEY: z.string({ error: "SIGNING_KEY is required" }).trim().min(1),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DB_PATH: z.string().trim().min(1).default("paywall-radar.db"),
    CLIENT_DIR: z.string().trim().min(1).default("dist/client"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4100),
    ADMIN_DID: z.string({ error: "ADMIN_DID is required" }).trim().startsWith("did:"),
    SESSION_SECRET: z
      .string({ error: "SESSION_SECRET is required" })
      .min(32, { error: "SESSION_SECRET must be at least 32 characters" }),
    PUBLIC_URL: httpUrlSchema.optional(),
    OAUTH_PRIVATE_KEY: z.string().trim().min(1).optional(),
  })
  .transform((env) => ({
    did: env.DID,
    signingKey: env.SIGNING_KEY,
    dbPath: env.DB_PATH,
    port: env.PORT,
    adminDid: env.ADMIN_DID,
    sessionSecret: env.SESSION_SECRET,
    publicUrl: env.PUBLIC_URL ?? `http://127.0.0.1:${env.PORT}`,
    oauthPrivateKey: env.OAUTH_PRIVATE_KEY ?? null,
    ...(env.NODE_ENV === "production" ? { clientDir: env.CLIENT_DIR } : {}),
  }));

export type RuntimeEnv = z.infer<typeof runtimeEnvSchema>;

export function loadRuntimeEnv(env: NodeJS.ProcessEnv = process.env): RuntimeEnv {
  return runtimeEnvSchema.parse(env);
}

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/src/database/models.ts",
  out: "./server/src/database/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "./data/paywall-radar.db",
  },
});

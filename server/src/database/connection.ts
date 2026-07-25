import { resolve } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as models from "./models.js";

export type Database = LibSQLDatabase<typeof models>;

export interface DatabaseConnection {
  client: Client;
  db: Database;
}

export function openDatabase(databasePath: string): DatabaseConnection {
  const client = createClient({ url: `file:${resolve(databasePath)}` });
  const db = drizzle(client, { schema: models });

  return { client, db };
}

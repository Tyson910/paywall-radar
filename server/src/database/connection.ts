import { resolve } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as models from "./models.js";

// `drizzle()` returns the instance intersected with `{ $client }`; typing it
// here keeps `$client` available for raw batch statements (see labels.ts).
export type Database = LibSQLDatabase<typeof models> & { $client: Client };

export interface DatabaseConnection {
  client: Client;
  db: Database;
}

// Matches the busy-timeout Litestream uses (litestream.yml). Without it,
// concurrent writes from Litestream (or a second consumer) fail instantly
// with SQLITE_BUSY instead of waiting for the lock.
const busyTimeoutMs = 5_000;

export async function openDatabase(databasePath: string): Promise<DatabaseConnection> {
  const client = createClient({ url: `file:${resolve(databasePath)}` });
  await client.execute(`PRAGMA journal_mode = WAL`);
  await client.execute(`PRAGMA busy_timeout = ${busyTimeoutMs}`);

  const db = drizzle(client, { schema: models });

  return { client, db };
}

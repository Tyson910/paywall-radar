import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { initializeDatabase } from "../database/initialize.js";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/paywall-radar.db");

await mkdir(dirname(databasePath), { recursive: true });

const result = await initializeDatabase(databasePath);
console.log(`Database initialized with ${String(result.domainCount)} domains.`);

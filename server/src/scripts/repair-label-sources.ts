import { resolve } from "node:path";

import { count, eq } from "drizzle-orm";

import { openDatabase } from "../database/connection.js";
import { labels } from "../database/models.js";
import { prepareLabelRepair, repairLabelSources } from "../database/repair-label-sources.js";
import { loadSigningKey } from "../labeler.js";

const write = process.argv.slice(2).includes("--write");
const resequence = process.argv.slice(2).includes("--resequence");
const unknownArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--write" && argument !== "--resequence");
if (unknownArguments.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArguments.join(", ")}`);
}

const correctSource = process.env.DID?.trim();
const signingKey = process.env.SIGNING_KEY?.trim();
const databasePath = resolve(process.env.DB_PATH?.trim() || "./data/paywall-radar.db");

if (!correctSource?.startsWith("did:")) {
  throw new Error("DID must be set to the labeler account DID");
}
if (!signingKey) {
  throw new Error("SIGNING_KEY must be set");
}

const keypair = await loadSigningKey(signingKey);
const incorrectSource = keypair.did();

if (correctSource === incorrectSource) {
  throw new Error(
    "DID is set to the signing key DID. Set DID to the labeler account DID before repairing.",
  );
}

const { client, db } = openDatabase(databasePath);

try {
  if (write) await prepareLabelRepair(db);
  console.log(`Database: ${databasePath}`);
  console.log(`Incorrect source: ${incorrectSource}`);
  console.log(`Correct source: ${correctSource}`);

  const result = await repairLabelSources(
    db,
    {
      fromSource: incorrectSource,
      toSource: correctSource,
      signer: keypair,
      resequence,
    },
    write,
  );

  console.log(
    `Matched ${String(result.matched)} label(s)` +
      (result.firstId != null
        ? ` with IDs ${String(result.firstId)}-${String(result.lastId)}`
        : ""),
  );

  if (!write) {
    console.log(
      "Dry run only. Stop the app, back up the database, then rerun with --write --resequence.",
    );
  } else if (result.alreadyCompleted) {
    console.log("Canonical label repair was already completed; no changes made.");
  } else {
    const [remaining] = await db
      .select({ count: count() })
      .from(labels)
      .where(eq(labels.src, incorrectSource));

    if (remaining?.count !== 0) {
      throw new Error(`${String(remaining?.count)} label(s) still have the incorrect source`);
    }
    console.log(`Re-signed and updated ${String(result.repaired)} label(s). Verification passed.`);
    if (result.newFirstId != null) {
      console.log(
        `Republished repaired history at sequences ${String(result.newFirstId)}-${String(result.newLastId)}.`,
      );
    }
  }
} finally {
  client.close();
}

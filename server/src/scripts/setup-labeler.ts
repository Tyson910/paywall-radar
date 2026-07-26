import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { Secp256k1Keypair } from "@atproto/crypto";

const PDS_URL = process.env.PDS_URL ?? "https://bsky.social";

interface Session {
  did: string;
  accessJwt: string;
}

async function xrpc(
  session: Session | null,
  method: "GET" | "POST",
  nsid: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${PDS_URL}/xrpc/${nsid}`;
  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.accessJwt}`;
  if (body) headers["Content-Type"] = "application/json";

  const init: RequestInit = { method, headers };
  if (body) init.body = JSON.stringify(body);

  const res = await fetch(url, init);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${nsid} failed (${res.status}): ${text}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return undefined;
}

async function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    console.log("=== Paywall Radar Labeler Setup ===\n");
    console.log(`PDS: ${PDS_URL} (set PDS_URL env to change)\n`);

    const identifier = await prompt(rl, "Handle or DID: ");
    const password = await prompt(rl, "App password: ");
    const serviceEndpoint = await prompt(rl, "Labeler service URL (e.g. https://paywall-radar.example.com): ");

    // Authenticate
    console.log("\nAuthenticating...");
    const session = (await xrpc(null, "POST", "com.atproto.server.createSession", {
      identifier,
      password,
    })) as Session;
    console.log(`Authenticated as ${session.did}`);

    // Generate or import signing key
    let keypair: Secp256k1Keypair;
    const existingKey = process.env.SIGNING_KEY;
    if (existingKey) {
      console.log("\nUsing SIGNING_KEY from environment...");
      keypair = await Secp256k1Keypair.import(existingKey, { exportable: true });
    } else {
      console.log("\nGenerating new signing key...");
      keypair = await Secp256k1Keypair.create({ exportable: true });
    }
    const publicDidKey = keypair.did();
    console.log(`Signing key DID: ${publicDidKey}`);

    // Check current DID document
    console.log("\nChecking current DID document...");
    const credentials = (await xrpc(session, "GET", "com.atproto.identity.getRecommendedDidCredentials")) as {
      verificationMethods?: Record<string, string>;
      services?: Record<string, { type: string; endpoint: string }>;
    };

    const hasKey = credentials.verificationMethods?.atproto_label === publicDidKey;
    const hasService = credentials.services?.atproto_labeler?.endpoint === serviceEndpoint;

    if (hasKey && hasService) {
      console.log("DID document already has the signing key and service endpoint.");
    } else {
      console.log("DID document needs updating.");
      console.log(`  Key: ${hasKey ? "already set" : "needs adding"}`);
      console.log(`  Service: ${hasService ? "already set" : "needs adding"}`);

      // Request PLC operation signature (triggers email)
      console.log("\nRequesting PLC operation signature (check your email)...");
      await xrpc(session, "POST", "com.atproto.identity.requestPlcOperationSignature");

      const token = await prompt(rl, "\nEnter the confirmation token from your email: ");

      // Sign the PLC operation
      console.log("Signing PLC operation...");
      const verificationMethods = {
        ...credentials.verificationMethods,
        atproto_label: publicDidKey,
      };
      const services = {
        ...credentials.services,
        atproto_labeler: {
          type: "AtprotoLabeler",
          endpoint: serviceEndpoint,
        },
      };

      const signResult = (await xrpc(session, "POST", "com.atproto.identity.signPlcOperation", {
        token,
        verificationMethods,
        services,
      })) as { operation: unknown };

      // Submit the PLC operation
      console.log("Submitting PLC operation...");
      await xrpc(session, "POST", "com.atproto.identity.submitPlcOperation", {
        operation: signResult.operation,
      });
      console.log("DID document updated successfully.");
    }

    // Create labeler service record
    console.log("\nCreating labeler service declaration...");
    await xrpc(session, "POST", "com.atproto.repo.putRecord", {
      repo: session.did,
      collection: "app.bsky.labeler.service",
      rkey: "self",
      record: {
        $type: "app.bsky.labeler.service",
        policies: {
          labelValues: ["paywall"],
          labelValueDefinitions: [
            {
              identifier: "paywall",
              severity: "inform",
              blurs: "none",
              defaultSetting: "warn",
              locales: [
                {
                  lang: "en",
                  name: "Paywall",
                  description: "This post links to paywalled content",
                },
              ],
            },
          ],
        },
        createdAt: new Date().toISOString(),
      },
    });
    console.log("Labeler service record created.");

    // Print signing key
    if (!existingKey) {
      const exported = await keypair.export();
      const hex = Buffer.from(exported).toString("hex");
      console.log("\n=== Save this signing key ===");
      console.log(`SIGNING_KEY=${hex}`);
      console.log("Add it to your .env file. This key cannot be recovered.\n");
    }

    console.log("Setup complete!");
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error("Setup failed:", error.message);
  process.exit(1);
});

import type { Client } from "@libsql/client";

import type { JetstreamConsumer } from "./jetstream-consumer.js";

import { createApp } from "./app.js";
import { createAuthService } from "./auth.js";
import { openDatabase } from "./database/connection.js";
import { recordFailedEvent } from "./database/failed-events.js";
import { initializeDatabase } from "./database/initialize.js";
import { recordLabel } from "./database/labels.js";
import { loadCursorState, loadDomainPatterns, saveCursorState } from "./database/state.js";
import { loadRuntimeEnv } from "./env.js";
import { startJetstreamConsumer } from "./jetstream-consumer.js";
import { LabelStream } from "./label-stream.js";
import { loadSigningKey, signLabel } from "./labeler.js";

export interface Runtime {
  app: ReturnType<typeof createApp>;
  port: number;
  stop(): Promise<void>;
}

export async function startRuntime(): Promise<Runtime> {
  const options = loadRuntimeEnv();
  const { domainCount } = await initializeDatabase(options.dbPath);
  console.log(`Database initialized with ${domainCount} domain patterns`);

  let client: Client | undefined;
  let consumer: JetstreamConsumer | undefined;
  const labelStream = new LabelStream();

  try {
    const connection = openDatabase(options.dbPath);
    client = connection.client;
    const { db } = connection;

    const [patterns, initialState, keypair, auth] = await Promise.all([
      loadDomainPatterns(db),
      loadCursorState(db),
      loadSigningKey(options.signingKey),
      createAuthService(db, {
        adminDid: options.adminDid,
        publicUrl: options.publicUrl,
        sessionSecret: options.sessionSecret,
        ...(options.oauthPrivateKey ? { oauthPrivateKey: options.oauthPrivateKey } : {}),
      }),
    ]);

    const app = createApp({
      db,
      labelStream,
      auth,
      domainPatterns: patterns,
      ...(options.clientDir != null && { clientDir: options.clientDir }),
    });

    consumer = startJetstreamConsumer({
      initialState,
      patterns,
      handlePost: async (result) => {
        if (!result.action) return;

        const signed = await signLabel(
          {
            src: options.did,
            uri: result.postUri,
            val: result.action.val,
            cts: new Date().toISOString(),
          },
          keypair,
        );
        const inserted = await recordLabel(db, {
          ...signed,
          domain: result.action.domain,
          authorDid: result.authorDid,
          postText: result.postText,
        });

        if (inserted) {
          labelStream.publish(inserted.id, signed);
        }
      },
      recordFailure: (failure) => recordFailedEvent(db, failure),
      saveState: (state) => saveCursorState(db, state),
    });

    let stopped = false;
    return {
      app,
      port: options.port,
      stop: async () => {
        if (stopped) return;
        stopped = true;

        await consumer?.stop();
        labelStream.close();
        client?.close();
      },
    };
  } catch (error) {
    await consumer?.stop();
    labelStream.close();
    client?.close();
    throw error;
  }
}

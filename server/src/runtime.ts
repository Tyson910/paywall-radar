import type { Client } from "@libsql/client";

import type { JetstreamConsumer, JetstreamConsumerOptions } from "./jetstream-consumer.js";

import { createApp } from "./app.js";
import { createAuthService } from "./auth.js";
import { openDatabase } from "./database/connection.js";
import { recordFailedEvent } from "./database/failed-events.js";
import { initializeDatabase } from "./database/initialize.js";
import { loadLabelByUri, publishLabelRevision, recordLabel } from "./database/labels.js";
import {
  loadDomainPatterns,
  loadJetstreamCursorState,
  saveJetstreamCursorState,
} from "./database/state.js";
import { loadRuntimeEnv } from "./env.js";
import { startJetstreamConsumer } from "./jetstream-consumer.js";
import { defaultJetstreamSources } from "./jetstream.js";
import { LabelStream } from "./label-stream.js";
import { loadSigningKey, signLabel } from "./labeler.js";
import { pollSelfPosts } from "./poll-self-posts.js";

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
  const consumers: JetstreamConsumer[] = [];
  const labelStream = new LabelStream();

  try {
    const connection = await openDatabase(options.dbPath);
    client = connection.client;
    const { db } = connection;

    const [patterns, initialStates, keypair, auth] = await Promise.all([
      loadDomainPatterns(db),
      Promise.all(defaultJetstreamSources.map((source) => loadJetstreamCursorState(db, source.id))),
      loadSigningKey(options.signingKey),
      createAuthService(db, {
        adminDid: options.adminDid,
        publicUrl: options.publicUrl,
        sessionSecret: options.sessionSecret,
        ...(options.oauthPrivateKey ? { oauthPrivateKey: options.oauthPrivateKey } : {}),
      }),
    ]);

    const pollDeps = { did: options.did, patterns, keypair, db, labelStream };

    const app = createApp({
      db,
      labelStream,
      auth,
      adminDeps: {
        db,
        auth,
        patterns,
        pollSelfPosts: () => pollSelfPosts(pollDeps),
        republishLabel: async (uri) => {
          const existing = await loadLabelByUri(db, uri);
          if (!existing) return null;

          const signed = await signLabel(
            {
              src: options.did,
              uri: existing.uri,
              val: existing.val,
              cts: new Date().toISOString(),
              ...(existing.cid != null && { cid: existing.cid }),
              ...(existing.exp != null && { exp: existing.exp }),
              ...(existing.neg && { neg: true }),
            },
            keypair,
          );
          const published = await publishLabelRevision(db, signed);
          if (!published) return null;

          labelStream.publish(published.seq, signed);
          return { seq: published.seq };
        },
      },
      ...(options.clientDir != null && { clientDir: options.clientDir }),
    });

    const handlePost: JetstreamConsumerOptions["handlePost"] = async (result) => {
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
        labelStream.publish(inserted.seq, signed);
      }
    };

    consumers.push(
      ...defaultJetstreamSources.map((source, index) =>
        startJetstreamConsumer({
          initialState: initialStates[index]!,
          patterns,
          handlePost,
          recordFailure: (failure) => recordFailedEvent(db, failure),
          saveState: (state) => saveJetstreamCursorState(db, source.id, state),
          // Each flush is a SQLite transaction, which Litestream replicates as
          // one LTX file upload (a billable R2 Class A op). 30s keeps that cost
          // low; restarts replay at most ~40s of idempotent firehose events.
          flushIntervalMs: 30_000,
          sourceId: source.id,
          endpoint: source.endpoint,
        }),
      ),
    );

    let stopped = false;
    return {
      app,
      port: options.port,
      stop: async () => {
        if (stopped) return;
        stopped = true;

        await Promise.all(consumers.map((consumer) => consumer.stop()));
        labelStream.close();
        client?.close();
      },
    };
  } catch (error) {
    await Promise.all(consumers.map((consumer) => consumer.stop()));
    labelStream.close();
    client?.close();
    throw error;
  }
}

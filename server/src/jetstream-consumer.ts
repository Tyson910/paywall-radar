import WebSocket, { type RawData } from "ws";

import type { CursorState } from "./database/state.js";
import type { DomainPattern } from "./domains.js";

import {
  buildJetstreamUrl,
  defaultJetstreamEndpoint,
  processJetstreamMessage,
  type JetstreamMessageResult,
} from "./jetstream.js";

type PostResult = Extract<JetstreamMessageResult, { type: "post" }>;

export interface FailedJetstreamEvent {
  cursorUs?: number;
  did?: string;
  collection?: string;
  rkey?: string;
  reason: string;
  payload: string;
}

export interface JetstreamSocket {
  onOpen(handler: () => void): void;
  onMessage(handler: (message: string) => void): void;
  onClose(handler: () => void): void;
  onError(handler: (error: Error) => void): void;
  close(): void;
}

interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, error?: unknown): void;
}

export interface JetstreamConsumerOptions {
  initialState: CursorState;
  patterns: readonly DomainPattern[];
  handlePost(result: PostResult): Promise<void>;
  recordFailure?(failure: FailedJetstreamEvent): Promise<void>;
  saveState(state: CursorState): Promise<void>;
  endpoint?: string;
  flushIntervalMs?: number;
  reconnectDelayMs?: number;
  logger?: Logger;
  createSocket?: (url: string) => JetstreamSocket;
}

export interface JetstreamConsumer {
  getState(): CursorState;
  stop(): Promise<void>;
}

function toMessage(data: RawData): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  return data.toString("utf8");
}

function createWebSocket(url: string): JetstreamSocket {
  const socket = new WebSocket(url);

  return {
    onOpen: (handler) => socket.on("open", handler),
    onMessage: (handler) => socket.on("message", (data) => handler(toMessage(data))),
    onClose: (handler) => socket.on("close", handler),
    onError: (handler) => socket.on("error", handler),
    close: () => socket.close(),
  };
}

export function startJetstreamConsumer(options: JetstreamConsumerOptions): JetstreamConsumer {
  const endpoint = options.endpoint ?? defaultJetstreamEndpoint;
  const flushIntervalMs = options.flushIntervalMs ?? 5_000;
  const reconnectDelayMs = options.reconnectDelayMs ?? 1_000;
  const logger = options.logger ?? console;
  const makeSocket = options.createSocket ?? createWebSocket;

  let state = { ...options.initialState };
  let stateIsDirty = false;
  let stopped = false;
  let activeSocket: JetstreamSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let processing = Promise.resolve();
  let checkpointing = Promise.resolve();

  function flushState(): Promise<void> {
    checkpointing = checkpointing.then(async () => {
      if (!stateIsDirty) {
        return;
      }

      const snapshot = { ...state };
      stateIsDirty = false;

      try {
        await options.saveState(snapshot);
      } catch (error) {
        stateIsDirty = true;
        logger.error("Failed to save Jetstream cursor state", error);
      }
    });

    return checkpointing;
  }

  function advanceState(cursorUs: number, postWasScanned: boolean): void {
    state = {
      cursorUs,
      postsScanned: state.postsScanned + (postWasScanned ? 1 : 0),
    };
    stateIsDirty = true;
  }

  function scheduleReconnect(): void {
    if (stopped || reconnectTimer) {
      return;
    }

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelayMs);
  }

  async function reportFailure(failure: FailedJetstreamEvent): Promise<void> {
    logger.warn(
      JSON.stringify({
        event: "jetstream_event_failed",
        reason: failure.reason,
        cursorUs: failure.cursorUs,
        did: failure.did,
        collection: failure.collection,
        rkey: failure.rkey,
      }),
    );

    try {
      await options.recordFailure?.(failure);
    } catch (error) {
      logger.error("Failed to store Jetstream failure", error);
    }
  }

  function connect(): void {
    if (stopped) {
      return;
    }

    const socket = makeSocket(buildJetstreamUrl(endpoint, state.cursorUs));
    activeSocket = socket;
    let connectionFailed = false;

    socket.onOpen(() => logger.info("Connected to Jetstream"));
    socket.onError((error) => logger.error("Jetstream socket error", error));
    socket.onClose(() => {
      if (activeSocket === socket) {
        activeSocket = null;
      }

      void processing.then(scheduleReconnect);
    });
    socket.onMessage((message) => {
      if (connectionFailed || stopped) {
        return;
      }

      processing = processing
        .then(async () => {
          if (connectionFailed) {
            return;
          }

          const result = processJetstreamMessage(message, options.patterns);

          if (result.type === "invalid") {
            await reportFailure({
              reason: result.reason,
              payload: result.payload,
              ...(result.cursorUs != null ? { cursorUs: result.cursorUs } : {}),
              ...(result.did ? { did: result.did } : {}),
              ...(result.collection ? { collection: result.collection } : {}),
              ...(result.rkey ? { rkey: result.rkey } : {}),
            });
            if (result.cursorUs != null) {
              advanceState(result.cursorUs, false);
            }
            return;
          }

          if (result.type === "post") {
            try {
              await options.handlePost(result);
            } catch (error) {
              const rkey = result.postUri.split("/").at(-1);
              await reportFailure({
                cursorUs: result.cursorUs,
                did: result.authorDid,
                collection: "app.bsky.feed.post",
                ...(rkey ? { rkey } : {}),
                reason: `processing_error: ${error instanceof Error ? error.message : String(error)}`,
                payload: message.slice(0, 16_384),
              });
              throw error;
            }
          }

          advanceState(result.cursorUs, result.type === "post");
        })
        .catch((error: unknown) => {
          connectionFailed = true;
          logger.error("Failed to process Jetstream message", error);
          socket.close();
        });
    });
  }

  const flushTimer = setInterval(() => void flushState(), flushIntervalMs);
  connect();

  return {
    getState: () => ({ ...state }),
    stop: async () => {
      stopped = true;
      clearInterval(flushTimer);

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      activeSocket?.close();
      activeSocket = null;
      await processing;
      await flushState();
    },
  };
}

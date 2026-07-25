import { afterEach, describe, expect, it, vi } from "vitest";

import { parseDomainPatterns } from "./domains.js";
import { startJetstreamConsumer, type JetstreamSocket } from "./jetstream-consumer.js";

class FakeSocket implements JetstreamSocket {
  private openHandler = () => {};
  private messageHandler = (_message: string) => {};
  private closeHandler = () => {};
  private errorHandler = (_error: Error) => {};

  onOpen(handler: () => void): void {
    this.openHandler = handler;
  }

  onMessage(handler: (message: string) => void): void {
    this.messageHandler = handler;
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  close(): void {
    this.closeHandler();
  }

  emitMessage(message: string): void {
    this.messageHandler(message);
  }
}

function createPost(cursorUs: number, rkey: string): string {
  return JSON.stringify({
    did: "did:plc:example",
    time_us: cursorUs,
    kind: "commit",
    commit: {
      rev: "3l3qo2vutsw2b",
      operation: "create",
      collection: "app.bsky.feed.post",
      rkey,
      record: {
        $type: "app.bsky.feed.post",
        text: "An article",
        createdAt: "2026-07-25T05:00:00.000Z",
      },
    },
  });
}

async function settlePromises(): Promise<void> {
  for (let index = 0; index < 8; index += 1) {
    await Promise.resolve();
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("startJetstreamConsumer", () => {
  it("processes messages in order, checkpoints state, and reconnects from the cursor", async () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const urls: string[] = [];
    const handled: number[] = [];
    const saved: Array<{ cursorUs: number; postsScanned: number }> = [];

    const consumer = startJetstreamConsumer({
      initialState: { cursorUs: 100, postsScanned: 3 },
      patterns: parseDomainPatterns([]),
      handlePost: async (post) => {
        handled.push(post.cursorUs);
      },
      saveState: async (state) => {
        saved.push(state);
      },
      createSocket: (url) => {
        urls.push(url);
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    sockets[0]!.emitMessage(createPost(200, "first"));
    sockets[0]!.emitMessage(createPost(300, "second"));
    await settlePromises();

    expect(handled).toEqual([200, 300]);
    expect(consumer.getState()).toEqual({ cursorUs: 300, postsScanned: 5 });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(saved).toEqual([{ cursorUs: 300, postsScanned: 5 }]);

    sockets[0]!.close();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(urls[1]).toContain("cursor=300");

    await consumer.stop();
  });

  it("logs malformed messages without advancing the cursor", async () => {
    const socket = new FakeSocket();
    const warn = vi.fn();
    const consumer = startJetstreamConsumer({
      initialState: { cursorUs: 100, postsScanned: 3 },
      patterns: [],
      handlePost: vi.fn(),
      saveState: vi.fn(),
      createSocket: () => socket,
      logger: { info: vi.fn(), warn, error: vi.fn() },
    });

    socket.emitMessage("not json");
    await settlePromises();

    expect(warn).toHaveBeenCalledOnce();
    expect(consumer.getState()).toEqual({ cursorUs: 100, postsScanned: 3 });
    await consumer.stop();
  });

  it("does not process queued messages after a post handler fails", async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const handled: number[] = [];
    const consumer = startJetstreamConsumer({
      initialState: { cursorUs: 100, postsScanned: 3 },
      patterns: [],
      handlePost: async (post) => {
        handled.push(post.cursorUs);
        throw new Error("label failed");
      },
      saveState: vi.fn(),
      createSocket: () => socket,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    socket.emitMessage(createPost(200, "first"));
    socket.emitMessage(createPost(300, "second"));
    await settlePromises();

    expect(handled).toEqual([200]);
    expect(consumer.getState()).toEqual({ cursorUs: 100, postsScanned: 3 });
    await consumer.stop();
  });

  it("serializes cursor checkpoints", async () => {
    vi.useFakeTimers();
    const socket = new FakeSocket();
    const saved: Array<{ cursorUs: number; postsScanned: number }> = [];
    let finishFirstSave = () => {};
    const firstSave = new Promise<void>((resolve) => {
      finishFirstSave = resolve;
    });
    const consumer = startJetstreamConsumer({
      initialState: { cursorUs: 100, postsScanned: 3 },
      patterns: [],
      handlePost: async () => {},
      saveState: async (state) => {
        saved.push(state);
        if (saved.length === 1) {
          await firstSave;
        }
      },
      createSocket: () => socket,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    socket.emitMessage(createPost(200, "first"));
    await settlePromises();
    await vi.advanceTimersByTimeAsync(5_000);

    socket.emitMessage(createPost(300, "second"));
    await settlePromises();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(saved).toEqual([{ cursorUs: 200, postsScanned: 4 }]);

    finishFirstSave();
    await settlePromises();
    expect(saved).toEqual([
      { cursorUs: 200, postsScanned: 4 },
      { cursorUs: 300, postsScanned: 5 },
    ]);

    await consumer.stop();
  });
});

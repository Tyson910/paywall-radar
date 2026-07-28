import type { WSContext } from "hono/ws";

import type { SignedLabel } from "./labeler.js";

import { encodeLabelsFrame } from "./labeler.js";

export class LabelStream {
  readonly #subscribers = new Set<WSContext>();

  add(subscriber: WSContext): void {
    this.#subscribers.add(subscriber);
  }

  remove(subscriber: WSContext): void {
    this.#subscribers.delete(subscriber);
  }

  publish(seq: number, label: SignedLabel): void {
    const frame = new Uint8Array(encodeLabelsFrame(seq, label)) as Uint8Array<ArrayBuffer>;

    for (const subscriber of this.#subscribers) {
      subscriber.send(frame);
    }
  }

  close(): void {
    for (const subscriber of this.#subscribers) {
      subscriber.close(1001, "server shutting down");
    }
    this.#subscribers.clear();
  }
}

import { jetstreamEventEnvelopeSchema, jetstreamPostEventSchema } from "#shared/schemas.js";

import type { DomainPattern } from "./domains.js";

import { processPost, type LabelAction } from "./pipeline.js";

export const defaultJetstreamEndpoint = "wss://jetstream2.us-east.bsky.network/subscribe";

export type JetstreamMessageResult =
  | { type: "invalid" }
  | { type: "ignored"; cursorUs: number }
  | {
      type: "post";
      cursorUs: number;
      postUri: string;
      authorDid: string;
      action: LabelAction | null;
    };

export function buildJetstreamUrl(endpoint: string, cursorUs: number): string {
  const url = new URL(endpoint);
  url.searchParams.append("wantedCollections", "app.bsky.feed.post");

  if (cursorUs > 0) {
    url.searchParams.set("cursor", String(cursorUs));
  }

  return url.toString();
}

type JsonParseResult = { success: true; value: unknown } | { success: false };

function parseJson(message: string): JsonParseResult {
  try {
    return { success: true, value: JSON.parse(message) as unknown };
  } catch {
    return { success: false };
  }
}

export function processJetstreamMessage(
  message: string,
  patterns: readonly DomainPattern[],
): JetstreamMessageResult {
  const parsed = parseJson(message);
  if (!parsed.success) {
    return { type: "invalid" };
  }

  const envelope = jetstreamEventEnvelopeSchema.safeParse(parsed.value);
  if (!envelope.success) {
    return { type: "invalid" };
  }

  if (envelope.data.kind !== "commit") {
    return { type: "ignored", cursorUs: envelope.data.time_us };
  }

  const event = jetstreamPostEventSchema.safeParse(parsed.value);
  if (!event.success) {
    return { type: "invalid" };
  }

  if (event.data.commit.operation === "delete") {
    return { type: "ignored", cursorUs: event.data.time_us };
  }

  const postUri = `at://${event.data.did}/${event.data.commit.collection}/${event.data.commit.rkey}`;

  return {
    type: "post",
    cursorUs: event.data.time_us,
    postUri,
    authorDid: event.data.did,
    action: processPost(event.data.commit.record, patterns),
  };
}

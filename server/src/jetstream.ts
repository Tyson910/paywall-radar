import { jetstreamEventEnvelopeSchema, jetstreamPostEventSchema } from "#shared/schemas.js";

import type { DomainPattern } from "./domains.js";

import { processPost, type LabelAction } from "./pipeline.js";

export const defaultJetstreamEndpoint = "wss://jetstream2.us-east.bsky.network/subscribe";

export type JetstreamMessageResult =
  | {
      type: "invalid";
      reason: string;
      payload: string;
      cursorUs?: number;
      did?: string;
      collection?: string;
      rkey?: string;
    }
  | { type: "ignored"; cursorUs: number }
  | {
      type: "post";
      cursorUs: number;
      postUri: string;
      authorDid: string;
      postText: string;
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

const MAX_FAILURE_PAYLOAD_CHARS = 16_384;

function failurePayload(message: string): string {
  return message.slice(0, MAX_FAILURE_PAYLOAD_CHARS);
}

function validationReason(
  prefix: string,
  issues: { path: PropertyKey[]; message: string }[],
): string {
  const details = issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
  return `${prefix}: ${details}`;
}

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
    return {
      type: "invalid",
      reason: "invalid_json: message is not valid JSON",
      payload: failurePayload(message),
    };
  }

  const envelope = jetstreamEventEnvelopeSchema.safeParse(parsed.value);
  if (!envelope.success) {
    return {
      type: "invalid",
      reason: validationReason("invalid_envelope", envelope.error.issues),
      payload: failurePayload(message),
    };
  }

  if (envelope.data.kind !== "commit") {
    return { type: "ignored", cursorUs: envelope.data.time_us };
  }

  const event = jetstreamPostEventSchema.safeParse(parsed.value);
  if (!event.success) {
    const commit =
      typeof parsed.value === "object" &&
      parsed.value !== null &&
      "commit" in parsed.value &&
      typeof parsed.value.commit === "object" &&
      parsed.value.commit !== null
        ? parsed.value.commit
        : null;
    const collection =
      commit && "collection" in commit && typeof commit.collection === "string"
        ? commit.collection
        : undefined;
    const rkey =
      commit && "rkey" in commit && typeof commit.rkey === "string" ? commit.rkey : undefined;

    return {
      type: "invalid",
      reason: validationReason("invalid_post_event", event.error.issues),
      payload: failurePayload(message),
      cursorUs: envelope.data.time_us,
      did: envelope.data.did,
      ...(collection ? { collection } : {}),
      ...(rkey ? { rkey } : {}),
    };
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
    postText: event.data.commit.record.text,
    action: processPost(event.data.commit.record, patterns),
  };
}

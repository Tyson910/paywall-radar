import type { ExternalEmbed, PostFacet, PostRecord, UriFeature } from "#shared/schemas.js";

import { matchDomain, type DomainPattern } from "./domains.js";

const shortenedUrlHosts = new Set(["bit.ly", "t.co"]);

export interface LabelAction {
  val: "paywall";
  domain: string;
}

function isUriFeature(feature: PostFacet["features"][number]): feature is UriFeature {
  return (
    feature.$type === "app.bsky.richtext.facet#link" &&
    "uri" in feature &&
    typeof feature.uri === "string"
  );
}

function isExternalEmbed(embed: PostRecord["embed"]): embed is ExternalEmbed {
  return (
    embed?.$type === "app.bsky.embed.external" &&
    "external" in embed &&
    typeof embed.external === "object" &&
    embed.external !== null &&
    "uri" in embed.external &&
    typeof embed.external.uri === "string"
  );
}

function extractPostUrls(post: PostRecord): string[] {
  const facetUrls =
    post.facets?.flatMap((facet) =>
      facet.features.filter(isUriFeature).map((feature) => feature.uri),
    ) ?? [];
  const embedUrls = isExternalEmbed(post.embed) ? [post.embed.external.uri] : [];

  return [...facetUrls, ...embedUrls];
}

function getHostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

function extractPostHostnames(post: PostRecord): string[] {
  const hostnames = extractPostUrls(post)
    .map(getHostname)
    .filter((hostname): hostname is string => hostname !== null)
    // TODO: resolve shortened URLs (t.co, bit.ly).
    .filter((hostname) => !shortenedUrlHosts.has(hostname));

  return [...new Set(hostnames)];
}

export function processPost(
  post: PostRecord,
  patterns: readonly DomainPattern[],
): LabelAction | null {
  for (const hostname of extractPostHostnames(post)) {
    if (matchDomain(hostname, patterns)) {
      return { val: "paywall", domain: hostname };
    }
  }

  return null;
}

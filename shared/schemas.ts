import * as z from "zod";

export const statsSummarySchema = z.object({
  postsScanned: z.number().int().nonnegative(),
  labelsEmitted: z.number().int().nonnegative(),
  lastEventAt: z.iso.datetime().nullable(),
});

export const volumePointSchema = z.object({
  hour: z.iso.datetime(),
  labels: z.number().int().nonnegative(),
});

export const domainCountSchema = z.object({
  domain: z.string().min(1),
  labels: z.number().int().nonnegative(),
});

export const dashboardSnapshotSchema = z.object({
  stats: statsSummarySchema,
  volume: z.array(volumePointSchema),
  topDomains: z.array(domainCountSchema),
});

const uriFeatureSchema = z.object({
  $type: z.literal("app.bsky.richtext.facet#link"),
  uri: z.url(),
});

const otherFeatureSchema = z.looseObject({
  $type: z.string().refine((value) => value !== "app.bsky.richtext.facet#link"),
});

const facetSchema = z.object({
  index: z.object({
    byteStart: z.number().int().nonnegative(),
    byteEnd: z.number().int().nonnegative(),
  }),
  features: z.array(z.union([uriFeatureSchema, otherFeatureSchema])),
});

const externalEmbedSchema = z.object({
  $type: z.literal("app.bsky.embed.external"),
  external: z.object({
    uri: z.url(),
    title: z.string().optional(),
    description: z.string().optional(),
  }),
});

const otherEmbedSchema = z.looseObject({
  $type: z.string().refine((value) => value !== "app.bsky.embed.external"),
});

export const postRecordSchema = z.object({
  $type: z.literal("app.bsky.feed.post").optional(),
  text: z.string(),
  createdAt: z.string(),
  facets: z.array(facetSchema).optional(),
  embed: z.union([externalEmbedSchema, otherEmbedSchema]).optional(),
});

export const jetstreamPostEventSchema = z.object({
  did: z.string().startsWith("did:"),
  time_us: z.number().int().nonnegative(),
  kind: z.literal("commit"),
  commit: z.object({
    rev: z.string(),
    operation: z.enum(["create", "update", "delete"]),
    collection: z.literal("app.bsky.feed.post"),
    rkey: z.string(),
    cid: z.string().optional(),
    record: postRecordSchema.optional(),
  }),
});

export type UriFeature = z.infer<typeof uriFeatureSchema>;
export type PostFacet = z.infer<typeof facetSchema>;
export type ExternalEmbed = z.infer<typeof externalEmbedSchema>;
export type PostRecord = z.infer<typeof postRecordSchema>;
export type JetstreamPostEvent = z.infer<typeof jetstreamPostEventSchema>;
export type StatsSummary = z.infer<typeof statsSummarySchema>;
export type VolumePoint = z.infer<typeof volumePointSchema>;
export type DomainCount = z.infer<typeof domainCountSchema>;
export type DashboardSnapshot = z.infer<typeof dashboardSnapshotSchema>;

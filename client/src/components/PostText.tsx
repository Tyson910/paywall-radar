import { useQuery } from "@tanstack/react-query";
import * as z from "zod";

const postThreadSchema = z.object({
  thread: z.object({
    post: z.object({
      record: z.object({ text: z.string() }),
    }),
  }),
});

export function PostText({ authorDid, uri }: { authorDid: string; uri: string }) {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0&parentHeight=0`;

  const query = useQuery({
    queryKey: [url, "post-text", authorDid],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) return null;
      const result = postThreadSchema.safeParse(await res.json());
      return result.success ? result.data.thread.post.record.text : null;
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (query.isPending) {
    return (
      <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
        <span className="inline-block h-3.5 w-48 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
      </p>
    );
  }

  if (!query.data) {
    return <p className="mt-2 text-sm italic text-neutral-400">Post unavailable</p>;
  }

  return (
    <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
      {query.data}
    </p>
  );
}

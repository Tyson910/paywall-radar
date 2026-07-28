export function blueskyPostUrl(authorDid: string, atUri: string): string {
  const rkey = atUri.split("/").at(-1);
  if (!rkey) {
    throw new Error(`Invalid post AT URI: ${atUri}`);
  }

  return `https://bsky.app/profile/${authorDid}/post/${encodeURIComponent(rkey)}`;
}

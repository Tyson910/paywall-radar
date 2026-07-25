export type DomainPattern = string;

export const paywalledDomainPatterns = [
  "barrons.com",
  "*.bloomberg.com",
  "economist.com",
  "*.ft.com",
  "foreignaffairs.com",
  "harpers.org",
  "latimes.com",
  "*.newyorker.com",
  "nymag.com",
  "nytimes.com",
  "*.nytimes.com",
  "theatlantic.com",
  "*.thetimes.com",
  "vanityfair.com",
  "washingtonpost.com",
  "wired.com",
  "wsj.com",
] as const;

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, "");
}

export function parseDomainPattern(input: string): DomainPattern {
  const pattern = normalizeHostname(input);
  const wildcard = pattern.startsWith("*.");
  const hostname = wildcard ? pattern.slice(2) : pattern;

  if (!hostname || hostname.includes("*") || !hostname.includes(".")) {
    throw new Error(`Invalid domain pattern: ${input}`);
  }

  return wildcard ? `*.${hostname}` : hostname;
}

export function parseDomainPatterns(patterns: Iterable<string>): DomainPattern[] {
  return Array.from(patterns, parseDomainPattern);
}

export function matchDomain(
  hostname: string,
  patterns: readonly DomainPattern[],
): DomainPattern | null {
  const candidate = normalizeHostname(hostname);

  for (const pattern of patterns) {
    if (candidate === pattern) {
      return pattern;
    }

    if (pattern.startsWith("*.")) {
      const apex = pattern.slice(2);
      if (candidate === apex || candidate.endsWith(`.${apex}`)) {
        return pattern;
      }
    }
  }

  return null;
}

export function matchUrl(value: string, patterns: readonly DomainPattern[]): DomainPattern | null {
  try {
    return matchDomain(new URL(value).hostname, patterns);
  } catch {
    return null;
  }
}

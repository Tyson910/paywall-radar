import { describe, expect, it } from "vitest";

import { matchDomain, matchUrl, parseDomainPattern, parseDomainPatterns } from "./domains.js";

describe("domain matching", () => {
  const patterns = parseDomainPatterns(["nytimes.com", "*.ft.com", "cooking.example.com"]);

  it("matches exact domains only", () => {
    expect(matchDomain("nytimes.com", patterns)).toBe("nytimes.com");
    expect(matchDomain("www.nytimes.com", patterns)).toBeNull();
  });

  it("matches wildcard apexes and subdomains", () => {
    expect(matchDomain("ft.com", patterns)).toBe("*.ft.com");
    expect(matchDomain("www.ft.com", patterns)).toBe("*.ft.com");
    expect(matchDomain("markets.us.ft.com", patterns)).toBe("*.ft.com");
  });

  it("does not allow suffix lookalikes", () => {
    expect(matchDomain("notft.com", patterns)).toBeNull();
    expect(matchDomain("ft.com.example.org", patterns)).toBeNull();
  });

  it("normalizes case and trailing dots", () => {
    expect(matchDomain("NYTIMES.COM.", patterns)).toBe("nytimes.com");
  });

  it("extracts hostnames from URLs safely", () => {
    expect(matchUrl("https://www.ft.com/content/123", patterns)).toBe("*.ft.com");
    expect(matchUrl("not a url", patterns)).toBeNull();
  });
});

describe("parseDomainPattern", () => {
  it("classifies supported patterns", () => {
    expect(parseDomainPattern("example.com")).toBe("example.com");
    expect(parseDomainPattern("*.example.com")).toBe("*.example.com");
  });

  it("rejects malformed patterns", () => {
    expect(() => parseDomainPattern("*example.com")).toThrow("Invalid domain pattern");
    expect(() => parseDomainPattern("localhost")).toThrow("Invalid domain pattern");
  });
});

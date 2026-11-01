import { describe, expect, it } from "vitest";
import {
  AUTH_COPY_PATHS,
  INDEXABLE_PATHS,
  NOINDEX_HEADER_SOURCES,
  ROBOTS_DISALLOW_PATHS,
  authMetadataForPath,
  buildLlmsTxt,
} from "./seo";

describe("SEO surfaces", () => {
  it("indexes only marketing and legal URLs", () => {
    expect([...INDEXABLE_PATHS]).toEqual([
      "/",
      "/en",
      "/como-funciona",
      "/en/how-it-works",
      "/precos",
      "/en/pricing",
      "/termos",
      "/privacidade",
    ]);
  });

  it("disallows app, share, and API prefixes without blocking login crawl", () => {
    expect(ROBOTS_DISALLOW_PATHS).toContain("/dashboard");
    expect(ROBOTS_DISALLOW_PATHS).toContain("/c/");
    expect(ROBOTS_DISALLOW_PATHS).toContain("/api/");
    expect(ROBOTS_DISALLOW_PATHS).not.toContain("/login");
    expect(ROBOTS_DISALLOW_PATHS).not.toContain("/signup");
    expect(ROBOTS_DISALLOW_PATHS).not.toContain("/");
  });

  it("sends noindex headers on auth, app, and share routes", () => {
    for (const source of ["/login", "/signup", "/dashboard/:path*", "/c/:path*", "/subscribe"]) {
      expect(NOINDEX_HEADER_SOURCES).toContain(source);
    }
  });

  it("gives login a private title instead of marketing copy", () => {
    const metadata = authMetadataForPath("/login", "pt-BR");
    expect(metadata.title).toBe("Entrar");
    expect(metadata.description).not.toMatch(/WhatsApp/i);
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it("covers every auth path used in the layout switch", () => {
    expect(AUTH_COPY_PATHS).toEqual([
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/invite",
    ]);
  });

  it("describes the product in llms.txt without listing private URLs as public", () => {
    const text = buildLlmsTxt("https://approoveapp.com");
    expect(text).toContain("https://approoveapp.com/");
    expect(text).toContain("/en");
    expect(text).toContain("/precos");
    expect(text).toContain("/como-funciona");
    expect(text).toContain("/termos");
    expect(text).toContain("Do not index");
    expect(text).toContain("/dashboard");
    expect(text).toContain("contato@approove.app");
  });
});

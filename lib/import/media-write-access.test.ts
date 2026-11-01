import { describe, expect, it } from "vitest";
import { mediaUrlSchema } from "../validation";
import { assertImportMediaOrganization } from "./media-write-access";
import { withImportMediaAccess } from "./private-media-url";

describe("private media editing", () => {
  const url = "/api/import-media/org/import-abc.png";
  it("accepts canonical own-tenant paths and existing HTTPS media", () => {
    for (const value of [url, "https://example.invalid/a.png"]) {
      expect(mediaUrlSchema.parse(value)).toBe(value);
      expect(() => assertImportMediaOrganization([value], "org")).not.toThrow();
    }
  });
  it("blocks foreign-tenant references before writes", () => {
    expect(() => assertImportMediaOrganization([url], "other")).toThrow("Mídia não encontrada");
  });
  it("does not persist share credentials, arbitrary relative paths or encoded traversal", () => {
    for (const value of [url + "?t=secret", "/api/import-media/org/../import-a.png", "/api/import-media/org/import-%2e.png", "//evil.invalid/a.png", "/public/a.png", "data:image/png,a", "http://example.invalid/a.png"]) {
      expect(mediaUrlSchema.safeParse(value).success).toBe(false);
    }
  });
  it("adds reviewer credentials only to private media in nested history and slides", () => {
    const source = { slides: [{ url }], history: [{ url }], external: "https://example.invalid/a.png" };
    const result = withImportMediaAccess(source, "a&b");
    expect(result.slides[0].url).toBe(url + "?t=a%26b");
    expect(result.history[0].url).toBe(url + "?t=a%26b");
    expect(result.external).toBe(source.external);
    expect(source.slides[0].url).toBe(url);
  });
});

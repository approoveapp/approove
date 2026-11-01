import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "./safe-redirect";
import { emailSchema, normalizeEmail, passwordSchema } from "./email-address";
import { generateLoginCode, generateShareToken, safeEqual, sha256 } from "./crypto-tokens";
import { sniffMedia } from "./file-sniff";
import { resolveDatabaseUrl } from "./prisma";
import { mediaUrlSchema, optionalLinkSchema, slugSchema } from "./validation";
import { localizeValidationMessage } from "./validation-messages";

describe("safeCallbackUrl", () => {
  it.each([
    ["/dashboard/clients?x=1", "/dashboard/clients?x=1"],
    ["/convite", "/convite"],
    ["https://evil.test/login", "/dashboard"],
    ["//evil.test", "/dashboard"],
    ["/\\evil.test", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["dashboard", "/dashboard"],
    [null, "/dashboard"],
  ])("%s -> %s", (input, expected) => {
    expect(safeCallbackUrl(input)).toBe(expected);
  });
});

describe("email and password rules", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeEmail("  Victim@Agency.COM ")).toBe("victim@agency.com");
    expect(emailSchema.parse(" Victim@Agency.COM")).toBe("victim@agency.com");
  });

  it("rejects passwords under 8 characters", () => {
    expect(passwordSchema.safeParse("1234567").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });

  it("keeps Portuguese messages and translates them for English requests", () => {
    const result = passwordSchema.safeParse("1234567");
    const message = result.success ? "" : result.error.issues[0].message;
    expect(localizeValidationMessage(message, "pt-BR")).toBe("Senha deve ter pelo menos 8 caracteres");
    expect(localizeValidationMessage(message, "en")).toBe("Password must be at least 8 characters.");
  });
});

describe("secrets", () => {
  it("share tokens carry 192 bits and are url-safe", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateShareToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("login codes are always 6 digits", () => {
    for (let i = 0; i < 500; i++) expect(generateLoginCode()).toMatch(/^\d{6}$/);
  });

  it("compares hashes in constant time", () => {
    expect(safeEqual(sha256("123456"), sha256("123456"))).toBe(true);
    expect(safeEqual(sha256("123456"), sha256("654321"))).toBe(false);
    expect(safeEqual("a", "ab")).toBe(false);
  });
});

describe("sniffMedia", () => {
  const bytes = (...parts: Array<string | number[]>) =>
    new Uint8Array(
      parts.flatMap((part) =>
        typeof part === "string" ? [...part].map((c) => c.charCodeAt(0)) : part
      ).concat(new Array(16).fill(0))
    );

  it("detects allowed formats by magic bytes", () => {
    expect(sniffMedia(bytes([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffMedia(bytes("\x89PNG\r\n\x1a\n"))?.mime).toBe("image/png");
    expect(sniffMedia(bytes("GIF89a"))?.mime).toBe("image/gif");
    expect(sniffMedia(bytes("RIFF", [0, 0, 0, 0], "WEBP"))?.mime).toBe("image/webp");
    expect(sniffMedia(bytes([0, 0, 0, 24], "ftypisom"))?.mime).toBe("video/mp4");
    expect(sniffMedia(bytes([0, 0, 0, 20], "ftypqt  "))?.mime).toBe("video/quicktime");
  });

  it("rejects SVG, HTML and anything unknown", () => {
    expect(sniffMedia(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(sniffMedia(bytes("<!doctype html><script>"))).toBeNull();
    expect(sniffMedia(bytes("%PDF-1.7"))).toBeNull();
    expect(sniffMedia(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("resolveDatabaseUrl", () => {
  const remote = "libsql://approove-prod.turso.io";

  it("blocks a remote database outside production", () => {
    expect(() => resolveDatabaseUrl({ NODE_ENV: "development", TURSO_DATABASE_URL: remote })).toThrow(
      /bloqueado/
    );
    expect(() => resolveDatabaseUrl({ NODE_ENV: "test", DATABASE_URL: remote })).toThrow(/bloqueado/);
  });

  it("allows production, explicit opt-in and local files", () => {
    expect(resolveDatabaseUrl({ NODE_ENV: "production", TURSO_DATABASE_URL: remote })).toBe(remote);
    expect(
      resolveDatabaseUrl({ NODE_ENV: "development", TURSO_DATABASE_URL: remote, ALLOW_REMOTE_DB: "1" })
    ).toBe(remote);
    expect(resolveDatabaseUrl({ NODE_ENV: "development", TURSO_DATABASE_URL: "file:./qa.db" })).toBe(
      "file:./qa.db"
    );
    expect(resolveDatabaseUrl({ NODE_ENV: "development", DATABASE_URL: "file:./dev.db" })).toBeUndefined();
  });
});

describe("input validation", () => {
  it("links accept only http(s)", () => {
    expect(optionalLinkSchema.parse("")).toBeNull();
    expect(optionalLinkSchema.parse("https://acme.com")).toBe("https://acme.com");
    expect(optionalLinkSchema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(optionalLinkSchema.safeParse("data:text/html,x").success).toBe(false);
  });

  it("media accepts only https", () => {
    expect(mediaUrlSchema.safeParse("https://x.public.blob.vercel-storage.com/a.png").success).toBe(true);
    expect(mediaUrlSchema.safeParse("http://x.test/a.png").success).toBe(false);
    expect(mediaUrlSchema.safeParse("data:image/png;base64,AAA").success).toBe(false);
  });

  it("slugs are lowercase kebab-case", () => {
    expect(slugSchema.parse("Acme-Corp")).toBe("acme-corp");
    expect(slugSchema.safeParse("acme corp").success).toBe(false);
    expect(slugSchema.safeParse("../etc").success).toBe(false);
  });
});

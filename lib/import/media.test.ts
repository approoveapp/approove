import { describe, expect, it } from "vitest";
import { importMediaPathname, isOwnImportMediaUrl } from "./media";

const blob = "https://abc123.public.blob.vercel-storage.com";

describe("import media URLs", () => {
  it("keeps every upload under the organization's folder", () => {
    expect(importMediaPathname("org1", "jpg")).toMatch(/^uploads\/org1\/import-\d+-[\w-]+\.jpg$/);
  });

  it("accepts only this organization's import uploads", () => {
    expect(isOwnImportMediaUrl("/api/import-media/org1/import-1-a.jpg", "org1")).toBe(true);
    expect(isOwnImportMediaUrl("/api/import-media/org1/import-1-a.mp4", "org1")).toBe(true);

    expect(isOwnImportMediaUrl(`${blob}/uploads/org2/import-1-a.jpg`, "org1")).toBe(false);
    // Upload comum da agência (fora da importação) não entra por aqui.
    expect(isOwnImportMediaUrl(`${blob}/uploads/org1/1-a.jpg`, "org1")).toBe(false);
    expect(isOwnImportMediaUrl("https://evil.test/uploads/org1/import-1-a.jpg", "org1")).toBe(false);
    expect(isOwnImportMediaUrl(`http://abc.public.blob.vercel-storage.com/uploads/org1/import-1.jpg`, "org1")).toBe(false);
    expect(isOwnImportMediaUrl("/dev-uploads/uploads/org1/import-../../x", "org1")).toBe(false);
    expect(isOwnImportMediaUrl("javascript:alert(1)", "org1")).toBe(false);
  });
});

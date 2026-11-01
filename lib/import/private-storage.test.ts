import { afterEach, describe, expect, it, vi } from "vitest";
const blob = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), del: vi.fn(), list: vi.fn() }));
vi.mock("@vercel/blob", () => blob);
import { storeMedia, readDevMedia, deleteMedia } from "../media-storage";
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe("private Blob contract without network", () => {
  const pathname = "uploads/org/import-abc.png";
  const url = "/api/import-media/org/import-abc.png";
  it("writes private bytes and returns only the authenticated application URL", async () => {
    vi.stubEnv("IMPORT_BLOB_READ_WRITE_TOKEN", "synthetic-test-token");
    blob.put.mockResolvedValue({ url: "https://unused.invalid/private" });
    expect(await storeMedia(pathname, new Uint8Array([1, 2]), "image/png")).toBe(url);
    expect(blob.put).toHaveBeenCalledWith(pathname, expect.any(Buffer), expect.objectContaining({ access: "private", token: "synthetic-test-token", addRandomSuffix: false }));
  });
  it("reads private paths without fetching arbitrary URLs and rejects oversized metadata", async () => {
    vi.stubEnv("IMPORT_BLOB_READ_WRITE_TOKEN", "synthetic-test-token");
    blob.get.mockResolvedValue({ statusCode: 200, blob: { size: 2 }, stream: new Response(new Uint8Array([1,2])).body });
    expect(await readDevMedia(url)).toEqual(Buffer.from([1, 2]));
    expect(blob.get).toHaveBeenCalledWith(pathname, expect.objectContaining({ access: "private" }));
    blob.get.mockClear();
    expect(await readDevMedia("https://external.invalid/x.png")).toBeNull();
    expect(blob.get).not.toHaveBeenCalled();
    blob.get.mockResolvedValue({ statusCode: 200, blob: { size: 4 * 1024 * 1024 + 1 } });
    expect(await readDevMedia(url)).toBeNull();
  });
  it("fails closed in production without the dedicated private store", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("IMPORT_BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "synthetic-public-store-token");
    await expect(storeMedia(pathname, new Uint8Array([1]), "image/png")).rejects.toThrow("IMPORT_BLOB_READ_WRITE_TOKEN");
    expect(await readDevMedia(url)).toBeNull();
    expect(blob.put).not.toHaveBeenCalled(); expect(blob.get).not.toHaveBeenCalled();
  });
  it("never deletes an arbitrary URL in the private store", async () => {
    vi.stubEnv("IMPORT_BLOB_READ_WRITE_TOKEN", "synthetic-test-token");
    await deleteMedia(["https://external.invalid/a.png", url]);
    expect(blob.del).toHaveBeenCalledWith([pathname], { token: "synthetic-test-token" });
  });
});

import { expect, it } from "vitest";
import { boundedImportBody, boundedImportFormData } from "./request";
it("rejects a chunked oversized body without trusting Content-Length", async () => {
  const request = new Request("http://localhost", { method: "POST", body: new Uint8Array(1025) });
  await expect(boundedImportBody(request, 1024)).rejects.toMatchObject({ status: 413 });
});
it("accepts exactly the byte limit", async () => {
  expect((await boundedImportBody(new Request("http://localhost", { method: "POST", body: new Uint8Array(1024) }), 1024)).length).toBe(1024);
});
it("returns a client error for malformed multipart", async () => {
  await expect(boundedImportFormData(new Request("http://localhost", { method: "POST", body: "bad" }), 100)).rejects.toMatchObject({ status: 400 });
});

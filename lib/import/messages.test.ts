import { describe, expect, it } from "vitest";
import { IMPORT_JOB_ERRORS, importJobError, localizeImportJobError } from "./messages";

describe("persisted job error localization", () => {
  it("renders fixed texts in the viewer's locale, including legacy Portuguese rows", () => {
    const [pt, en] = IMPORT_JOB_ERRORS.interrupted;
    expect(importJobError("interrupted", "pt-BR")).toBe(pt);
    expect(localizeImportJobError(pt, "en")).toBe(en);
    expect(localizeImportJobError(en, "pt-BR")).toBe(pt);
    expect(localizeImportJobError(IMPORT_JOB_ERRORS.interruptedByCleanup[0], "en")).toBe(IMPORT_JOB_ERRORS.interruptedByCleanup[1]);
  });
  it("keeps parameterized or unknown texts as stored", () => {
    expect(localizeImportJobError("\"a.csv\": o arquivo não tem texto.", "en")).toBe("\"a.csv\": o arquivo não tem texto.");
    expect(localizeImportJobError(null, "en")).toBeNull();
  });
});

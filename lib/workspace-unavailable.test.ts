import { describe, expect, it } from "vitest";
import {
  WORKSPACE_UNAVAILABLE_CODE,
  WORKSPACE_UNAVAILABLE_MESSAGE,
  workspaceUnavailableMessage,
} from "./workspace-unavailable";

describe("public workspace copy", () => {
  it("does not expose billing or Stripe language", () => {
    expect(WORKSPACE_UNAVAILABLE_CODE).toBe("WORKSPACE_UNAVAILABLE");
    for (const message of [WORKSPACE_UNAVAILABLE_MESSAGE, workspaceUnavailableMessage("en")]) {
      expect(message.toLowerCase()).not.toMatch(
        /stripe|cartão|assinatura|pagamento|cobrança|subscription|billing|card|payment/
      );
    }
    expect(workspaceUnavailableMessage("pt-BR")).toBe(WORKSPACE_UNAVAILABLE_MESSAGE);
  });
});

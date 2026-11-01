import { describe, expect, it } from "vitest";
import { getPlanLimit, planAllows, PLAN_LIMITS, planLimitResponse } from "./plan-limits";

describe("plan limits v2", () => {
  it("makes reviewers unlimited on every paid plan and free/trial", () => {
    expect(PLAN_LIMITS.free.reviewers).toBeNull();
    expect(PLAN_LIMITS.solo.reviewers).toBeNull();
    expect(PLAN_LIMITS.starter.reviewers).toBeNull();
    expect(PLAN_LIMITS.pro.reviewers).toBeNull();
    expect(PLAN_LIMITS.studio.reviewers).toBeNull();
    expect(planAllows("starter", "reviewers", 10)).toBe(true);
    expect(planAllows("starter", "reviewers", 99)).toBe(true);
    expect(planAllows("pro", "reviewers", 100)).toBe(true);
    expect(planAllows("studio", "reviewers", 100)).toBe(true);
  });

  it("enforces Solo as the entry cap, with singular member wording", () => {
    expect(getPlanLimit("solo", "clients")).toBe(2);
    expect(getPlanLimit("solo", "members")).toBe(1);
    expect(planAllows("solo", "clients", 2)).toBe(false);
    expect(planAllows("solo", "clients", 1)).toBe(true);
    expect(planAllows("solo", "members", 1)).toBe(false);
    expect(planAllows("solo", "reviewers", 40)).toBe(true);

    const response = planLimitResponse("solo", "members", 1, "pt-BR");
    expect(response.error).toContain("1 usuário da agência");
    expect(response.error).not.toContain("usuários");
  });

  it("enforces Starter client and member caps", () => {
    expect(getPlanLimit("starter", "clients")).toBe(5);
    expect(getPlanLimit("starter", "members")).toBe(2);
    expect(planAllows("starter", "clients", 5)).toBe(false);
    expect(planAllows("starter", "clients", 4)).toBe(true);
    expect(planAllows("starter", "members", 2)).toBe(false);
    expect(planAllows("starter", "members", 1)).toBe(true);
  });

  it("enforces Pro and Studio scale caps", () => {
    expect(planAllows("pro", "clients", 15)).toBe(false);
    expect(planAllows("pro", "members", 5)).toBe(false);
    expect(planAllows("studio", "clients", 40)).toBe(false);
    expect(planAllows("studio", "members", 15)).toBe(false);
    expect(planAllows("pro", "clients", 14)).toBe(true);
    expect(planAllows("studio", "members", 14)).toBe(true);
  });

  it("returns a specific upgrade message for client limits", () => {
    const response = planLimitResponse("starter", "clients", 5, "pt-BR");
    expect(response.code).toBe("PLAN_LIMIT_REACHED");
    expect(response.error).toContain("5");
    expect(response.error).toContain("Starter");
    expect(response.upgradePath).toBe("/dashboard/settings");
  });

  it("answers in English for English requests", () => {
    expect(planLimitResponse("starter", "clients", 5, "en").error).toBe(
      "Your Starter plan allows up to 5 clients."
    );
    expect(planLimitResponse("solo", "members", 1, "en").error).toBe(
      "Your Solo plan allows up to 1 agency user."
    );
  });
});

describe("free fallback", () => {
  it("allows nothing new without a trial or subscription", () => {
    expect(planAllows("free", "clients", 0)).toBe(false);
    expect(planAllows("free", "members", 1)).toBe(false);
  });
});

describe("AI import quota", () => {
  it("scales monthly imports with the plan and blocks free orgs", () => {
    expect(getPlanLimit("free", "aiImports")).toBe(0);
    expect(planAllows("solo", "aiImports", 3)).toBe(true);
    expect(planAllows("solo", "aiImports", 4)).toBe(false);
    expect(getPlanLimit("starter", "aiImports")).toBe(10);
    expect(getPlanLimit("pro", "aiImports")).toBe(30);
    expect(getPlanLimit("studio", "aiImports")).toBe(80);
    expect(planAllows("enterprise", "aiImports", 10_000)).toBe(true);
    expect(planLimitResponse("pro", "aiImports", 30, "pt-BR").error).toBe(
      "Seu plano Pro permite até 30 importações com IA por mês."
    );
  });
});

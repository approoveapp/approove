import { describe, expect, it } from "vitest";
import { localeFromRequest } from "./locale";
import { currencyForLocale, PLAN_AMOUNTS, planPrice } from "./pricing";

describe("BRL checkout locale", () => {
  it("uses pt-BR and BRL amounts when the request is from Brazil", () => {
    const locale = localeFromRequest({ country: "BR", acceptLanguage: "en-US" });
    expect(locale).toBe("pt-BR");
    expect(currencyForLocale(locale)).toBe("brl");
    expect(planPrice("solo", locale).price).toContain("97");
    expect(planPrice("starter", locale).price).toContain("197");
    expect(planPrice("pro", locale).price).toContain("397");
    expect(planPrice("studio", locale).price).toContain("797");
    expect(PLAN_AMOUNTS.pro.brl).toBe(39700);
    expect(PLAN_AMOUNTS.studio.brl).toBe(79700);
  });
});

describe("chosen language", () => {
  it("wins over country and browser language", () => {
    expect(localeFromRequest({ override: "en", country: "BR", acceptLanguage: "pt-BR" })).toBe("en");
    expect(localeFromRequest({ override: "pt", country: "US", acceptLanguage: "en-US" })).toBe("pt-BR");
  });

  it("ignores values it does not know", () => {
    expect(localeFromRequest({ override: "fr", country: "BR" })).toBe("pt-BR");
    expect(localeFromRequest({ override: "", country: "US" })).toBe("en");
  });
});

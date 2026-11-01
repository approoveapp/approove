import { describe, expect, it } from "vitest";
import {
  localeFromRequest,
  marketingLocaleFromPath,
  persistableMarketingLocale,
} from "./locale";
import { currencyForLocale, PLAN_AMOUNTS, planPrice } from "./pricing";
import { marketingHomeMetadata } from "./seo";

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

describe("marketing locale URLs", () => {
  it("locks / to Portuguese and /en to English", () => {
    expect(marketingLocaleFromPath("/")).toBe("pt-BR");
    expect(marketingLocaleFromPath("/termos")).toBe("pt-BR");
    expect(marketingLocaleFromPath("/precos")).toBe("pt-BR");
    expect(marketingLocaleFromPath("/como-funciona")).toBe("pt-BR");
    expect(marketingLocaleFromPath("/en")).toBe("en");
    expect(marketingLocaleFromPath("/en/pricing")).toBe("en");
    expect(marketingLocaleFromPath("/dashboard")).toBeNull();
    expect(persistableMarketingLocale("/termos")).toBeNull();
    expect(persistableMarketingLocale("/")).toBe("pt-BR");
    expect(persistableMarketingLocale("/precos")).toBe("pt-BR");
    expect(persistableMarketingLocale("/en")).toBe("en");
    expect(persistableMarketingLocale("/en/pricing")).toBe("en");
  });

  it("emits hreflang between / and /en", () => {
    const pt = marketingHomeMetadata("pt-BR", "https://approoveapp.com");
    const en = marketingHomeMetadata("en", "https://approoveapp.com");
    expect(pt.alternates?.canonical).toBe("https://approoveapp.com/");
    expect(en.alternates?.canonical).toBe("https://approoveapp.com/en");
    expect(pt.alternates?.languages).toMatchObject({
      "pt-BR": "https://approoveapp.com/",
      en: "https://approoveapp.com/en",
      "x-default": "https://approoveapp.com/",
    });
    expect(pt.title).toEqual({ absolute: "Approove - Aprovação de conteúdo para agências" });
    expect(en.title).toEqual({
      absolute: "Content approval software for agencies | Approove",
    });
    expect(en.description).toMatch(/Content approval software for agencies/i);
  });
});

import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/app-url";
import { MARKETING_PATHS } from "@/lib/marketing-routes";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppBaseUrl();
  const pair = (ptPath: string, enPath: string) => {
    const pt = `${base}${ptPath === "/" ? "/" : ptPath}`;
    const en = `${base}${enPath}`;
    return { pt, en, languages: { "pt-BR": pt, en } };
  };

  const home = pair(MARKETING_PATHS.home["pt-BR"], MARKETING_PATHS.home.en);
  const how = pair(MARKETING_PATHS.how["pt-BR"], MARKETING_PATHS.how.en);
  const pricing = pair(MARKETING_PATHS.pricing["pt-BR"], MARKETING_PATHS.pricing.en);

  return [
    {
      url: home.pt,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
      alternates: { languages: home.languages },
    },
    {
      url: home.en,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: { languages: home.languages },
    },
    {
      url: how.pt,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: { languages: how.languages },
    },
    {
      url: how.en,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: { languages: how.languages },
    },
    {
      url: pricing.pt,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
      alternates: { languages: pricing.languages },
    },
    {
      url: pricing.en,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: { languages: pricing.languages },
    },
    {
      url: `${base}/termos`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/privacidade`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}

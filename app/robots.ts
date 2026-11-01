import type { MetadataRoute } from "next";
import { getAppBaseUrl } from "@/lib/app-url";
import { ROBOTS_DISALLOW_PATHS } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getAppBaseUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [...ROBOTS_DISALLOW_PATHS],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}

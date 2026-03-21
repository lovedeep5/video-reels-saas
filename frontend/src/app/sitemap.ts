import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://vidtoreels.com";

  return [
    { url: base, lastModified: "2026-03-21", changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/docs`, lastModified: "2026-03-18", changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/privacy`, lastModified: "2026-03-20", changeFrequency: "monthly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: "2026-03-20", changeFrequency: "monthly", priority: 0.3 },
  ];
}

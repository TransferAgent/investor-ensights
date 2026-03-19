import type { MetadataRoute } from "next"
import { storage } from "@/lib/storage"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://yourcompany.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cities, pages, articles] = await Promise.all([
    storage.getCities(true),
    storage.getPages(),
    storage.getKnowledgeArticles("published"),
  ])

  const cityEntries: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${BASE_URL}/locations/${city.slug}`,
    lastModified: city.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  const pageEntries: MetadataRoute.Sitemap = pages
    .filter((p) => p.isPublished)
    .map((page) => ({
      url: `${BASE_URL}/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))

  const articleEntries: MetadataRoute.Sitemap = articles.map((article) => ({
    url: `${BASE_URL}/discovery/knowledge/${article.slug}`,
    lastModified: article.dateModified,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    },
    ...cityEntries,
    ...pageEntries,
    ...articleEntries,
  ]
}

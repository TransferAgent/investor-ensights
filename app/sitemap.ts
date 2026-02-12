import type { MetadataRoute } from "next"
import { storage } from "@/lib/storage"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://yourcompany.com"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cities = await storage.getCities(true)

  const cityEntries: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${BASE_URL}/locations/${city.slug}`,
    lastModified: city.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }))

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 1,
    },
    ...cityEntries,
  ]
}

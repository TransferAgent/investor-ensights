import type { MetadataRoute } from "next"
import { storage } from "@/lib/storage"

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com").replace(/\/$/, "")

export const revalidate = 300

const STATIC_LASTMOD = new Date("2026-05-06T00:00:00.000Z")

function maxDate(dates: Array<Date | string | null | undefined>): Date {
  let max = 0
  for (const d of dates) {
    if (!d) continue
    const t = new Date(d).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  return max > 0 ? new Date(max) : STATIC_LASTMOD
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let cities: Awaited<ReturnType<typeof storage.getCities>> = []
  let pages: Awaited<ReturnType<typeof storage.getPages>> = []
  let articles: Awaited<ReturnType<typeof storage.getKnowledgeArticles>> = []

  try {
    ;[cities, pages, articles] = await Promise.all([
      storage.getCities(true),
      storage.getPages(),
      storage.getKnowledgeArticles("published"),
    ])
  } catch {
    // On DB failure, ship a minimal sitemap rather than 500ing Googlebot.
  }

  const cityEntries: MetadataRoute.Sitemap = cities
    .filter((c) => c.allowIndexing !== false)
    .map((city) => ({
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

  const articleEntries: MetadataRoute.Sitemap = articles
    .filter((a) => !String(a.robots || "").toLowerCase().includes("noindex"))
    .map((article) => ({
      url: `${BASE_URL}/discovery/knowledge/${article.slug}`,
      lastModified: article.dateModified,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/terms`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/site-map`,
      lastModified: STATIC_LASTMOD,
      changeFrequency: "weekly" as const,
      priority: 0.4,
    },
  ]

  const homeLastMod = maxDate([
    ...cities.map((c) => c.updatedAt),
    ...articles.map((a) => a.dateModified),
    ...pages.map((p) => p.updatedAt),
  ])

  return [
    {
      url: BASE_URL,
      lastModified: homeLastMod,
      changeFrequency: "daily" as const,
      priority: 1,
    },
    ...staticEntries,
    ...cityEntries,
    ...pageEntries,
    ...articleEntries,
  ]
}

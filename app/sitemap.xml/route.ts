import { storage } from "@/lib/storage"
import { withTenantAsync } from "@/lib/tenant/context"
import { getPublicTenants } from "@/lib/tenant/public-tenants"

const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com").replace(/\/$/, "")

const STATIC_LASTMOD = new Date("2026-05-06T00:00:00.000Z")

export const revalidate = 300
export const dynamic = "force-static"

type Entry = {
  loc: string
  lastmod: Date
  changefreq: "daily" | "weekly" | "monthly" | "yearly"
  priority: number
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function toIsoDate(d: Date | string | null | undefined): string {
  if (!d) return STATIC_LASTMOD.toISOString()
  const t = new Date(d)
  return Number.isFinite(t.getTime()) ? t.toISOString() : STATIC_LASTMOD.toISOString()
}

function maxDate(dates: Array<Date | string | null | undefined>): Date {
  let max = 0
  for (const d of dates) {
    if (!d) continue
    const t = new Date(d).getTime()
    if (Number.isFinite(t) && t > max) max = t
  }
  return max > 0 ? new Date(max) : STATIC_LASTMOD
}

function renderXml(entries: Entry[]): string {
  const urls = entries
    .map(
      (e) =>
        `  <url>\n` +
        `    <loc>${xmlEscape(e.loc)}</loc>\n` +
        `    <lastmod>${toIsoDate(e.lastmod)}</lastmod>\n` +
        `    <changefreq>${e.changefreq}</changefreq>\n` +
        `    <priority>${e.priority.toFixed(1)}</priority>\n` +
        `  </url>`,
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

interface TenantData {
  slug: string
  cities: Awaited<ReturnType<typeof storage.getCities>>
  articles: Awaited<ReturnType<typeof storage.getKnowledgeArticles>>
}

async function buildEntries(): Promise<Entry[]> {
  // Multi-tenant aware: loop every public tenant and aggregate.
  let pages: Awaited<ReturnType<typeof storage.getPages>> = []
  let tenantData: TenantData[] = []

  try {
    const publicTenants = await getPublicTenants()
    const [pagesResult, ...perTenant] = await Promise.all([
      storage.getPages().catch(() => []),
      ...publicTenants.map(async (t): Promise<TenantData> => {
        const [cities, articles] = await withTenantAsync(t.slug, () =>
          Promise.all([
            storage.getCities(true).catch(() => []),
            storage.getKnowledgeArticles("published").catch(() => []),
          ]),
        )
        return { slug: t.slug, cities, articles }
      }),
    ])
    pages = pagesResult as typeof pages
    tenantData = perTenant as TenantData[]
  } catch {
    // On DB failure, ship a minimal sitemap rather than 500ing Googlebot.
  }

  const allCities = tenantData.flatMap((t) => t.cities)
  const allArticles = tenantData.flatMap((t) => t.articles)

  // Per-city URLs (global namespace, deduped by slug just in case).
  const cityEntries: Entry[] = []
  const seenCitySlugs = new Set<string>()
  for (const city of allCities) {
    if (city.allowIndexing === false) continue
    if (seenCitySlugs.has(city.slug)) continue
    seenCitySlugs.add(city.slug)
    cityEntries.push({
      loc: `${BASE_URL}/locations/${city.slug}`,
      lastmod: city.updatedAt as Date,
      changefreq: "weekly",
      priority: 0.8,
    })
  }

  const pageEntries: Entry[] = pages
    .filter((p) => p.isPublished)
    .map((page) => ({
      loc: `${BASE_URL}/${page.slug}`,
      lastmod: page.updatedAt as Date,
      changefreq: "weekly",
      priority: 0.7,
    }))

  // Per-article URLs (slugs are globally unique by persona-prefix construction).
  const seenArticleSlugs = new Set<string>()
  const articleEntries: Entry[] = []
  for (const article of allArticles) {
    if (String(article.robots || "").toLowerCase().includes("noindex")) continue
    if (seenArticleSlugs.has(article.slug)) continue
    seenArticleSlugs.add(article.slug)
    articleEntries.push({
      loc: `${BASE_URL}/discovery/knowledge/${article.slug}`,
      lastmod: article.dateModified as Date,
      changefreq: "weekly",
      priority: 0.7,
    })
  }

  // Per-persona sub-hub URLs — one /personas/<slug>/locations and one
  // /personas/<slug>/insights for every public tenant. These hubs are the
  // primary internal-link spine that flows equity from home to leaf pages.
  const personaHubEntries: Entry[] = tenantData.flatMap((t) => [
    {
      loc: `${BASE_URL}/personas/${t.slug}/locations`,
      lastmod: maxDate(t.cities.map((c) => c.updatedAt)),
      changefreq: "daily" as const,
      priority: 0.85,
    },
    {
      loc: `${BASE_URL}/personas/${t.slug}/insights`,
      lastmod: maxDate(t.articles.map((a) => a.dateModified)),
      changefreq: "daily" as const,
      priority: 0.85,
    },
  ])

  const staticEntries: Entry[] = [
    { loc: `${BASE_URL}/locations`, lastmod: maxDate(allCities.map((c) => c.updatedAt)), changefreq: "daily", priority: 0.9 },
    { loc: `${BASE_URL}/discovery/knowledge`, lastmod: maxDate(allArticles.map((a) => a.dateModified)), changefreq: "daily", priority: 0.9 },
    { loc: `${BASE_URL}/about`, lastmod: STATIC_LASTMOD, changefreq: "monthly", priority: 0.5 },
    { loc: `${BASE_URL}/terms`, lastmod: STATIC_LASTMOD, changefreq: "yearly", priority: 0.3 },
    { loc: `${BASE_URL}/privacy`, lastmod: STATIC_LASTMOD, changefreq: "yearly", priority: 0.3 },
    { loc: `${BASE_URL}/site-map`, lastmod: STATIC_LASTMOD, changefreq: "weekly", priority: 0.4 },
  ]

  const homeLastMod = maxDate([
    ...allCities.map((c) => c.updatedAt),
    ...allArticles.map((a) => a.dateModified),
    ...pages.map((p) => p.updatedAt),
  ])

  return [
    { loc: BASE_URL, lastmod: homeLastMod, changefreq: "daily", priority: 1.0 },
    ...staticEntries,
    ...personaHubEntries,
    ...cityEntries,
    ...pageEntries,
    ...articleEntries,
  ]
}

export async function GET(): Promise<Response> {
  const entries = await buildEntries()
  const body = renderXml(entries)

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      "X-Robots-Tag": "noindex",
      "Vary": "Accept-Encoding",
    },
  })
}

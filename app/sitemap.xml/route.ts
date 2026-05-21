import { storage } from "@/lib/storage"

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

async function buildEntries(): Promise<Entry[]> {
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

  const cityEntries: Entry[] = cities
    .filter((c) => c.allowIndexing !== false)
    .map((city) => ({
      loc: `${BASE_URL}/locations/${city.slug}`,
      lastmod: city.updatedAt as Date,
      changefreq: "weekly",
      priority: 0.8,
    }))

  const pageEntries: Entry[] = pages
    .filter((p) => p.isPublished)
    .map((page) => ({
      loc: `${BASE_URL}/${page.slug}`,
      lastmod: page.updatedAt as Date,
      changefreq: "weekly",
      priority: 0.7,
    }))

  const articleEntries: Entry[] = articles
    .filter((a) => !String(a.robots || "").toLowerCase().includes("noindex"))
    .map((article) => ({
      loc: `${BASE_URL}/discovery/knowledge/${article.slug}`,
      lastmod: article.dateModified as Date,
      changefreq: "weekly",
      priority: 0.7,
    }))

  const staticEntries: Entry[] = [
    { loc: `${BASE_URL}/locations`, lastmod: maxDate(cities.map((c) => c.updatedAt)), changefreq: "daily", priority: 0.9 },
    { loc: `${BASE_URL}/terms`, lastmod: STATIC_LASTMOD, changefreq: "yearly", priority: 0.3 },
    { loc: `${BASE_URL}/privacy`, lastmod: STATIC_LASTMOD, changefreq: "yearly", priority: 0.3 },
    { loc: `${BASE_URL}/site-map`, lastmod: STATIC_LASTMOD, changefreq: "weekly", priority: 0.4 },
  ]

  const homeLastMod = maxDate([
    ...cities.map((c) => c.updatedAt),
    ...articles.map((a) => a.dateModified),
    ...pages.map((p) => p.updatedAt),
  ])

  return [
    { loc: BASE_URL, lastmod: homeLastMod, changefreq: "daily", priority: 1.0 },
    ...staticEntries,
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

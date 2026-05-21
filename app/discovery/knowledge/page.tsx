import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Newspaper, MapPin, Calendar, Lock } from "lucide-react"
import { storage } from "@/lib/storage"
import ArticleGrid, { type ArticleWithCity } from "./article-grid"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"

export const metadata: Metadata = {
  title: "Insights by City | Investor Ensights",
  description:
    "Browse Investor Ensights' ground-truth coverage of local company formation and equity activity, organized by city across the US.",
  alternates: { canonical: `${BASE_URL}/discovery/knowledge` },
}

export default async function InsightsHubPage() {
  // Two-gate model identical to /locations:
  //   1. Article must be status='published' AND not robots:noindex.
  //   2. Article's city must be Publish=true AND Index=true.
  // If either gate fails, the article is excluded from this hub so we never
  // surface a homepage→hub→article link that contradicts the city's toggles.
  const [articlesRaw, citiesRaw] = await Promise.all([
    storage.getKnowledgeArticles("published"),
    storage.getCities(true),
  ])

  const publicCityMap = new Map(
    citiesRaw
      .filter((c) => c.allowIndexing === true)
      .map((c) => [c.slug, c] as const)
  )

  const articles: ArticleWithCity[] = articlesRaw
    .filter((a) => !String(a.robots || "").toLowerCase().includes("noindex"))
    .filter((a) => a.citySlug && publicCityMap.has(a.citySlug))
    .map((a) => {
      const city = publicCityMap.get(a.citySlug as string)!
      return {
        id: a.id,
        slug: a.slug,
        title: a.headline || a.title,
        citySlug: city.slug,
        cityName: city.cityName,
        stateCode: city.stateCode,
        stateName: city.stateName || city.stateCode,
        datePublished: a.datePublished ? a.datePublished.toISOString() : null,
      }
    })
    .sort((a, b) => {
      const ta = a.datePublished ? new Date(a.datePublished).getTime() : 0
      const tb = b.datePublished ? new Date(b.datePublished).getTime() : 0
      return tb - ta
    })

  const cityCoverageCount = new Set(articles.map((a) => a.citySlug)).size

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-visible bg-primary py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl"
            data-testid="text-hero-title"
          >
            Insights, City by City
          </h1>
          <h2 className="mx-auto mb-8 max-w-2xl text-lg text-primary-foreground/80 md:text-xl font-normal">
            Ground-truth coverage of company formation and equity activity for institutional and retail investors.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Badge variant="secondary" className="text-sm">
              <Newspaper className="mr-1.5 h-3.5 w-3.5" />
              {articles.length} {articles.length === 1 ? "Insight" : "Insights"}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              {cityCoverageCount} {cityCoverageCount === 1 ? "City" : "Cities"} Covered
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              Updated Daily
            </Badge>
          </div>
        </div>
      </section>

      <ArticleGrid articles={articles} />

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Investor Ensights. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-home"
            >
              Home
            </Link>
            <Link
              href="/locations"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-locations"
            >
              Locations
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-admin-login"
            >
              <Lock className="h-3.5 w-3.5" />
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

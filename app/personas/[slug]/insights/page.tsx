import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Newspaper, MapPin, Calendar, Lock, ArrowLeft } from "lucide-react"
import { storage } from "@/lib/storage"
import { withTenantAsync } from "@/lib/tenant/context"
import { getPublicTenants } from "@/lib/tenant/public-tenants"
import ArticleGrid, { type ArticleWithCity } from "../../../discovery/knowledge/article-grid"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"

export async function generateStaticParams() {
  const tenants = await getPublicTenants()
  return tenants.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const tenants = await getPublicTenants()
  const tenant = tenants.find((t) => t.slug === slug)
  if (!tenant) return { title: "Persona Not Found" }
  return {
    title: `${tenant.personaDisplayName} — Insights by City | Investor Ensights`,
    description:
      tenant.brandTagline ||
      `Browse ${tenant.personaDisplayName} insights on local company formation and equity activity, organized by city.`,
    alternates: { canonical: `${BASE_URL}/personas/${tenant.slug}/insights` },
  }
}

export default async function PersonaInsightsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tenants = await getPublicTenants()
  const tenant = tenants.find((t) => t.slug === slug)
  if (!tenant) notFound()

  type Orphan = {
    id: string
    slug: string
    title: string
    datePublished: string | null
  }

  const { articles, orphans, cityCount } = await withTenantAsync(tenant.slug, async () => {
    const [articlesRaw, citiesRaw] = await Promise.all([
      storage.getKnowledgeArticles("published"),
      storage.getCities(true),
    ])
    const publicCityMap = new Map(
      citiesRaw.filter((c) => c.allowIndexing === true).map((c) => [c.slug, c] as const),
    )
    const indexable = articlesRaw.filter(
      (a) => !String(a.robots || "").toLowerCase().includes("noindex"),
    )
    const enriched: ArticleWithCity[] = indexable
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
    const orphanList: Orphan[] = indexable
      .filter((a) => a.citySlug && !publicCityMap.has(a.citySlug))
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.headline || a.title,
        datePublished: a.datePublished ? a.datePublished.toISOString() : null,
      }))
      .sort((a, b) => {
        const ta = a.datePublished ? new Date(a.datePublished).getTime() : 0
        const tb = b.datePublished ? new Date(b.datePublished).getTime() : 0
        return tb - ta
      })
    return { articles: enriched, orphans: orphanList, cityCount: publicCityMap.size }
  })

  const cityCoverageCount = new Set(articles.map((a) => a.citySlug)).size
  const totalInsightCount = articles.length + orphans.length

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-visible bg-primary py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <p
            className="mb-3 text-sm font-medium uppercase tracking-wider text-primary-foreground/70"
            data-testid="text-persona-eyebrow"
          >
            {tenant.personaDisplayName}
          </p>
          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl"
            data-testid="text-hero-title"
          >
            {tenant.personaDisplayName} Insights, City by City
          </h1>
          <h2 className="mx-auto mb-8 max-w-2xl text-lg text-primary-foreground/80 md:text-xl font-normal">
            {tenant.brandTagline ||
              "Ground-truth coverage of company formation and equity activity for institutional and retail investors."}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Badge variant="secondary" className="text-sm">
              <Newspaper className="mr-1.5 h-3.5 w-3.5" />
              {totalInsightCount} {totalInsightCount === 1 ? "Insight" : "Insights"}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              {cityCoverageCount} of {cityCount} {cityCount === 1 ? "City" : "Cities"} Covered
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              Updated Daily
            </Badge>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pt-6">
        <Link
          href="/discovery/knowledge"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="link-back-to-directory"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All insights
        </Link>
      </div>

      <ArticleGrid articles={articles} />

      {orphans.length > 0 && (
        <section
          className="border-t bg-muted/20"
          aria-labelledby="orphan-insights-heading"
          data-testid="section-orphan-insights"
        >
          <div className="mx-auto max-w-6xl px-4 py-10">
            <h2
              id="orphan-insights-heading"
              className="text-2xl font-bold tracking-tight"
              data-testid="text-orphan-heading"
            >
              Our Insights (All)
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Additional {tenant.personaDisplayName} insights not yet tied to a published city page.
            </p>
            <p className="mt-3 text-xs text-muted-foreground" data-testid="text-orphan-count">
              {orphans.length} {orphans.length === 1 ? "article" : "articles"} · scroll to see all
            </p>
            <ul
              className="mt-4 max-h-[28rem] divide-y overflow-y-auto rounded-md border bg-background"
              data-testid="list-orphan-insights"
            >
              {orphans.map((o) => (
                <li key={o.id} data-testid={`item-orphan-${o.slug}`}>
                  <Link
                    href={`/discovery/knowledge/${o.slug}`}
                    className="flex items-start justify-between gap-4 px-4 py-3 text-sm hover:bg-muted/40"
                    data-testid={`link-orphan-${o.slug}`}
                  >
                    <span className="font-medium text-foreground">{o.title}</span>
                    {o.datePublished && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(o.datePublished).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

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
              href={`/personas/${tenant.slug}/locations`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-persona-locations"
            >
              {tenant.personaDisplayName} Locations
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

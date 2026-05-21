import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Newspaper, MapPin, Calendar, Lock, ArrowRight } from "lucide-react"
import { storage } from "@/lib/storage"
import { withTenantAsync } from "@/lib/tenant/context"
import { getPublicTenants } from "@/lib/tenant/public-tenants"
import ArticleGrid, { type ArticleWithCity } from "./article-grid"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"

export const metadata: Metadata = {
  title: "Insights, by Persona | Investor Ensights",
  description:
    "Browse Investor Ensights insights on local company formation and equity activity, organized by persona and city across the US.",
  alternates: { canonical: `${BASE_URL}/discovery/knowledge` },
}

interface PersonaSection {
  slug: string
  personaDisplayName: string
  brandTagline: string | null
  articles: ArticleWithCity[]
}

export default async function InsightsDirectoryPage() {
  // MT-multitenant-homepage Decision 2C: directory of personas, each section
  // is one persona's published-and-city-public articles. Mirrors /locations.
  const tenants = await getPublicTenants()
  const sections: PersonaSection[] = await Promise.all(
    tenants.map(async (t) => {
      const enriched = await withTenantAsync(t.slug, async () => {
        const [articlesRaw, citiesRaw] = await Promise.all([
          storage.getKnowledgeArticles("published"),
          storage.getCities(true),
        ])
        const publicCityMap = new Map(
          citiesRaw.filter((c) => c.allowIndexing === true).map((c) => [c.slug, c] as const),
        )
        const list: ArticleWithCity[] = articlesRaw
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
        return list
      })
      return {
        slug: t.slug,
        personaDisplayName: t.personaDisplayName,
        brandTagline: t.brandTagline,
        articles: enriched,
      }
    }),
  )
  const populated = sections.filter((s) => s.articles.length > 0)
  const totalArticles = populated.reduce((n, s) => n + s.articles.length, 0)

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-visible bg-primary py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl"
            data-testid="text-hero-title"
          >
            Insights, by Persona
          </h1>
          <h2 className="mx-auto mb-8 max-w-2xl text-lg text-primary-foreground/80 md:text-xl font-normal">
            Ground-truth coverage of company formation and equity activity, organized by the persona publishing it.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Badge variant="secondary" className="text-sm">
              <Newspaper className="mr-1.5 h-3.5 w-3.5" />
              {totalArticles} {totalArticles === 1 ? "Insight" : "Insights"}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              {populated.length} {populated.length === 1 ? "Persona" : "Personas"}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              Updated Daily
            </Badge>
          </div>
        </div>
      </section>

      {populated.length === 0 ? (
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <p className="text-lg text-muted-foreground">
            No insights are currently published. Check back soon.
          </p>
        </div>
      ) : (
        populated.map((section, idx) => (
          <section
            key={section.slug}
            className={idx > 0 ? "border-t" : ""}
            data-testid={`section-persona-${section.slug}`}
          >
            <div className="mx-auto max-w-6xl px-4 pt-12">
              <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Persona
                  </p>
                  <h2
                    className="mt-1 text-2xl font-bold"
                    data-testid={`text-persona-name-${section.slug}`}
                  >
                    {section.personaDisplayName}
                  </h2>
                  {section.brandTagline && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {section.brandTagline}
                    </p>
                  )}
                </div>
                <Link
                  href={`/personas/${section.slug}/insights`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  data-testid={`link-persona-hub-${section.slug}`}
                >
                  Browse {section.personaDisplayName} insights
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            <ArticleGrid articles={section.articles} />
          </section>
        ))
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

import type { Metadata } from "next"
import Link from "next/link"
import { storage } from "@/lib/storage"
import { withTenantAsync } from "@/lib/tenant/context"
import { getPublicTenants, type PublicTenant } from "@/lib/tenant/public-tenants"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Sitemap | Investor Ensights",
  description:
    "Browse every public page on Investor Ensights — personas, locations, knowledge articles, and core pages.",
  alternates: { canonical: `${BASE_URL}/site-map` },
  openGraph: {
    title: "Sitemap | Investor Ensights",
    description: "Browse every public page on Investor Ensights.",
    url: `${BASE_URL}/site-map`,
    type: "website",
  },
  robots: { index: true, follow: true },
}

type CityRow = {
  id: string
  slug: string
  cityName: string
  stateCode: string | null
  personaSlug: string
  personaName: string
}
type ArticleRow = {
  id: string
  slug: string
  label: string
  dateModified: number
  personaSlug: string
  personaName: string
}
type PageRow = {
  id: string
  slug: string
  label: string
  personaSlug: string
  personaName: string
}

export default async function SitemapPage() {
  let tenants: PublicTenant[] = []
  let cities: CityRow[] = []
  let articles: ArticleRow[] = []
  let pages: PageRow[] = []
  let loadError = false

  try {
    tenants = await getPublicTenants()
    const perTenant = await Promise.all(
      tenants.map(async (t) =>
        withTenantAsync(t.slug, async () => {
          const [tCities, tPages, tArticles] = await Promise.all([
            storage.getCities(true).catch(() => []),
            storage.getPages(true).catch(() => []),
            storage.getKnowledgeArticles("published").catch(() => []),
          ])
          return { tenant: t, tCities, tPages, tArticles }
        }),
      ),
    )

    const seenCity = new Set<string>()
    const seenArticle = new Set<string>()
    const seenPage = new Set<string>()
    for (const { tenant, tCities, tPages, tArticles } of perTenant) {
      for (const c of tCities) {
        if (c.allowIndexing === false) continue
        if (seenCity.has(c.slug)) continue
        seenCity.add(c.slug)
        cities.push({
          id: c.id,
          slug: c.slug,
          cityName: c.cityName,
          stateCode: c.stateCode,
          personaSlug: tenant.slug,
          personaName: tenant.personaDisplayName,
        })
      }
      for (const p of tPages) {
        if (seenPage.has(p.slug)) continue
        seenPage.add(p.slug)
        pages.push({
          id: p.id,
          slug: p.slug,
          label: p.pageTitle || p.slug,
          personaSlug: tenant.slug,
          personaName: tenant.personaDisplayName,
        })
      }
      for (const a of tArticles) {
        if (String((a as any).robots || "").toLowerCase().includes("noindex")) continue
        if (seenArticle.has(a.slug)) continue
        seenArticle.add(a.slug)
        articles.push({
          id: a.id,
          slug: a.slug,
          label: a.headline || a.title,
          dateModified: a.dateModified ? new Date(a.dateModified).getTime() : 0,
          personaSlug: tenant.slug,
          personaName: tenant.personaDisplayName,
        })
      }
    }
  } catch (err) {
    console.error("[site-map] storage load failed:", err)
    loadError = true
  }

  cities.sort((a, b) => a.cityName.localeCompare(b.cityName))
  pages.sort((a, b) => a.label.localeCompare(b.label))
  articles.sort((a, b) => b.dateModified - a.dateModified)

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <header className="mb-10">
          <Link
            href="/"
            className="text-[13px] text-neutral-500 hover:text-neutral-900"
            data-testid="link-back-home"
          >
            ← Back to home
          </Link>
          <h1
            className="mt-4 text-[32px] font-semibold tracking-tight sm:text-[40px]"
            data-testid="text-page-title"
          >
            Sitemap
          </h1>
          <p className="mt-2 text-[14px] text-neutral-500">
            Every public page on Investor Ensights, across all active personas.{" "}
            <Link
              href="/sitemap.xml"
              className="underline hover:text-neutral-900"
              data-testid="link-xml-sitemap"
            >
              XML version
            </Link>
            .
          </p>
          {loadError && (
            <p
              className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800"
              data-testid="text-load-error"
            >
              Some sections couldn&apos;t be loaded right now. Core links remain available below.
            </p>
          )}
        </header>

        <section className="mb-10">
          <h2 className="mb-3 text-[18px] font-semibold" data-testid="heading-core">
            Core
          </h2>
          <ul className="space-y-1.5 text-[15px]">
            <li>
              <Link href="/" className="text-neutral-700 hover:text-neutral-900 hover:underline" data-testid="link-home">
                Home
              </Link>
            </li>
            <li>
              <Link href="/locations" className="text-neutral-700 hover:text-neutral-900 hover:underline" data-testid="link-locations-grid">
                All Locations
              </Link>
            </li>
            <li>
              <Link href="/discovery/knowledge" className="text-neutral-700 hover:text-neutral-900 hover:underline" data-testid="link-knowledge-grid">
                All Insights
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-neutral-700 hover:text-neutral-900 hover:underline" data-testid="link-about">
                About &amp; Editorial Team
              </Link>
            </li>
            <li>
              <Link href="/terms" className="text-neutral-700 hover:text-neutral-900 hover:underline" data-testid="link-terms">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="text-neutral-700 hover:text-neutral-900 hover:underline" data-testid="link-privacy">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </section>

        {tenants.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-[18px] font-semibold" data-testid="heading-personas">
              Personas ({tenants.length})
            </h2>
            <ul className="space-y-3 text-[15px]">
              {tenants.map((t) => (
                <li key={t.slug} data-testid={`block-persona-${t.slug}`}>
                  <div className="font-medium text-neutral-900">{t.personaDisplayName}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-neutral-700">
                    <Link
                      href={`/personas/${t.slug}/locations`}
                      className="hover:text-neutral-900 hover:underline"
                      data-testid={`link-persona-locations-${t.slug}`}
                    >
                      Locations hub
                    </Link>
                    <Link
                      href={`/personas/${t.slug}/insights`}
                      className="hover:text-neutral-900 hover:underline"
                      data-testid={`link-persona-insights-${t.slug}`}
                    >
                      Insights hub
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pages.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-[18px] font-semibold" data-testid="heading-pages">
              Pages ({pages.length})
            </h2>
            <ul className="grid grid-cols-1 gap-1.5 text-[15px] sm:grid-cols-2">
              {pages.map((p) => (
                <li key={`${p.personaSlug}-${p.id}`}>
                  <Link
                    href={`/${p.slug}`}
                    className="text-neutral-700 hover:text-neutral-900 hover:underline"
                    data-testid={`link-page-${p.slug}`}
                  >
                    {p.label}
                  </Link>
                  {tenants.length > 1 && (
                    <span className="ml-1 text-[12px] text-neutral-400">· {p.personaName}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-10">
          <h2 className="mb-3 text-[18px] font-semibold" data-testid="heading-locations">
            Locations ({cities.length})
          </h2>
          {cities.length === 0 ? (
            <p className="text-[14px] text-neutral-500">No published locations yet.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5 text-[15px] sm:grid-cols-2 md:grid-cols-3">
              {cities.map((c) => (
                <li key={`${c.personaSlug}-${c.id}`}>
                  <Link
                    href={`/locations/${c.slug}`}
                    className="text-neutral-700 hover:text-neutral-900 hover:underline"
                    data-testid={`link-city-${c.slug}`}
                  >
                    {c.cityName}
                    {c.stateCode ? `, ${c.stateCode}` : ""}
                  </Link>
                  {tenants.length > 1 && (
                    <span className="ml-1 text-[12px] text-neutral-400">· {c.personaName}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-[18px] font-semibold" data-testid="heading-knowledge">
            Knowledge ({articles.length})
          </h2>
          {articles.length === 0 ? (
            <p className="text-[14px] text-neutral-500">No published articles yet.</p>
          ) : (
            <ul className="space-y-1.5 text-[15px]">
              {articles.map((a) => (
                <li key={`${a.personaSlug}-${a.id}`}>
                  <Link
                    href={`/discovery/knowledge/${a.slug}`}
                    className="text-neutral-700 hover:text-neutral-900 hover:underline"
                    data-testid={`link-article-${a.slug}`}
                  >
                    {a.label}
                  </Link>
                  {tenants.length > 1 && (
                    <span className="ml-1 text-[12px] text-neutral-400">· {a.personaName}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-12 border-t border-neutral-200 pt-6 text-[13px] text-neutral-500">
          <Link href="/terms" className="hover:text-neutral-900">
            Terms
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-neutral-900">
            Privacy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/about" className="hover:text-neutral-900">
            About
          </Link>
          <span className="mx-2">·</span>
          <Link href="/" className="hover:text-neutral-900">
            Home
          </Link>
        </footer>
      </div>
    </div>
  )
}

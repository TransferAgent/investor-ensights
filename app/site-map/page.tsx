import type { Metadata } from "next"
import Link from "next/link"
import { storage } from "@/lib/storage"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"

export const revalidate = 300

export const metadata: Metadata = {
  title: "Sitemap | Investor Ensights",
  description:
    "Browse every public page on Investor Ensights — locations, knowledge articles, and core pages.",
  alternates: { canonical: `${BASE_URL}/site-map` },
  openGraph: {
    title: "Sitemap | Investor Ensights",
    description: "Browse every public page on Investor Ensights.",
    url: `${BASE_URL}/site-map`,
    type: "website",
  },
  robots: { index: true, follow: true },
}

export default async function SitemapPage() {
  let cities: Awaited<ReturnType<typeof storage.getCities>> = []
  let customPages: Awaited<ReturnType<typeof storage.getPages>> = []
  let articles: Awaited<ReturnType<typeof storage.getKnowledgeArticles>> = []
  let loadError = false
  try {
    ;[cities, customPages, articles] = await Promise.all([
      storage.getCities(true),
      storage.getPages(true),
      storage.getKnowledgeArticles("published"),
    ])
  } catch (err) {
    console.error("[site-map] storage load failed:", err)
    loadError = true
  }

  const indexableCities = cities.filter((c) => c.allowIndexing !== false)
  const indexableArticles = articles.filter(
    (a) => !((a as any).robots || "").toLowerCase().includes("noindex")
  )

  const sortedCities = [...indexableCities].sort((a, b) =>
    (a.name || a.slug || "").localeCompare(b.name || b.slug || "")
  )
  const sortedPages = [...customPages].sort((a, b) =>
    (a.title || a.slug || "").localeCompare(b.title || b.slug || "")
  )
  const sortedArticles = [...indexableArticles].sort((a, b) => {
    const at = a.dateModified ? new Date(a.dateModified).getTime() : 0
    const bt = b.dateModified ? new Date(b.dateModified).getTime() : 0
    return bt - at
  })

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
            Every public page on Investor Ensights.{" "}
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

        {sortedPages.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 text-[18px] font-semibold" data-testid="heading-pages">
              Pages ({sortedPages.length})
            </h2>
            <ul className="grid grid-cols-1 gap-1.5 text-[15px] sm:grid-cols-2">
              {sortedPages.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/${p.slug}`}
                    className="text-neutral-700 hover:text-neutral-900 hover:underline"
                    data-testid={`link-page-${p.slug}`}
                  >
                    {p.title || p.slug}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-10">
          <h2 className="mb-3 text-[18px] font-semibold" data-testid="heading-locations">
            Locations ({sortedCities.length})
          </h2>
          {sortedCities.length === 0 ? (
            <p className="text-[14px] text-neutral-500">No published locations yet.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-1.5 text-[15px] sm:grid-cols-2 md:grid-cols-3">
              {sortedCities.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/locations/${c.slug}`}
                    className="text-neutral-700 hover:text-neutral-900 hover:underline"
                    data-testid={`link-city-${c.slug}`}
                  >
                    {c.name}
                    {c.stateCode ? `, ${c.stateCode}` : ""}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-[18px] font-semibold" data-testid="heading-knowledge">
            Knowledge ({sortedArticles.length})
          </h2>
          {sortedArticles.length === 0 ? (
            <p className="text-[14px] text-neutral-500">No published articles yet.</p>
          ) : (
            <ul className="space-y-1.5 text-[15px]">
              {sortedArticles.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/discovery/knowledge/${a.slug}`}
                    className="text-neutral-700 hover:text-neutral-900 hover:underline"
                    data-testid={`link-article-${a.slug}`}
                  >
                    {a.headline || a.title}
                  </Link>
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
          <Link href="/" className="hover:text-neutral-900">
            Home
          </Link>
        </footer>
      </div>
    </div>
  )
}

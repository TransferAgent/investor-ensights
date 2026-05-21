import Link from "next/link"
import type { KnowledgeArticle, CityLocation } from "@shared/schema"

const ARTICLE_LIMIT = 12
const CITY_LIMIT = 24

function pickRecentArticles(articles: KnowledgeArticle[]): KnowledgeArticle[] {
  return articles
    .filter((a) => a.status === "published")
    .filter((a) => !String(a.robots || "").toLowerCase().includes("noindex"))
    .sort((a, b) => {
      const ta = a.datePublished ? new Date(a.datePublished).getTime() : 0
      const tb = b.datePublished ? new Date(b.datePublished).getTime() : 0
      return tb - ta
    })
    .slice(0, ARTICLE_LIMIT)
}

function pickCities(cities: CityLocation[]): CityLocation[] {
  return cities
    .filter((c) => c.allowIndexing !== false)
    .sort((a, b) => a.cityName.localeCompare(b.cityName))
    .slice(0, CITY_LIMIT)
}

export default function HomeInternalLinks({
  articles,
  cities,
}: {
  articles: KnowledgeArticle[]
  cities: CityLocation[]
}) {
  const recent = pickRecentArticles(articles)
  const featuredCities = pickCities(cities)

  if (recent.length === 0 && featuredCities.length === 0) return null

  return (
    <section
      aria-labelledby="home-explore-heading"
      className="border-t bg-background"
      data-testid="section-home-internal-links"
    >
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2
          id="home-explore-heading"
          className="text-2xl font-bold tracking-tight"
          data-testid="text-explore-heading"
        >
          Explore Investor Ensights
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Ground-truth coverage of local company formation and equity activity,
          organized by recent insights and by city.
        </p>

        <div className="mt-10 grid gap-12 lg:grid-cols-2">
          {recent.length > 0 && (
            <div data-testid="block-recent-articles">
              <h3 className="text-lg font-semibold">Recent insights</h3>
              <ul className="mt-4 space-y-3">
                {recent.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/discovery/knowledge/${a.slug}`}
                      className="text-sm leading-snug text-foreground underline-offset-4 hover:underline"
                      data-testid={`link-article-${a.slug}`}
                    >
                      {a.headline || a.title}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <Link
                  href="/site-map"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  data-testid="link-all-articles"
                >
                  Browse all insights →
                </Link>
              </div>
            </div>
          )}

          {featuredCities.length > 0 && (
            <div data-testid="block-featured-cities">
              <h3 className="text-lg font-semibold">Locations we cover</h3>
              <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                {featuredCities.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/locations/${c.slug}`}
                      className="text-sm leading-snug text-foreground underline-offset-4 hover:underline"
                      data-testid={`link-city-${c.slug}`}
                    >
                      {c.cityName}, {c.stateCode}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <Link
                  href="/locations"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  data-testid="link-all-locations"
                >
                  See every location →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

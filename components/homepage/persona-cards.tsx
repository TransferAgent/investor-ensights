import Link from "next/link"
import { MapPin, Newspaper, TrendingUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import type { PersonaCardData } from "@/lib/tenant/public-tenants"

type CardVariant = "hero" | "stack"

function personaDescription(data: PersonaCardData): string {
  const { tenant, cityCount } = data
  if (tenant.brandTagline && tenant.brandTagline.trim().length > 0) {
    return tenant.brandTagline
  }
  return `${tenant.personaDisplayName} publishes ground-truth company-formation and equity coverage across ${cityCount} U.S. ${cityCount === 1 ? "city" : "cities"}. New articles ship through the Investor Ensights newsroom on a regular cadence.`
}

function DummyComingSoonCard() {
  return (
    <Card
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-dashed border-border/60 shadow-sm"
      data-testid="card-persona-coming-soon"
      aria-label="Coming soon persona placeholder"
    >
      <div
        className="relative aspect-[16/7] w-full bg-gradient-to-br from-muted to-muted/60"
        aria-hidden="true"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/70 text-xs font-bold text-muted-foreground shadow"
            aria-hidden="true"
          >
            ?
          </span>
          <h3 className="text-base font-semibold text-white/90 drop-shadow">
            New Persona
          </h3>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Coming Soon
          </span>
        </div>
        <p
          className="text-sm leading-relaxed text-muted-foreground"
          data-testid="text-persona-description-coming-soon"
        >
          A new persona will appear here once it joins the Investor Ensights
          newsroom. Each persona ships with its own locations and insights.
        </p>
      </div>
    </Card>
  )
}

function PersonaCard({
  data,
  variant,
}: {
  data: PersonaCardData
  variant: CardVariant
}) {
  const { tenant, cityCount } = data
  const description = personaDescription(data)
  const imageAspect = variant === "hero" ? "aspect-[4/3]" : "aspect-[16/7]"

  return (
    <Card
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 shadow-sm transition-shadow hover:shadow-md"
      data-testid={`card-persona-${tenant.slug}`}
    >
      <div
        className={`relative w-full bg-gradient-to-br from-muted to-muted/60 ${imageAspect}`}
        data-testid={`img-placeholder-${tenant.slug}`}
        aria-hidden="true"
      >
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/95 text-xs font-bold text-foreground shadow"
            aria-hidden="true"
          >
            {tenant.personaDisplayName.charAt(0)}
          </span>
          <h3
            className="text-base font-semibold text-white drop-shadow"
            data-testid={`text-persona-name-${tenant.slug}`}
          >
            {tenant.personaDisplayName}
          </h3>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white"
            data-testid={`badge-growth-insights-${tenant.slug}`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Growth Insights
          </span>
          <div className="flex items-center gap-1">
            <Link
              href={`/personas/${tenant.slug}/locations`}
              title={`${cityCount} ${cityCount === 1 ? "location" : "locations"}`}
              aria-label={`${tenant.personaDisplayName} locations`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              data-testid={`link-persona-locations-${tenant.slug}`}
            >
              <MapPin className="h-4 w-4" />
            </Link>
            <Link
              href={`/personas/${tenant.slug}/insights`}
              title={`${tenant.personaDisplayName} insights`}
              aria-label={`${tenant.personaDisplayName} insights`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              data-testid={`link-persona-insights-${tenant.slug}`}
            >
              <Newspaper className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <p
          className="text-sm leading-relaxed text-foreground/80"
          data-testid={`text-persona-description-${tenant.slug}`}
        >
          {description}
        </p>

        <span className="sr-only" data-testid={`text-city-count-${tenant.slug}`}>
          {cityCount} {cityCount === 1 ? "active city" : "active cities"}
        </span>
      </div>
    </Card>
  )
}

export default function PersonaCards({ cards }: { cards: PersonaCardData[] }) {
  if (cards.length === 0) return null

  return (
    <section
      aria-labelledby="home-personas-heading"
      className="border-t bg-background"
      data-testid="section-personas"
    >
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h2
          id="home-personas-heading"
          className="text-2xl font-bold tracking-tight"
          data-testid="text-personas-heading"
        >
          Explore by Persona
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Investor Ensights publishes ground-truth coverage for{" "}
          {cards.length === 1 ? "one persona" : `${cards.length} personas`}, each with its
          own set of cities and insights.
        </p>

        {(() => {
          const HERO_SLUG = "tableicity"
          const heroCard = cards.find((c) => c.tenant.slug === HERO_SLUG) ?? cards[0]
          const restCards = cards.filter((c) => c.tenant.slug !== heroCard.tenant.slug)
          return (
            <div
              className="mt-10 flex flex-col gap-6 md:flex-row md:items-stretch"
              data-testid="grid-persona-mosaic"
            >
              <div className="md:w-1/2" data-testid="slot-persona-hero">
                <PersonaCard key={heroCard.tenant.slug} data={heroCard} variant="hero" />
              </div>
              <div
                className="flex flex-col gap-6 md:w-1/2"
                data-testid="slot-persona-stack"
              >
                {restCards.map((card) => (
                  <PersonaCard key={card.tenant.slug} data={card} variant="stack" />
                ))}
                <DummyComingSoonCard />
              </div>
            </div>
          )
        })()}
      </div>
    </section>
  )
}

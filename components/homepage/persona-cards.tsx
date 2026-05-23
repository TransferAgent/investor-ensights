import Link from "next/link"
import { MapPin, Newspaper, ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { PersonaCardData } from "@/lib/tenant/public-tenants"

function PersonaCard({ data }: { data: PersonaCardData }) {
  const { tenant, cityCount } = data
  return (
    <Card
      className="flex h-full flex-col p-6"
      data-testid={`card-persona-${tenant.slug}`}
    >
      <div className="mb-5">
        <h3
          className="text-xl font-semibold"
          data-testid={`text-persona-name-${tenant.slug}`}
        >
          {tenant.personaDisplayName}
        </h3>
        <p
          className="mt-1 min-h-[2.5rem] text-sm text-muted-foreground"
          data-testid={`text-persona-tagline-${tenant.slug}`}
        >
          {tenant.brandTagline || "\u00A0"}
        </p>
        <div className="mt-3 min-h-[1.5rem]">
          {tenant.brandVertical ? (
            <Badge
              variant="secondary"
              className="text-xs"
              data-testid={`badge-persona-vertical-${tenant.slug}`}
            >
              {tenant.brandVertical}
            </Badge>
          ) : (
            <Badge variant="secondary" className="invisible text-xs" aria-hidden="true">
              &nbsp;
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm" data-testid={`text-city-count-${tenant.slug}`}>
            {cityCount} {cityCount === 1 ? "active city" : "active cities"}
          </span>
          <Link
            href={`/personas/${tenant.slug}/locations`}
            className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            data-testid={`link-persona-locations-${tenant.slug}`}
          >
            Locations
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
          <Newspaper className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-sm" data-testid={`text-insights-label-${tenant.slug}`}>
            {tenant.personaDisplayName} insights
          </span>
          <Link
            href={`/personas/${tenant.slug}/insights`}
            className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            data-testid={`link-persona-insights-${tenant.slug}`}
          >
            Browse
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
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
                <PersonaCard key={heroCard.tenant.slug} data={heroCard} />
              </div>
              <div
                className="flex flex-col gap-6 md:w-1/2"
                data-testid="slot-persona-stack"
              >
                {restCards.map((card) => (
                  <PersonaCard key={card.tenant.slug} data={card} />
                ))}
              </div>
            </div>
          )
        })()}
      </div>
    </section>
  )
}

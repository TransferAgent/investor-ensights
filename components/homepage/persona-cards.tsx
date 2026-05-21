import Link from "next/link"
import { MapPin, ArrowRight } from "lucide-react"
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
      <div className="mb-4">
        <h3
          className="text-xl font-semibold"
          data-testid={`text-persona-name-${tenant.slug}`}
        >
          {tenant.personaDisplayName}
        </h3>
        {tenant.brandTagline && (
          <p className="mt-1 text-sm text-muted-foreground">
            {tenant.brandTagline}
          </p>
        )}
        {tenant.brandVertical && (
          <Badge variant="secondary" className="mt-3 text-xs">
            {tenant.brandVertical}
          </Badge>
        )}
      </div>

      <div className="mb-5 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
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

      <div className="mt-auto border-t pt-4">
        <Link
          href={`/personas/${tenant.slug}/insights`}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          data-testid={`link-persona-insights-${tenant.slug}`}
        >
          Browse all {tenant.personaDisplayName} insights
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
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

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {cards.map((card) => (
            <PersonaCard key={card.tenant.slug} data={card} />
          ))}
        </div>
      </div>
    </section>
  )
}

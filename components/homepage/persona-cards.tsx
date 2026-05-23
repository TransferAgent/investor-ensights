import Link from "next/link"
import Image from "next/image"
import {
  MapPin,
  Newspaper,
  TrendingUp,
  Table,
  MessageCircle,
  Rocket,
  Sparkles,
  Wallet,
  Hourglass,
  type LucideIcon,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import type { PersonaCardData, PublicTenant } from "@/lib/tenant/public-tenants"

interface PersonaVisual {
  hero: string
  icon: LucideIcon
  iconBg: string
  description: string
}

const FALLBACK_VISUAL: PersonaVisual = {
  hero: "/persona-heroes/dummy.png",
  icon: Sparkles,
  iconBg: "bg-slate-200 text-slate-700",
  description: "Investor Ensights ground-truth coverage for this persona.",
}

const PERSONA_VISUALS: Record<string, PersonaVisual> = {
  tableicity: {
    hero: "/persona-heroes/tableicity.png",
    icon: Table,
    iconBg: "bg-indigo-100 text-indigo-700",
    description:
      "Cap table, equity, and 409A guidance for startup founders and operators.",
  },
  texitie: {
    hero: "/persona-heroes/texitie.png",
    icon: MessageCircle,
    iconBg: "bg-orange-100 text-orange-700",
    description:
      "Local-first communications coverage connecting cities and the founders building in them.",
  },
  veltroy: {
    hero: "/persona-heroes/veltroy.png",
    icon: Rocket,
    iconBg: "bg-purple-100 text-purple-700",
    description:
      "Velocity intelligence on high-growth fundraising rounds and emerging operators.",
  },
  haylo: {
    hero: "/persona-heroes/haylo.png",
    icon: Sparkles,
    iconBg: "bg-emerald-100 text-emerald-700",
    description:
      "Quiet-signal coverage of early founders and the markets they are quietly reshaping.",
  },
  payrol: {
    hero: "/persona-heroes/payrol.png",
    icon: Wallet,
    iconBg: "bg-amber-100 text-amber-700",
    description:
      "Payroll, equity, and back-office insights for modern operating teams.",
  },
}

const DUMMY_TENANT: PublicTenant = {
  slug: "__coming-soon__",
  personaDisplayName: "Coming Soon",
  brandTagline: null,
  brandVertical: null,
  brandFeatureCta: null,
  brandHomeUrl: null,
  companyName: null,
}

const DUMMY_VISUAL: PersonaVisual = {
  hero: "/persona-heroes/dummy.png",
  icon: Hourglass,
  iconBg: "bg-slate-200 text-slate-700",
  description:
    "A new persona is joining the Investor Ensights newsroom soon — fresh coverage on the way.",
}

function visualFor(slug: string): PersonaVisual {
  if (slug === DUMMY_TENANT.slug) return DUMMY_VISUAL
  return PERSONA_VISUALS[slug] ?? FALLBACK_VISUAL
}

function PersonaCard({
  data,
  className,
  large,
}: {
  data: PersonaCardData
  className?: string
  large?: boolean
}) {
  const { tenant } = data
  const visual = visualFor(tenant.slug)
  const Icon = visual.icon
  const isDummy = tenant.slug === DUMMY_TENANT.slug
  const description =
    tenant.brandTagline?.trim() || visual.description

  return (
    <Card
      className={`group flex h-full flex-col overflow-hidden border-border/60 shadow-sm transition-shadow hover-elevate ${className ?? ""}`}
      data-testid={`card-persona-${tenant.slug}`}
    >
      <div
        className={`relative w-full overflow-hidden ${large ? "aspect-[16/10]" : "aspect-[16/9]"}`}
      >
        <Image
          src={visual.hero}
          alt={`${tenant.personaDisplayName} hero`}
          fill
          sizes={large ? "(min-width: 1024px) 66vw, 100vw" : "(min-width: 1024px) 33vw, 100vw"}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          priority={large}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/45 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-md ${visual.iconBg} shadow-sm`}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </div>
          <span
            className={`font-semibold text-white drop-shadow-md ${large ? "text-xl" : "text-base"}`}
            data-testid={`text-persona-name-${tenant.slug}`}
          >
            {tenant.personaDisplayName}
          </span>
        </div>
      </div>

      <div className={`flex flex-1 flex-col ${large ? "p-5" : "p-4"}`}>
        <div className="flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700"
            data-testid={`badge-growth-insights-${tenant.slug}`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Growth Insights
          </span>

          {isDummy ? (
            <div className="flex items-center gap-1 text-muted-foreground/60">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60"
                aria-hidden="true"
              >
                <MapPin className="h-4 w-4" />
              </span>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60"
                aria-hidden="true"
              >
                <Newspaper className="h-4 w-4" />
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Link
                href={`/personas/${tenant.slug}/locations`}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label={`${tenant.personaDisplayName} locations`}
                title="Locations"
                data-testid={`link-persona-locations-${tenant.slug}`}
              >
                <MapPin className="h-4 w-4" />
              </Link>
              <Link
                href={`/personas/${tenant.slug}/insights`}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label={`${tenant.personaDisplayName} insights`}
                title="Insights"
                data-testid={`link-persona-insights-${tenant.slug}`}
              >
                <Newspaper className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>

        <p
          className={`mt-3 text-muted-foreground ${large ? "text-base" : "text-sm"}`}
          data-testid={`text-persona-description-${tenant.slug}`}
        >
          {description}
        </p>
      </div>
    </Card>
  )
}

function makeDummyCard(): PersonaCardData {
  return { tenant: DUMMY_TENANT, cityCount: 0, recentArticles: [] }
}

export default function PersonaCards({ cards }: { cards: PersonaCardData[] }) {
  if (cards.length === 0) return null

  // The Crunchbase-style asymmetric grid is designed for exactly 5 tiles.
  // Pad with a "Coming Soon" placeholder when fewer real public personas
  // exist, and truncate to 5 if more ever ship (older personas drop off
  // the homepage rather than break the layout).
  const padded: PersonaCardData[] = [...cards]
  while (padded.length < 5) padded.push(makeDummyCard())
  const display = padded.slice(0, 5)

  const [hero, sideA, sideB, footA, footB] = display

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

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
          <PersonaCard data={hero} large className="lg:col-span-2 lg:row-span-2" />
          <PersonaCard data={sideA} className="lg:col-span-1" />
          <PersonaCard data={sideB} className="lg:col-span-1" />
          <PersonaCard data={footA} className="lg:col-span-1" />
          <PersonaCard data={footB} className="lg:col-span-2" />
        </div>
      </div>
    </section>
  )
}

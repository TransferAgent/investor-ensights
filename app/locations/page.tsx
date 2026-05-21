import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Building2, Globe, Phone, Lock, ArrowRight } from "lucide-react"
import { storage } from "@/lib/storage"
import { withTenantAsync } from "@/lib/tenant/context"
import { getPublicTenants } from "@/lib/tenant/public-tenants"
import type { CityLocation } from "@shared/schema"
import CityGrid from "../city-grid"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"

export const metadata: Metadata = {
  title: "Locations, by Persona | Investor Ensights",
  description:
    "Browse Investor Ensights coverage of local company formation and equity activity, organized by persona and city across the US.",
  alternates: { canonical: `${BASE_URL}/locations` },
}

interface PersonaSection {
  slug: string
  personaDisplayName: string
  brandTagline: string | null
  cities: CityLocation[]
}

export default async function LocationsDirectoryPage() {
  // MT-multitenant-homepage Decision 2C: this page is repurposed from a flat
  // city grid into a "directory of personas." Each persona becomes its own
  // section, each section embeds a CityGrid of that persona's Publish+Index
  // cities. URL is preserved (no forward-only delete violation) and Google
  // gets a clean: home → /locations → /personas/<slug>/locations → city.
  const tenants = await getPublicTenants()
  const sections: PersonaSection[] = await Promise.all(
    tenants.map(async (t) => {
      const all = await withTenantAsync(t.slug, () => storage.getCities(true))
      return {
        slug: t.slug,
        personaDisplayName: t.personaDisplayName,
        brandTagline: t.brandTagline,
        cities: all.filter((c) => c.allowIndexing === true),
      }
    }),
  )
  const populated = sections.filter((s) => s.cities.length > 0)
  const totalCities = populated.reduce((n, s) => n + s.cities.length, 0)

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-visible bg-primary py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl"
            data-testid="text-hero-title"
          >
            Locations, by Persona
          </h1>
          <h2 className="mx-auto mb-8 max-w-2xl text-lg text-primary-foreground/80 md:text-xl font-normal">
            Ground-truth data for institutional and retail investors, organized by the persona publishing it.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Badge variant="secondary" className="text-sm">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              {totalCities} {totalCities === 1 ? "Location" : "Locations"}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              {populated.length} {populated.length === 1 ? "Persona" : "Personas"}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <Phone className="mr-1.5 h-3.5 w-3.5" />
              Local Teams
            </Badge>
          </div>
        </div>
      </section>

      {populated.length === 0 ? (
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <p className="text-lg text-muted-foreground">
            No locations are currently published. Check back soon.
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
                  href={`/personas/${section.slug}/locations`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  data-testid={`link-persona-hub-${section.slug}`}
                >
                  Browse {section.personaDisplayName} locations
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            <CityGrid cities={section.cities} />
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
              href="/discovery/knowledge"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-insights"
            >
              Insights
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

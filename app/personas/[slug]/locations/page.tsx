import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Building2, Globe, Phone, Lock, ArrowLeft } from "lucide-react"
import { storage } from "@/lib/storage"
import { withTenantAsync } from "@/lib/tenant/context"
import { getPublicTenants } from "@/lib/tenant/public-tenants"
import CityGrid from "../../../city-grid"

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
    title: `${tenant.personaDisplayName} — Locations | Investor Ensights`,
    description:
      tenant.brandTagline ||
      `${tenant.personaDisplayName} coverage of local company formation and equity activity, city by city.`,
    alternates: { canonical: `${BASE_URL}/personas/${tenant.slug}/locations` },
  }
}

export default async function PersonaLocationsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tenants = await getPublicTenants()
  const tenant = tenants.find((t) => t.slug === slug)
  if (!tenant) notFound()

  // Two-gate: isPublished (via storage filter) AND allowIndexing (here).
  const all = await withTenantAsync(tenant.slug, () => storage.getCities(true))
  const cities = all.filter((c) => c.allowIndexing === true)

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
            {tenant.personaDisplayName} Locations
          </h1>
          <h2 className="mx-auto mb-8 max-w-2xl text-lg text-primary-foreground/80 md:text-xl font-normal">
            {tenant.brandTagline ||
              "Ground-truth data for institutional and retail investors, city by city."}
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Badge variant="secondary" className="text-sm">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              {cities.length} {cities.length === 1 ? "Location" : "Locations"}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              Nationwide Coverage
            </Badge>
            <Badge variant="secondary" className="text-sm">
              <Phone className="mr-1.5 h-3.5 w-3.5" />
              Local Teams
            </Badge>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 pt-6">
        <Link
          href="/locations"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="link-back-to-directory"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All locations
        </Link>
      </div>

      <CityGrid cities={cities} />

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
              href={`/personas/${tenant.slug}/insights`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-persona-insights"
            >
              {tenant.personaDisplayName} Insights
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

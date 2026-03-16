import type { Metadata } from "next"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Building2, Globe, Phone, Lock } from "lucide-react"
import { storage } from "@/lib/storage"
import CityGrid from "../city-grid"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://yourcompany.com"

export const metadata: Metadata = {
  title: "Locations - Tableicity",
  description: "Find Tableicity services in your city. Browse our locations across 150+ major US cities.",
  alternates: { canonical: `${BASE_URL}/locations` },
}

export default async function LocationsPage() {
  const cities = await storage.getCities(true)

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-visible bg-primary py-20 md:py-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
        <div className="relative mx-auto max-w-6xl px-4 text-center">
          <h1
            className="mb-4 text-4xl font-bold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl"
            data-testid="text-hero-title"
          >
            Your Local Partner in Every City
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-primary-foreground/80 md:text-xl">
            Professional sales and marketing services across 150+ major US
            cities. Find your nearest office and connect with our local team.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Badge variant="secondary" className="text-sm">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              150+ Locations
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

      <CityGrid cities={cities} />

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Tableicity. All rights reserved.
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

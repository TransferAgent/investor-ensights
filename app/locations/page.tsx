import type { Metadata } from "next"
import Link from "next/link"
import { Lock } from "lucide-react"
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
      <CityGrid cities={cities} />

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Tableicity. All rights reserved.
          </p>
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-admin-login"
          >
            <Lock className="h-3.5 w-3.5" />
            Admin
          </Link>
        </div>
      </footer>
    </div>
  )
}

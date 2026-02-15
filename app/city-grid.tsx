"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MapPin, Search, ArrowRight, Navigation } from "lucide-react"
import type { CityLocation } from "@shared/schema"

function CityCard({ city }: { city: CityLocation }) {
  const landmarks = (city.localLandmarks as string[]) || []
  return (
    <Link href={`/locations/${city.slug}`} data-testid={`link-city-${city.slug}`}>
      <Card
        className="group flex h-full cursor-pointer flex-col p-5 hover-elevate"
        data-testid={`card-city-${city.slug}`}
      >
        <div className="mb-3 flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold leading-tight">{city.cityName}</h3>
              <p className="text-sm text-muted-foreground">
                {city.stateName || city.stateCode}
              </p>
            </div>
          </div>
          <Badge variant={city.isPublished ? "default" : "secondary"}>
            {city.isPublished ? "Active" : "Coming Soon"}
          </Badge>
        </div>

        {city.streetAddress && (
          <p className="mb-2 text-sm text-muted-foreground">
            {city.streetAddress}
          </p>
        )}

        {landmarks.length > 0 && (
          <p className="mb-3 text-xs text-muted-foreground">
            Near: {landmarks.slice(0, 2).join(", ")}
            {landmarks.length > 2 && ` +${landmarks.length - 2} more`}
          </p>
        )}

        <div className="mt-auto flex items-center gap-1 pt-3 text-sm font-medium text-primary">
          View Location
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  )
}

interface GeoResult {
  stateCode: string | null
  stateName: string | null
  city: string | null
}

export default function CityGrid({ cities }: { cities: CityLocation[] }) {
  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState<string>("")
  const [detectedState, setDetectedState] = useState<GeoResult | null>(null)
  const [geoLoaded, setGeoLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/geo")
      .then((res) => res.json())
      .then((data: GeoResult) => {
        setDetectedState(data)
        if (data.stateCode) {
          const hasCitiesInState = cities.some((c) => c.stateCode === data.stateCode)
          if (hasCitiesInState) {
            setStateFilter(data.stateCode)
          }
        }
        setGeoLoaded(true)
      })
      .catch(() => {
        setGeoLoaded(true)
      })
  }, [cities])

  const states = useMemo(() => {
    const stateSet = new Set(cities.map((c) => c.stateCode))
    return Array.from(stateSet).sort()
  }, [cities])

  const filtered = useMemo(() => {
    return cities.filter((c) => {
      const matchSearch =
        !search ||
        c.cityName.toLowerCase().includes(search.toLowerCase()) ||
        c.stateCode.toLowerCase().includes(search.toLowerCase()) ||
        (c.stateName || "").toLowerCase().includes(search.toLowerCase())
      const matchState = !stateFilter || c.stateCode === stateFilter
      return matchSearch && matchState
    })
  }, [cities, search, stateFilter])

  const isAutoFiltered = geoLoaded && detectedState?.stateCode && stateFilter === detectedState.stateCode

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2
            className="text-2xl font-bold"
            data-testid="text-locations-title"
          >
            Our Locations
          </h2>
          <p className="text-muted-foreground">
            {filtered.length}{" "}
            {filtered.length === 1 ? "location" : "locations"} found
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search cities..."
              className="w-64 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-cities"
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            data-testid="select-state-filter"
          >
            <option value="">All States</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isAutoFiltered && (
        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap rounded-md border bg-muted/30 px-4 py-3" data-testid="div-geo-banner">
          <div className="flex items-center gap-2 text-sm">
            <Navigation className="h-4 w-4 text-primary shrink-0" />
            <span>
              Showing locations near you in <span className="font-medium">{detectedState?.stateName || detectedState?.stateCode}</span>
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStateFilter("")}
            data-testid="button-show-all-locations"
          >
            Show All Locations
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <MapPin className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="mb-1 text-lg font-medium">No locations found</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Try adjusting your search or filter
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("")
              setStateFilter("")
            }}
            data-testid="button-clear-filters"
          >
            Clear Filters
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((city) => (
            <CityCard key={city.id} city={city} />
          ))}
        </div>
      )}
    </div>
  )
}

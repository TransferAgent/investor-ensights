import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MapPin,
  Search,
  ArrowRight,
  Building2,
  Globe,
  Phone,
} from "lucide-react";
import { useState, useMemo } from "react";
import type { CityLocation } from "@shared/schema";

interface CityWithContent extends CityLocation {
  templateName?: string;
}

function HeroSection() {
  return (
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
  );
}

function CityCard({ city }: { city: CityWithContent }) {
  const landmarks = (city.localLandmarks as string[]) || [];
  return (
    <Link href={`/locations/${city.slug}`}>
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
              <p className="text-sm text-muted-foreground">{city.stateName || city.stateCode}</p>
            </div>
          </div>
          <Badge variant={city.isPublished ? "default" : "secondary"}>
            {city.isPublished ? "Active" : "Coming Soon"}
          </Badge>
        </div>

        {city.streetAddress && (
          <p className="mb-2 text-sm text-muted-foreground">{city.streetAddress}</p>
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
  );
}

function CityCardSkeleton() {
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div>
            <Skeleton className="mb-1 h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="mb-2 h-3 w-40" />
      <Skeleton className="mb-3 h-3 w-32" />
      <div className="mt-auto pt-3">
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  );
}

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("");

  const { data: cities = [], isLoading } = useQuery<CityWithContent[]>({
    queryKey: ["/api/locations"],
  });

  const states = useMemo(() => {
    const stateSet = new Set(cities.map((c) => c.stateCode));
    return Array.from(stateSet).sort();
  }, [cities]);

  const filtered = useMemo(() => {
    return cities.filter((c) => {
      const matchSearch =
        !search ||
        c.cityName.toLowerCase().includes(search.toLowerCase()) ||
        c.stateCode.toLowerCase().includes(search.toLowerCase()) ||
        (c.stateName || "").toLowerCase().includes(search.toLowerCase());
      const matchState = !stateFilter || c.stateCode === stateFilter;
      return matchSearch && matchState;
    });
  }, [cities, search, stateFilter]);

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />

      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold" data-testid="text-locations-title">
              Our Locations
            </h2>
            <p className="text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "location" : "locations"} found
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

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CityCardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-16">
            <MapPin className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="mb-1 text-lg font-medium">No locations found</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Try adjusting your search or filter
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setStateFilter("");
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
    </div>
  );
}

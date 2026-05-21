"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Newspaper, Search, ArrowRight, Navigation, MapPin } from "lucide-react"

export interface ArticleWithCity {
  id: string
  slug: string
  title: string
  citySlug: string
  cityName: string
  stateCode: string
  stateName: string
  datePublished: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return ""
  }
}

function ArticleCard({ article }: { article: ArticleWithCity }) {
  return (
    <Link
      href={`/discovery/knowledge/${article.slug}`}
      data-testid={`link-article-${article.slug}`}
    >
      <Card
        className="group flex h-full cursor-pointer flex-col p-5 hover-elevate"
        data-testid={`card-article-${article.slug}`}
      >
        <div className="mb-3 flex items-start justify-between gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            <MapPin className="mr-1 h-3 w-3" />
            {article.cityName}, {article.stateCode}
          </Badge>
          {article.datePublished && (
            <span className="text-xs text-muted-foreground" data-testid={`text-date-${article.slug}`}>
              {formatDate(article.datePublished)}
            </span>
          )}
        </div>

        <h3 className="mb-3 font-semibold leading-snug line-clamp-3" data-testid={`text-title-${article.slug}`}>
          {article.title}
        </h3>

        <div className="mt-auto flex items-center gap-1 pt-3 text-sm font-medium text-primary">
          Read insight
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

export default function ArticleGrid({ articles }: { articles: ArticleWithCity[] }) {
  const [search, setSearch] = useState("")
  const [stateFilter, setStateFilter] = useState<string>("")
  const [detectedState, setDetectedState] = useState<GeoResult | null>(null)
  const [geoLoaded, setGeoLoaded] = useState(false)

  // IP geo auto-filter — mirrors app/city-grid.tsx behavior so the two hubs
  // feel identical. If detected state has at least one article, auto-select it.
  useEffect(() => {
    fetch("/api/geo")
      .then((res) => res.json())
      .then((data: GeoResult) => {
        setDetectedState(data)
        if (data.stateCode) {
          const hasArticlesInState = articles.some((a) => a.stateCode === data.stateCode)
          if (hasArticlesInState) {
            setStateFilter(data.stateCode)
          }
        }
        setGeoLoaded(true)
      })
      .catch(() => {
        setGeoLoaded(true)
      })
  }, [articles])

  const states = useMemo(() => {
    const stateSet = new Set(articles.map((a) => a.stateCode))
    return Array.from(stateSet).sort()
  }, [articles])

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const matchSearch =
        !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.cityName.toLowerCase().includes(search.toLowerCase()) ||
        a.stateCode.toLowerCase().includes(search.toLowerCase()) ||
        a.stateName.toLowerCase().includes(search.toLowerCase())
      const matchState = !stateFilter || a.stateCode === stateFilter
      return matchSearch && matchState
    })
  }, [articles, search, stateFilter])

  const isAutoFiltered =
    geoLoaded && detectedState?.stateCode && stateFilter === detectedState.stateCode

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-insights-title">
            Our Insights
          </h2>
          <p className="text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "insight" : "insights"} found
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search insights or cities..."
              className="w-72 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-insights"
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
        <div
          className="mb-6 flex items-center justify-between gap-3 flex-wrap rounded-md border bg-muted/30 px-4 py-3"
          data-testid="div-geo-banner"
        >
          <div className="flex items-center gap-2 text-sm">
            <Navigation className="h-4 w-4 text-primary shrink-0" />
            <span>
              Showing insights near you in{" "}
              <span className="font-medium">
                {detectedState?.stateName || detectedState?.stateCode}
              </span>
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStateFilter("")}
            data-testid="button-show-all-insights"
          >
            Show All Insights
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Newspaper className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="mb-1 text-lg font-medium">No insights found</p>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}

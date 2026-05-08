"use client"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  FileText,
  CheckCircle,
  Globe,
  ArrowRight,
  Newspaper,
  ShieldAlert,
} from "lucide-react"
import { apiRequest } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"

interface DashboardStats {
  totalCities: number
  publishedCities: number
  activeTemplates: number
  assignedCities: number
  totalArticles: number
  publishedArticles: number
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: any
  color: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-3xl font-bold" data-testid={`text-stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
            {value}
          </p>
        </div>
        <div
          className="flex h-10 w-10 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  )
}

interface NoindexPreview {
  preview: boolean
  totals: {
    cities: number
    articles: number
    protectedCitiesConfigured: number
    protectedArticlesConfigured: number
  }
  willFlipToNoindex: { cities: number; articles: number }
  missingFromDatabase: { cities: string[]; articles: string[] }
}

interface IndexPreview {
  preview: boolean
  totals: {
    protectedCitiesConfigured: number
    protectedArticlesConfigured: number
    protectedCitiesInDb: number
    protectedArticlesInDb: number
  }
  willFlipToIndex: { cities: number; articles: number }
  missingFromDatabase: { cities: string[]; articles: string[] }
}

function IndexBaselineCard() {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const { data: preview, isLoading, refetch } = useQuery<IndexPreview>({
    queryKey: ["/api/admin/seo/apply-index-baseline"],
  })

  const handleApply = async () => {
    if (!preview) return
    const total = preview.willFlipToIndex.cities + preview.willFlipToIndex.articles
    if (total === 0) {
      toast({ title: "Nothing to do", description: "All protected URLs are already indexable." })
      return
    }
    if (
      !confirm(
        `Flip ${preview.willFlipToIndex.cities} cities and ${preview.willFlipToIndex.articles} articles back to INDEX. Only the ${preview.totals.protectedCitiesConfigured + preview.totals.protectedArticlesConfigured} protected URLs are touched. Continue?`
      )
    )
      return
    setBusy(true)
    try {
      const res = await apiRequest("POST", "/api/admin/seo/apply-index-baseline", {})
      const data = await res.json()
      toast({
        title: "Index baseline applied",
        description: `Flipped ${data.flipped.cities} cities and ${data.flipped.articles} articles back to index.`,
      })
      await refetch()
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message || "Unknown error", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-8 p-5 border-emerald-500/40">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-[260px]">
          <h3 className="font-semibold">SEO Index Baseline (restore Google-ranked URLs)</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Flips every URL on the protected list back to <code>index</code>. Use after a noindex sweep accidentally caught a now-ranking page,
            or when Google has expanded the ranking set. Idempotent — safe to re-run.
          </p>
          {isLoading || !preview ? (
            <Skeleton className="mt-3 h-5 w-72" />
          ) : (
            <div className="mt-3 text-sm space-y-1">
              <p data-testid="text-index-pending">
                <strong>{preview.willFlipToIndex.cities}</strong> cities and{" "}
                <strong>{preview.willFlipToIndex.articles}</strong> articles will flip to index.
              </p>
              <p className="text-muted-foreground text-xs">
                Protected list: {preview.totals.protectedCitiesConfigured} cities + {preview.totals.protectedArticlesConfigured} articles. In DB: {preview.totals.protectedCitiesInDb} cities, {preview.totals.protectedArticlesInDb} articles.
              </p>
              {(preview.missingFromDatabase.cities.length > 0 || preview.missingFromDatabase.articles.length > 0) && (
                <p className="text-amber-600 text-xs" data-testid="text-index-missing">
                  Note: {preview.missingFromDatabase.cities.length + preview.missingFromDatabase.articles.length} protected slug(s) are not in this DB and will be ignored.
                </p>
              )}
            </div>
          )}
        </div>
        <Button
          onClick={handleApply}
          disabled={busy || isLoading || !preview || preview.willFlipToIndex.cities + preview.willFlipToIndex.articles === 0}
          data-testid="button-apply-index-baseline"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {busy ? "Applying..." : "Apply Index Baseline"}
        </Button>
      </div>
    </Card>
  )
}

function NoindexBaselineCard() {
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const { data: preview, isLoading, refetch } = useQuery<NoindexPreview>({
    queryKey: ["/api/admin/seo/apply-noindex-baseline"],
  })

  const handleApply = async () => {
    if (!preview) return
    const total = preview.willFlipToNoindex.cities + preview.willFlipToNoindex.articles
    if (total === 0) {
      toast({ title: "Nothing to do", description: "Baseline already applied." })
      return
    }
    if (
      !confirm(
        `Flip ${preview.willFlipToNoindex.cities} cities and ${preview.willFlipToNoindex.articles} articles to NOINDEX. The 41 protected URLs will be untouched. Continue?`
      )
    )
      return
    setBusy(true)
    try {
      const res = await apiRequest("POST", "/api/admin/seo/apply-noindex-baseline", {})
      const data = await res.json()
      toast({
        title: "Baseline applied",
        description: `Flipped ${data.flipped.cities} cities and ${data.flipped.articles} articles to noindex.`,
      })
      await refetch()
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message || "Unknown error", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-8 p-5 border-amber-500/40">
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-500/15 text-amber-600">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-[260px]">
          <h3 className="font-semibold">SEO Noindex Baseline</h3>
          <p className="text-sm text-muted-foreground mt-1">
            One-time switch. Flips every city and press release to <code>noindex</code> EXCEPT the 41 protected URLs Google currently ranks.
            Idempotent — safe to re-run.
          </p>
          {isLoading || !preview ? (
            <Skeleton className="mt-3 h-5 w-72" />
          ) : (
            <div className="mt-3 text-sm space-y-1">
              <p data-testid="text-noindex-pending">
                <strong>{preview.willFlipToNoindex.cities}</strong> cities and{" "}
                <strong>{preview.willFlipToNoindex.articles}</strong> articles will flip to noindex.
              </p>
              <p className="text-muted-foreground text-xs">
                Protected: {preview.totals.protectedCitiesConfigured} cities + {preview.totals.protectedArticlesConfigured} articles. Total in DB: {preview.totals.cities} cities, {preview.totals.articles} articles.
              </p>
              {(preview.missingFromDatabase.cities.length > 0 || preview.missingFromDatabase.articles.length > 0) && (
                <p className="text-amber-600 text-xs" data-testid="text-noindex-missing">
                  Note: {preview.missingFromDatabase.cities.length + preview.missingFromDatabase.articles.length} protected slug(s) are not in the DB and will be ignored.
                </p>
              )}
            </div>
          )}
        </div>
        <Button
          onClick={handleApply}
          disabled={busy || isLoading || !preview || preview.willFlipToNoindex.cities + preview.willFlipToNoindex.articles === 0}
          data-testid="button-apply-noindex-baseline"
        >
          {busy ? "Applying..." : "Apply Noindex Baseline"}
        </Button>
      </div>
    </Card>
  )
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/admin/stats"],
  })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold" data-testid="text-admin-title">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage your city locations and content templates
        </p>
      </div>

      {isLoading ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Cities"
            value={stats.totalCities}
            icon={MapPin}
            color="#3b82f6"
          />
          <StatCard
            label="Published"
            value={stats.publishedCities}
            icon={CheckCircle}
            color="#22c55e"
          />
          <StatCard
            label="Active Templates"
            value={stats.activeTemplates}
            icon={FileText}
            color="#a855f7"
          />
          <StatCard
            label="Assigned"
            value={stats.assignedCities}
            icon={Globe}
            color="#f97316"
          />
          <StatCard
            label="Articles Published"
            value={stats.publishedArticles}
            icon={Newspaper}
            color="#06b6d4"
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/admin/cities" data-testid="link-manage-cities">
          <Card className="group cursor-pointer p-6 hover-elevate">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Manage Cities</h3>
                  <p className="text-sm text-muted-foreground">
                    View, edit, and publish city pages
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/templates" data-testid="link-manage-templates">
          <Card className="group cursor-pointer p-6 hover-elevate">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Content Templates</h3>
                  <p className="text-sm text-muted-foreground">
                    Create and manage content templates
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Card>
        </Link>

        <Link href="/admin/knowledge" data-testid="link-manage-knowledge">
          <Card className="group cursor-pointer p-6 hover-elevate">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Newspaper className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Knowledge / Press Releases</h3>
                  <p className="text-sm text-muted-foreground">
                    Create and publish press releases
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}

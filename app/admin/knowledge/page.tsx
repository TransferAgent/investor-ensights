"use client"
import { useState, useMemo, useCallback } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus,
  Pencil,
  Trash2,
  Send,
  Archive,
  ArchiveRestore,
  History,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
  BarChart3,
  Clock,
  FileText,
  TrendingUp,
  RefreshCw,
  Layers,
  Map,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  ShieldOff,
  Zap,
  Pause,
  Play,
} from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { SchedulerCard } from "./scheduler-card"

interface CityRecord {
  id: string
  slug: string
  cityName: string
  stateCode: string
}

interface KnowledgeArticle {
  id: string
  slug: string
  status: string
  title: string
  headline: string
  subheadline: string | null
  dateline: string | null
  metaDescription: string | null
  bodyHtml: string
  boilerplateHtml: string | null
  ogImageUrl: string | null
  imageWidth: number | null
  imageHeight: number | null
  authorName: string
  publisherName: string
  robots: string
  datePublished: string | null
  dateModified: string
  createdAt: string
  updatedAt: string
  campaignId: string | null
  citySlug: string | null
}

interface KnowledgeCampaign {
  id: string
  name: string
  slug: string
  templateId: string | null
  status: string
  description: string | null
  articleCount: number
  createdAt: string
  updatedAt: string
}

interface ArticleVersion {
  id: string
  articleId: string
  versionNumber: number
  snapshotReason: string
  createdAt: string
  createdBy: string | null
}

interface KnowledgeMetrics {
  today: number
  thisWeek: number
  avgPerDay: number
  pendingCount: number
}

interface AnalyticsData {
  publishedThisMonth: number
  discoverEligible: number
  avgFreshnessScore: number
  pendingCount: number
}

interface CoverageEntry {
  citySlug: string
  cityName: string
  state: string
  status: string
  lastPublished: string | null
}

interface GenerationLogEntry {
  id: string
  citySlug: string
  directive: string | null
  status: string
  errorMessage: string | null
  createdAt: string
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  published: "bg-green-500/10 text-green-500 border-green-500/20",
  archived: "bg-gray-500/10 text-gray-400 border-gray-500/20",
}

function getFreshnessBadge(article: KnowledgeArticle) {
  if (article.status !== "published" || !article.datePublished) return null
  const now = Date.now()
  const published = new Date(article.datePublished).getTime()
  const hoursAgo = (now - published) / (1000 * 60 * 60)
  if (hoursAgo < 24) {
    return <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500" data-testid="badge-fresh">🟢 Fresh</span>
  }
  if (hoursAgo < 24 * 7) {
    return <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500" data-testid="badge-recent">🟡 Recent</span>
  }
  return <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500" data-testid="badge-aging">🔴 Aging</span>
}

interface KnowledgeTemplateItem {
  id: string
  name: string
  titlePattern: string
  headlinePattern: string
  subheadlinePattern: string | null
  metaDescriptionPattern: string | null
  datelinePattern: string | null
  bodyHtmlPattern: string
  boilerplateHtml: string | null
  ogImageUrl: string | null
  isActive: boolean
  allowIndexing: boolean
  createdAt: string
  updatedAt: string
}

type TabType = "articles" | "content-studio" | "analytics" | "coverage" | "templates" | "seo-visibility"

export default function KnowledgeAdmin() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<TabType>("articles")
  const [createOpen, setCreateOpen] = useState(false)
  const [editArticle, setEditArticle] = useState<KnowledgeArticle | null>(null)
  const [versionsArticle, setVersionsArticle] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("")
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateCitySlug, setGenerateCitySlug] = useState("")
  const [generateDirective, setGenerateDirective] = useState("")
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkState, setBulkState] = useState("")
  const [bulkSelected, setBulkSelected] = useState<string[]>([])
  const [bulkDirective, setBulkDirective] = useState("")
  const [bulkResult, setBulkResult] = useState<any>(null)
  const [coverageStateFilter, setCoverageStateFilter] = useState("")
  const [coverageStatusFilter, setCoverageStatusFilter] = useState("")
  const [templateCreateOpen, setTemplateCreateOpen] = useState(false)
  const [editTemplate, setEditTemplate] = useState<KnowledgeTemplateItem | null>(null)
  const [generateFromTemplateOpen, setGenerateFromTemplateOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState("")
  const [autoPublish, setAutoPublish] = useState(true)
  const [generateResult, setGenerateResult] = useState<any>(null)
  const [selectedArticles, setSelectedArticles] = useState<string[]>([])
  const [toolbarTemplateId, setToolbarTemplateId] = useState("")

  const [studioTemplateId, setStudioTemplateId] = useState("")
  const [studioStateFilter, setStudioStateFilter] = useState("")
  const [studioSelectedCities, setStudioSelectedCities] = useState<string[]>([])
  const [studioAutoPublish, setStudioAutoPublish] = useState(true)
  const [studioUpdateExisting, setStudioUpdateExisting] = useState(false)
  const [studioResult, setStudioResult] = useState<any>(null)
  const [studioSource, setStudioSource] = useState<"haylo" | "template">("haylo")
  const [studioHayloId, setStudioHayloId] = useState("")
  const [studioDryRun, setStudioDryRun] = useState(true)
  const [studioPreviewCity, setStudioPreviewCity] = useState<string>("")
  const [studioCampaignName, setStudioCampaignName] = useState("")
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({ uncategorized: true })


  const [formSlug, setFormSlug] = useState("")
  const [formTitle, setFormTitle] = useState("")
  const [formHeadline, setFormHeadline] = useState("")
  const [formSubheadline, setFormSubheadline] = useState("")
  const [formDateline, setFormDateline] = useState("")
  const [formMetaDesc, setFormMetaDesc] = useState("")
  const [formBody, setFormBody] = useState("")
  const [formBoilerplate, setFormBoilerplate] = useState("")
  const [formOgImage, setFormOgImage] = useState("")
  const [formAuthor, setFormAuthor] = useState("Tableicity")
  const [formPublisher, setFormPublisher] = useState("Tableicity")

  const { data: articles, isLoading } = useQuery<KnowledgeArticle[]>({
    queryKey: ["/api/admin/knowledge", filterStatus],
    queryFn: async () => {
      const url = filterStatus ? `/api/admin/knowledge?status=${filterStatus}` : "/api/admin/knowledge"
      const res = await fetch(url, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load")
      return res.json()
    },
  })

  const { data: metrics } = useQuery<KnowledgeMetrics>({
    queryKey: ["/api/admin/knowledge/metrics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/knowledge/metrics", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load metrics")
      return res.json()
    },
  })

  const { data: campaigns } = useQuery<KnowledgeCampaign[]>({
    queryKey: ["/api/admin/campaigns"],
    queryFn: async () => {
      const res = await fetch("/api/admin/campaigns", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load campaigns")
      return res.json()
    },
  })

  const { data: analytics } = useQuery<AnalyticsData>({
    queryKey: ["/api/admin/knowledge/analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/knowledge/analytics", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load analytics")
      return res.json()
    },
    enabled: activeTab === "analytics",
  })

  const { data: coverage } = useQuery<CoverageEntry[]>({
    queryKey: ["/api/admin/knowledge/coverage"],
    queryFn: async () => {
      const res = await fetch("/api/admin/knowledge/coverage", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load coverage")
      return res.json()
    },
    enabled: activeTab === "coverage",
  })

  const { data: genLogData } = useQuery<{ logs: GenerationLogEntry[]; callsToday: number }>({
    queryKey: ["/api/admin/knowledge/generation-log"],
    queryFn: async () => {
      const res = await fetch("/api/admin/knowledge/generation-log?limit=50", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load generation log")
      return res.json()
    },
  })

  const { data: versions } = useQuery<ArticleVersion[]>({
    queryKey: ["/api/admin/knowledge", versionsArticle, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/knowledge/${versionsArticle}/versions`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load")
      return res.json()
    },
    enabled: !!versionsArticle,
  })

  const { data: cities } = useQuery<CityRecord[]>({
    queryKey: ["/api/locations"],
    queryFn: async () => {
      const res = await fetch("/api/locations", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load cities")
      return res.json()
    },
  })

  const { data: knowledgeTemplates, isLoading: templatesLoading } = useQuery<KnowledgeTemplateItem[]>({
    queryKey: ["/api/admin/knowledge-templates"],
    queryFn: async () => {
      const res = await fetch("/api/admin/knowledge-templates", { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load templates")
      return res.json()
    },
    enabled: activeTab === "templates" || activeTab === "content-studio" || activeTab === "articles",
  })

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/admin/knowledge-templates", data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-templates"] })
      toast({ title: "Template created" })
      setTemplateCreateOpen(false)
    },
  })

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/admin/knowledge-templates/${id}`, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-templates"] })
      toast({ title: "Template updated" })
      setEditTemplate(null)
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/knowledge-templates/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge-templates"] })
      toast({ title: "Template deleted" })
    },
  })

  const generateFromTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/knowledge-templates/generate", {
        templateId: selectedTemplateId,
        autoPublish,
      })
      return res.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/coverage"] })
      setGenerateResult(data)
      toast({ title: `Generated ${data.generated} articles` })
    },
  })

  const studioApplyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/knowledge-templates/generate", {
        templateId: studioTemplateId,
        autoPublish: studioAutoPublish,
        citySlugs: studioSelectedCities,
        updateExisting: studioUpdateExisting,
        campaignName: studioCampaignName || undefined,
      })
      return res.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/coverage"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] })
      setStudioResult({ ...data, _kind: "template" })
      const parts = []
      if (data.generated > 0) parts.push(`${data.generated} created`)
      if (data.updated > 0) parts.push(`${data.updated} updated`)
      if (data.skipped > 0) parts.push(`${data.skipped} skipped`)
      if (data.errors > 0) parts.push(`${data.errors} errors`)
      toast({ title: "Template applied", description: parts.join(", ") })
    },
    onError: (err: any) => {
      toast({ title: "Apply failed", description: err.message, variant: "destructive" })
    },
  })

  const { data: hayloArticlesList, isLoading: hayloListLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/haylo-articles", { status: "ready" }],
    queryFn: async () => {
      const res = await fetch("/api/admin/haylo-articles?status=ready", { credentials: "include" })
      if (!res.ok) return []
      return res.json()
    },
  })

  const studioPairMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/newsroom/enqueue-pairs", {
        hayloArticleId: studioHayloId,
        citySlugs: studioSelectedCities,
        dryRun: studioDryRun,
      })
      return res.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/review"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/haylo-articles"] })
      setStudioResult({ ...data, _kind: "haylo" })
      const s = data.summary || {}
      const parts = []
      if (s.passed > 0) parts.push(`${s.passed} passed → Articles`)
      if (s.warned > 0) parts.push(`${s.warned} need review → Newsroom`)
      if (s.failed > 0) parts.push(`${s.failed} blocked`)
      if (s.skipped > 0) parts.push(`${s.skipped} skipped`)
      if (s.errored > 0) parts.push(`${s.errored} errored`)
      toast({ title: data.dryRun ? "Pair completed (dry run)" : "Pair completed", description: parts.join(" · ") || "no rows" })
    },
    onError: (err: any) => {
      toast({ title: "Pair failed", description: err.message, variant: "destructive" })
    },
  })

  const bulkArchiveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = []
      for (const id of ids) {
        const res = await apiRequest("POST", `/api/admin/knowledge/${id}/archive`)
        results.push(res)
      }
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      toast({ title: "Articles archived" })
      setSelectedArticles([])
    },
  })

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/knowledge/generate-local-vibe", {
        citySlug: generateCitySlug,
        manualDirective: generateDirective || undefined,
        promptVersion: "v1",
      })
      return res.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/generation-log"] })
      setGenerateOpen(false)
      setGenerateCitySlug("")
      setGenerateDirective("")
      toast({
        title: "Local Vibe draft created",
        description: data.slug ? `Pending article: ${data.slug}` : "Draft created successfully",
      })
    },
    onError: (err: any) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/knowledge/bulk-generate", {
        citySlugs: bulkSelected,
        manualDirective: bulkDirective || undefined,
      })
      return res.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/generation-log"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/coverage"] })
      setBulkResult(data)
      toast({
        title: "Bulk generation complete",
        description: `${data.summary?.generated || 0} generated, ${data.summary?.skipped || 0} skipped, ${data.summary?.failed || 0} failed`,
      })
    },
    onError: (err: any) => {
      toast({ title: "Bulk generation failed", description: err.message, variant: "destructive" })
    },
  })

  const regenMutation = useMutation({
    mutationFn: async (article: KnowledgeArticle) => {
      const citySlug = article.slug.replace(/-local-vibe.*$/, "").replace(/-regen.*$/, "")
      const res = await apiRequest("POST", "/api/knowledge/generate-local-vibe", {
        citySlug,
        manualDirective: `Refresh: generate an updated Local Vibe for ${citySlug}`,
        promptVersion: "v1",
      })
      return res.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/generation-log"] })
      toast({
        title: "Re-generation complete",
        description: data.slug ? `New pending draft: ${data.slug}` : "New draft created",
      })
    },
    onError: (err: any) => {
      toast({ title: "Re-generation failed", description: err.message, variant: "destructive" })
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/knowledge", {
        slug: formSlug,
        title: formTitle,
        headline: formHeadline,
        subheadline: formSubheadline || null,
        dateline: formDateline || null,
        metaDescription: formMetaDesc || null,
        bodyHtml: formBody,
        boilerplateHtml: formBoilerplate || null,
        ogImageUrl: formOgImage || null,
        authorName: formAuthor,
        publisherName: formPublisher,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      setCreateOpen(false)
      resetForm()
      toast({ title: "Article created" })
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editArticle) return
      return apiRequest("PATCH", `/api/admin/knowledge/${editArticle.id}`, {
        slug: formSlug,
        title: formTitle,
        headline: formHeadline,
        subheadline: formSubheadline || null,
        dateline: formDateline || null,
        metaDescription: formMetaDesc || null,
        bodyHtml: formBody,
        boilerplateHtml: formBoilerplate || null,
        ogImageUrl: formOgImage || null,
        authorName: formAuthor,
        publisherName: formPublisher,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      setEditArticle(null)
      resetForm()
      toast({ title: "Article updated" })
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" })
    },
  })

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/knowledge/${id}/publish`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      toast({ title: "Article published" })
    },
    onError: (err: any) => {
      toast({ title: "Publish blocked", description: err.message, variant: "destructive" })
    },
  })

  const unpublishMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/knowledge/${id}/unpublish`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/analytics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/coverage"] })
      toast({ title: "Article unpublished", description: "Status changed back to pending" })
    },
    onError: (err: any) => {
      toast({ title: "Unpublish failed", description: err.message, variant: "destructive" })
    },
  })

  const bulkUnpublishMutation = useMutation({
    mutationFn: async (articleIds: string[]) => {
      const res = await apiRequest("POST", "/api/admin/knowledge/bulk-unpublish", { articleIds })
      return res.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/analytics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/coverage"] })
      setSelectedArticles([])
      toast({
        title: "Bulk unpublish complete",
        description: `${data.unpublished} unpublished, ${data.skipped} skipped`,
      })
    },
    onError: (err: any) => {
      toast({ title: "Bulk unpublish failed", description: err.message, variant: "destructive" })
    },
  })

  const bulkPublishMutation = useMutation({
    mutationFn: async (articleIds: string[]) => {
      const res = await apiRequest("POST", "/api/admin/knowledge/bulk-publish", { articleIds })
      return res.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/analytics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/coverage"] })
      setSelectedArticles([])
      toast({
        title: "Bulk publish complete",
        description: data.published + " published, " + data.skipped + " skipped",
      })
    },
    onError: (err: any) => {
      toast({ title: "Bulk publish failed", description: err.message, variant: "destructive" })
    },
  })

  const bulkRestoreMutation = useMutation({
    mutationFn: async (articleIds: string[]) => {
      const res = await apiRequest("POST", "/api/admin/knowledge/bulk-restore", { articleIds })
      return res.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/analytics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/coverage"] })
      setSelectedArticles([])
      toast({
        title: "Bulk restore complete",
        description: data.restored + " restored, " + data.skipped + " skipped",
      })
    },
    onError: (err: any) => {
      toast({ title: "Bulk restore failed", description: err.message, variant: "destructive" })
    },
  })

  const bulkApplyTemplateMutation = useMutation({
    mutationFn: async ({ articleIds, templateId }: { articleIds: string[]; templateId: string }) => {
      const res = await apiRequest("POST", "/api/admin/knowledge/bulk-apply-template", { articleIds, templateId })
      return res.json()
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/analytics"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/coverage"] })
      setSelectedArticles([])
      setToolbarTemplateId("")
      const parts: string[] = []
      if (data.updated > 0) parts.push(data.updated + " updated")
      if (data.skipped > 0) parts.push(data.skipped + " skipped")
      if (data.errors > 0) parts.push(data.errors + " errors")
      toast({ title: "Template applied", description: parts.join(", ") })
    },
    onError: (err: any) => {
      toast({ title: "Apply template failed", description: err.message, variant: "destructive" })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/knowledge/${id}/archive`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      toast({ title: "Article archived" })
    },
  })

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/knowledge/${id}/unarchive`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      toast({ title: "Article restored to draft" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/knowledge/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge/metrics"] })
      toast({ title: "Article deleted" })
    },
  })

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/campaigns/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      toast({ title: "Campaign deleted", description: "Campaign and all its articles have been deleted" })
    },
  })

  const sortedCampaignGroups = useMemo((): Array<[string, { campaign: KnowledgeCampaign | null; articles: KnowledgeArticle[] }]> => {
    if (!articles?.length) return []
    const keys: string[] = []
    const groups: Record<string, { campaign: KnowledgeCampaign | null; articles: KnowledgeArticle[] }> = {}
    for (let i = 0; i < articles.length; i++) {
      const a = articles[i]
      const key = a.campaignId || "uncategorized"
      if (!groups[key]) {
        keys.push(key)
        const c = campaigns?.find((camp) => camp.id === key) || null
        groups[key] = { campaign: c, articles: [] }
      }
      groups[key].articles.push(a)
    }
    return keys.map((k) => [k, groups[k]] as [string, { campaign: KnowledgeCampaign | null; articles: KnowledgeArticle[] }]).sort((a, b) => {
      if (a[0] === "uncategorized") return 1
      if (b[0] === "uncategorized") return -1
      return (b[1].campaign?.createdAt || "").localeCompare(a[1].campaign?.createdAt || "")
    })
  }, [articles, campaigns])

  const toggleCampaign = useCallback((key: string) => {
    setExpandedCampaigns((prev) => {
      const copy = Object.assign({}, prev)
      if (copy[key]) {
        delete copy[key]
      } else {
        copy[key] = true
      }
      return copy
    })
  }, [])

  function resetForm() {
    setFormSlug("")
    setFormTitle("")
    setFormHeadline("")
    setFormSubheadline("")
    setFormDateline("")
    setFormMetaDesc("")
    setFormBody("")
    setFormBoilerplate("")
    setFormOgImage("")
    setFormAuthor("Tableicity")
    setFormPublisher("Tableicity")
  }

  function openEdit(a: KnowledgeArticle) {
    setFormSlug(a.slug)
    setFormTitle(a.title)
    setFormHeadline(a.headline)
    setFormSubheadline(a.subheadline || "")
    setFormDateline(a.dateline || "")
    setFormMetaDesc(a.metaDescription || "")
    setFormBody(a.bodyHtml)
    setFormBoilerplate(a.boilerplateHtml || "")
    setFormOgImage(a.ogImageUrl || "")
    setFormAuthor(a.authorName)
    setFormPublisher(a.publisherName)
    setEditArticle(a)
  }

  const uniqueStates = cities ? Array.from(cities.reduce((acc: string[], c) => { if (acc.indexOf(c.stateCode) === -1) acc.push(c.stateCode); return acc }, [] as string[])).sort() : []
  const filteredCitiesForBulk = bulkState
    ? cities?.filter(c => c.stateCode === bulkState) || []
    : []

  const coverageStates = coverage ? Array.from(coverage.reduce((acc: string[], c) => { if (acc.indexOf(c.state) === -1) acc.push(c.state); return acc }, [] as string[])).sort() : []
  const filteredCoverage = coverage?.filter(c => {
    if (coverageStateFilter && coverageStateFilter !== "all" && c.state !== coverageStateFilter) return false
    if (coverageStatusFilter && coverageStatusFilter !== "all" && c.status !== coverageStatusFilter) return false
    return true
  }) || []

  const articleForm = (isEdit: boolean) => (
    <div className="grid gap-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div>
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="my-press-release" data-testid="input-slug" />
        </div>
        <div>
          <Label htmlFor="dateline">Dateline</Label>
          <Input id="dateline" value={formDateline} onChange={(e) => setFormDateline(e.target.value)} placeholder="NEW YORK, March 18, 2026" className="w-[220px]" data-testid="input-dateline" />
        </div>
      </div>
      <div>
        <Label htmlFor="headline">Headline (HTML supported)</Label>
        <Textarea id="headline" value={formHeadline} onChange={(e) => setFormHeadline(e.target.value)} placeholder="Press release headline — supports <h2>, <strong>, etc." rows={2} className="font-mono text-xs" data-testid="input-headline" />
      </div>
      <div>
        <Label htmlFor="title">Meta Title</Label>
        <Input id="title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="SEO page title" data-testid="input-title" />
      </div>
      <div>
        <Label htmlFor="metaDesc">Meta Description</Label>
        <Textarea id="metaDesc" value={formMetaDesc} onChange={(e) => setFormMetaDesc(e.target.value)} placeholder="SEO meta description" rows={2} data-testid="input-meta-desc" />
      </div>
      <div>
        <Label htmlFor="subheadline">Subheadline (HTML supported)</Label>
        <Textarea id="subheadline" value={formSubheadline} onChange={(e) => setFormSubheadline(e.target.value)} placeholder="Optional subheadline — supports <h2>, <strong>, etc." rows={2} className="font-mono text-xs" data-testid="input-subheadline" />
      </div>
      <div>
        <Label htmlFor="body">Body HTML</Label>
        <Textarea id="body" value={formBody} onChange={(e) => setFormBody(e.target.value)} placeholder="<p>Article body content...</p>" rows={10} className="font-mono text-xs" data-testid="input-body" />
      </div>
      <div>
        <Label htmlFor="boilerplate">Boilerplate HTML (About section)</Label>
        <Textarea id="boilerplate" value={formBoilerplate} onChange={(e) => setFormBoilerplate(e.target.value)} placeholder="<p>About Tableicity...</p>" rows={3} className="font-mono text-xs" data-testid="input-boilerplate" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="author">Author Name</Label>
          <Input id="author" value={formAuthor} onChange={(e) => setFormAuthor(e.target.value)} data-testid="input-author" />
        </div>
        <div>
          <Label htmlFor="publisher">Publisher Name</Label>
          <Input id="publisher" value={formPublisher} onChange={(e) => setFormPublisher(e.target.value)} data-testid="input-publisher" />
        </div>
      </div>
      <div>
        <Label htmlFor="ogImage">OG Image URL</Label>
        <Input id="ogImage" value={formOgImage} onChange={(e) => setFormOgImage(e.target.value)} placeholder="https://..." data-testid="input-og-image" />
      </div>
      <Button
        onClick={() => isEdit ? updateMutation.mutate() : createMutation.mutate()}
        disabled={isEdit ? updateMutation.isPending : createMutation.isPending}
        data-testid="button-save-article"
      >
        {isEdit ? "Save Changes" : "Create Draft"}
      </Button>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Knowledge / Press Releases</h1>
          <p className="text-sm text-muted-foreground mt-1">Create, edit, publish, and archive press releases</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild data-testid="button-view-live">
            <a href="/sitemap.xml" target="_blank" rel="noopener">
              <Eye className="mr-2 h-4 w-4" /> View Live
            </a>
          </Button>
          <Dialog open={bulkOpen} onOpenChange={(o) => { setBulkOpen(o); if (!o) { setBulkState(""); setBulkSelected([]); setBulkDirective(""); setBulkResult(null) } }}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-bulk-generate">
                <Layers className="mr-2 h-4 w-4" /> Bulk Generate
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Bulk Generate Local Vibe (up to 50 cities)</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label>State/Region (required)</Label>
                  <Select value={bulkState} onValueChange={(v) => { setBulkState(v); setBulkSelected([]) }}>
                    <SelectTrigger data-testid="select-bulk-state">
                      <SelectValue placeholder="Select state..." />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueStates.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {bulkState && filteredCitiesForBulk.length > 0 && (
                  <div>
                    <Label>Select Cities ({bulkSelected.length}/{Math.min(filteredCitiesForBulk.length, 50)})</Label>
                    <div className="border rounded p-2 max-h-48 overflow-y-auto space-y-1 mt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => {
                          if (bulkSelected.length === Math.min(filteredCitiesForBulk.length, 50)) {
                            setBulkSelected([])
                          } else {
                            setBulkSelected(filteredCitiesForBulk.slice(0, 50).map(c => c.slug))
                          }
                        }}
                        data-testid="button-bulk-select-all"
                      >
                        {bulkSelected.length === Math.min(filteredCitiesForBulk.length, 50) ? "Deselect All" : "Select All"}
                      </Button>
                      {filteredCitiesForBulk.slice(0, 50).map(c => (
                        <label key={c.slug} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={bulkSelected.includes(c.slug)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBulkSelected(prev => [...prev, c.slug])
                              } else {
                                setBulkSelected(prev => prev.filter(s => s !== c.slug))
                              }
                            }}
                          />
                          {c.cityName}, {c.stateCode}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <Label>Global Directive (optional)</Label>
                  <Textarea
                    value={bulkDirective}
                    onChange={(e) => setBulkDirective(e.target.value)}
                    placeholder="Applies to all cities in this batch"
                    rows={2}
                    data-testid="input-bulk-directive"
                  />
                </div>
                <Button
                  onClick={() => bulkMutation.mutate()}
                  disabled={!bulkState || bulkSelected.length === 0 || bulkMutation.isPending}
                  data-testid="button-bulk-submit"
                >
                  {bulkMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating {bulkSelected.length} cities...
                    </>
                  ) : (
                    <>
                      <Layers className="mr-2 h-4 w-4" /> Bulk Generate ({bulkSelected.length} cities)
                    </>
                  )}
                </Button>
                {bulkResult && (
                  <Card className="p-3 text-sm" data-testid="bulk-result-card">
                    <div className="flex items-center gap-2 mb-2 font-medium">
                      <CheckCircle className="h-4 w-4 text-green-500" /> Batch Complete
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-green-500">{bulkResult.summary?.generated || 0}</div>
                        <div className="text-xs text-muted-foreground">Generated</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-yellow-500">{bulkResult.summary?.skipped || 0}</div>
                        <div className="text-xs text-muted-foreground">Skipped</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-500">{bulkResult.summary?.failed || 0}</div>
                        <div className="text-xs text-muted-foreground">Failed</div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={generateOpen} onOpenChange={(o) => { setGenerateOpen(o); if (!o) { setGenerateCitySlug(""); setGenerateDirective("") } }}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-generate-local-vibe">
                <Sparkles className="mr-2 h-4 w-4" /> Generate Local Vibe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Generate Local Vibe Draft</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="generate-city">Select City</Label>
                  <Select value={generateCitySlug} onValueChange={setGenerateCitySlug}>
                    <SelectTrigger data-testid="select-generate-city">
                      <SelectValue placeholder="Choose a city..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cities?.sort((a, b) => a.cityName.localeCompare(b.cityName)).map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>
                          {c.cityName}, {c.stateCode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="generate-directive">Directive (optional, 20% human oversight)</Label>
                  <Textarea
                    id="generate-directive"
                    value={generateDirective}
                    onChange={(e) => setGenerateDirective(e.target.value)}
                    placeholder="e.g. Focus on cap table audit readiness for US founders and CFOs"
                    rows={3}
                    data-testid="input-generate-directive"
                  />
                </div>
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={!generateCitySlug || generateMutation.isPending}
                  data-testid="button-generate-submit"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" /> Generate Draft
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Creates a <strong>pending</strong> article via the draft pipeline. Must be reviewed and published manually.
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm() }}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-article">
                <Plus className="mr-2 h-4 w-4" /> New Article
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Article</DialogTitle>
              </DialogHeader>
              {articleForm(false)}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6" data-testid="metrics-panel">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground font-medium">Published Today</span>
            </div>
            <p className="text-2xl font-bold" data-testid="metric-today">{metrics.today}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground font-medium">This Week</span>
            </div>
            <p className="text-2xl font-bold" data-testid="metric-week">{metrics.thisWeek}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-purple-500" />
              <span className="text-xs text-muted-foreground font-medium">Avg/Day (7d)</span>
            </div>
            <p className="text-2xl font-bold" data-testid="metric-avg">{metrics.avgPerDay}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold" data-testid="metric-pending">{metrics.pendingCount}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-muted-foreground font-medium">Gen Calls Today</span>
            </div>
            <p className="text-2xl font-bold" data-testid="metric-gen-today">
              {genLogData?.callsToday || 0}
              {(genLogData?.callsToday || 0) > 40 && (
                <AlertTriangle className="inline ml-2 h-4 w-4 text-red-500" />
              )}
            </p>
          </Card>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(["articles", "content-studio", "templates", "analytics", "coverage", "seo-visibility"] as TabType[]).map((tab) => {
          const tabLabels: Record<string, string> = {
            "articles": "Articles",
            "content-studio": "Content Studio",
            "templates": "Templates",
            "analytics": "Analytics",
            "coverage": "Coverage",
            "seo-visibility": "SEO Visibility",
          }
          return (
            <Button
              key={tab}
              variant={activeTab === tab ? "secondary" : "outline"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              data-testid={`tab-${tab}`}
            >
              {tab === "articles" && <FileText className="mr-1.5 h-3.5 w-3.5" />}
              {tab === "content-studio" && <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              {tab === "templates" && <Layers className="mr-1.5 h-3.5 w-3.5" />}
              {tab === "analytics" && <BarChart3 className="mr-1.5 h-3.5 w-3.5" />}
              {tab === "coverage" && <Map className="mr-1.5 h-3.5 w-3.5" />}
              {tab === "seo-visibility" && <ShieldOff className="mr-1.5 h-3.5 w-3.5" />}
              {tabLabels[tab] || tab}
            </Button>
          )
        })}
      </div>

      {activeTab === "seo-visibility" && <SeoVisibilitySection />}

      {activeTab === "articles" && (
        <>
          <div className="flex gap-2 mb-4">
            {["", "pending", "published", "archived"].map((s) => (
              <Button
                key={s}
                variant={filterStatus === s ? "secondary" : "outline"}
                size="sm"
                onClick={() => setFilterStatus(s)}
                data-testid={`button-filter-${s || "all"}`}
              >
                {s || "All"}
              </Button>
            ))}
          </div>

          {selectedArticles.length > 0 && (
            <div className="flex items-center gap-3 mb-3 p-3 bg-muted/50 border rounded-lg" data-testid="bulk-action-bar">
              <span className="text-sm font-medium" data-testid="text-selected-count">
                {selectedArticles.length} selected
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const pendingIds = selectedArticles.filter(function(id) {
                    return articles?.find(function(a) { return a.id === id && a.status === "pending" })
                  })
                  if (pendingIds.length === 0) {
                    toast({ title: "No pending articles selected", description: "Only pending articles can be published", variant: "destructive" })
                    return
                  }
                  if (confirm("Publish " + pendingIds.length + " article(s)?")) {
                    bulkPublishMutation.mutate(pendingIds)
                  }
                }}
                disabled={bulkPublishMutation.isPending}
                data-testid="button-bulk-publish"
              >
                {bulkPublishMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing...</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /> Publish Selected</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const publishedIds = selectedArticles.filter(id =>
                    articles?.find(a => a.id === id && a.status === "published")
                  )
                  if (publishedIds.length === 0) {
                    toast({ title: "No published articles selected", description: "Only published articles can be unpublished", variant: "destructive" })
                    return
                  }
                  if (confirm(`Unpublish ${publishedIds.length} article(s)? They will be set back to pending.`)) {
                    bulkUnpublishMutation.mutate(publishedIds)
                  }
                }}
                disabled={bulkUnpublishMutation.isPending}
                data-testid="button-bulk-unpublish"
              >
                {bulkUnpublishMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Unpublishing...</>
                ) : (
                  <><EyeOff className="mr-2 h-4 w-4" /> Unpublish Selected</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const archivableIds = selectedArticles.filter(id =>
                    articles?.find(a => a.id === id && a.status !== "archived")
                  )
                  if (archivableIds.length === 0) {
                    toast({ title: "No archivable articles selected", variant: "destructive" })
                    return
                  }
                  if (confirm(`Archive ${archivableIds.length} article(s)?`)) {
                    bulkArchiveMutation.mutate(archivableIds)
                  }
                }}
                disabled={bulkArchiveMutation.isPending}
                data-testid="button-bulk-archive"
              >
                {bulkArchiveMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Archiving...</>
                ) : (
                  <><Archive className="mr-2 h-4 w-4" /> Archive Selected</>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const archivedIds = selectedArticles.filter(function(id) {
                    return articles?.find(function(a) { return a.id === id && a.status === "archived" })
                  })
                  if (archivedIds.length === 0) {
                    toast({ title: "No archived articles selected", description: "Only archived articles can be restored", variant: "destructive" })
                    return
                  }
                  if (confirm("Restore " + archivedIds.length + " article(s) to pending?")) {
                    bulkRestoreMutation.mutate(archivedIds)
                  }
                }}
                disabled={bulkRestoreMutation.isPending}
                data-testid="button-bulk-restore"
              >
                {bulkRestoreMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Restoring...</>
                ) : (
                  <><ArchiveRestore className="mr-2 h-4 w-4" /> Restore Selected</>
                )}
              </Button>
              <div className="flex items-center gap-1 ml-2 pl-2 border-l">
                <Select value={toolbarTemplateId} onValueChange={setToolbarTemplateId}>
                  <SelectTrigger className="h-8 w-[180px] text-xs" data-testid="select-toolbar-template">
                    <SelectValue placeholder="Pick template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(knowledgeTemplates || []).map(function(t) {
                      return (
                        <SelectItem key={t.id} value={t.id} data-testid={"select-template-" + t.id}>
                          {t.name}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!toolbarTemplateId || selectedArticles.length === 0 || bulkApplyTemplateMutation.isPending}
                  onClick={function() {
                    if (confirm("Apply template to " + selectedArticles.length + " article(s)? This will overwrite their content with the selected template.")) {
                      bulkApplyTemplateMutation.mutate({ articleIds: selectedArticles, templateId: toolbarTemplateId })
                    }
                  }}
                  data-testid="button-apply-template"
                >
                  {bulkApplyTemplateMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying...</>
                  ) : (
                    <><Layers className="mr-2 h-4 w-4" /> Apply Template</>
                  )}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={function() { setSelectedArticles([]); setToolbarTemplateId("") }}
                data-testid="button-clear-selection"
              >
                Clear
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !articles?.length ? (
            <Card className="p-8 text-center text-muted-foreground" data-testid="text-no-articles">
              No articles found. Create your first press release.
            </Card>
          ) : (
            <div className="space-y-3" data-testid="campaign-grouped-view">
              {sortedCampaignGroups.map(([key, group]) => {
                const isExpanded = !!expandedCampaigns[key]
                const publishedCount = group.articles.filter((a) => a.status === "published").length
                const pendingCount = group.articles.filter((a) => a.status === "pending").length
                return (
                  <Card key={key} data-testid={`campaign-group-${key}`}>
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleCampaign(key)}
                      data-testid={`campaign-toggle-${key}`}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      {isExpanded ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
                      <span className="font-semibold text-sm">
                        {key === "uncategorized" ? "Uncategorized Articles" : (group.campaign ? group.campaign.name : key)}
                      </span>
                      <div className="flex items-center gap-2 ml-auto">
                        <Badge variant="outline" className="text-xs">{group.articles.length} articles</Badge>
                        {publishedCount > 0 && <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/20">{publishedCount} published</Badge>}
                        {pendingCount > 0 && <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{pendingCount} pending</Badge>}
                        {key !== "uncategorized" && group.campaign && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm("Delete campaign \"" + group.campaign!.name + "\" and all its articles? This cannot be undone.")) {
                                deleteCampaignMutation.mutate(group.campaign!.id)
                              }
                            }}
                            data-testid={`button-delete-campaign-${key}`}
                            title="Delete campaign (articles stay)"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {isExpanded && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[40px]">
                              <Checkbox
                                checked={group.articles.length > 0 && group.articles.every((a) => selectedArticles.includes(a.id))}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    const newIds = group.articles.map((a) => a.id)
                                    setSelectedArticles((prev) => {
                                      const all = prev.concat(newIds)
                                      const unique: string[] = []
                                      for (let i = 0; i < all.length; i++) {
                                        if (unique.indexOf(all[i]) === -1) unique.push(all[i])
                                      }
                                      return unique
                                    })
                                  } else {
                                    const groupIds = group.articles.map((a) => a.id)
                                    setSelectedArticles((prev) => prev.filter((id) => !groupIds.includes(id)))
                                  }
                                }}
                                data-testid={`checkbox-select-all-${key}`}
                                aria-label={"Select all in " + key}
                              />
                            </TableHead>
                            <TableHead>Headline</TableHead>
                            <TableHead>Slug</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Freshness</TableHead>
                            <TableHead>Modified</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.articles.map((a) => (
                            <TableRow key={a.id} data-testid={`row-article-${a.id}`}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedArticles.includes(a.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedArticles((prev) => [...prev, a.id])
                                    } else {
                                      setSelectedArticles((prev) => prev.filter((id) => id !== a.id))
                                    }
                                  }}
                                  data-testid={`checkbox-article-${a.id}`}
                                  aria-label={"Select " + a.headline}
                                />
                              </TableCell>
                              <TableCell className="font-medium max-w-[200px] truncate">{a.headline.replace(/<[^>]*>/g, "")}</TableCell>
                              <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">{a.slug}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={statusColors[a.status] || ""} data-testid={`badge-status-${a.id}`}>
                                  {a.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {getFreshnessBadge(a)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(a.updatedAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-0.5">
                                  <Button variant="ghost" size="icon" asChild data-testid={`button-view-${a.id}`} title={a.status === "published" ? "View live page" : "Preview article"}>
                                    <a href={"/discovery/knowledge/" + a.slug} target="_blank" rel="noopener">
                                      <Eye className={"h-4 w-4" + (a.status !== "published" ? " text-muted-foreground" : "")} />
                                    </a>
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => openEdit(a)} data-testid={`button-edit-${a.id}`} title="Edit">
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => regenMutation.mutate(a)}
                                    disabled={regenMutation.isPending}
                                    data-testid={`button-regen-${a.id}`}
                                    title="Re-Generate (creates new pending draft)"
                                  >
                                    <RefreshCw className={"h-4 w-4 text-blue-500" + (regenMutation.isPending ? " animate-spin" : "")} />
                                  </Button>
                                  {a.status === "pending" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => publishMutation.mutate(a.id)}
                                      disabled={publishMutation.isPending}
                                      data-testid={`button-publish-${a.id}`}
                                      title="Publish"
                                    >
                                      <Send className="h-4 w-4 text-green-500" />
                                    </Button>
                                  )}
                                  {a.status === "published" && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => unpublishMutation.mutate(a.id)}
                                        disabled={unpublishMutation.isPending}
                                        data-testid={`button-unpublish-${a.id}`}
                                        title="Unpublish (back to pending)"
                                      >
                                        <EyeOff className="h-4 w-4 text-amber-500" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => archiveMutation.mutate(a.id)}
                                        disabled={archiveMutation.isPending}
                                        data-testid={`button-archive-${a.id}`}
                                        title="Archive"
                                      >
                                        <Archive className="h-4 w-4 text-orange-400" />
                                      </Button>
                                    </>
                                  )}
                                  {a.status === "archived" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => unarchiveMutation.mutate(a.id)}
                                      disabled={unarchiveMutation.isPending}
                                      data-testid={`button-unarchive-${a.id}`}
                                      title="Restore to draft"
                                    >
                                      <ArchiveRestore className="h-4 w-4 text-blue-400" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setVersionsArticle(a.id)}
                                    data-testid={`button-versions-${a.id}`}
                                    title="Version history"
                                  >
                                    <History className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { if (confirm("Delete this article?")) deleteMutation.mutate(a.id) }}
                                    data-testid={`button-delete-${a.id}`}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}

      {activeTab === "content-studio" && (
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Pick a source (Haylo Article or legacy Template), select cities, and submit. Haylo pairs run through the full 5-agent Newsroom pipeline; passes land in Articles, warnings go to Newsroom Review Queue.
            </p>
          </div>

          <SchedulerCard />


          <Card className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Source</Label>
                <div className="inline-flex rounded-md border bg-muted p-0.5 ml-3">
                  <button
                    type="button"
                    onClick={() => { setStudioSource("haylo"); setStudioResult(null) }}
                    className={`px-3 py-1.5 text-sm rounded-sm transition ${studioSource === "haylo" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                    data-testid="button-source-haylo"
                  >
                    Haylo Article
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStudioSource("template"); setStudioResult(null) }}
                    className={`px-3 py-1.5 text-sm rounded-sm transition ${studioSource === "template" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"}`}
                    data-testid="button-source-template"
                  >
                    Template (legacy)
                  </button>
                </div>
              </div>
              {studioSource === "haylo" && (
                <label className="flex items-center gap-2 text-sm cursor-pointer" data-testid="label-studio-dryrun">
                  <Checkbox checked={studioDryRun} onCheckedChange={(v) => setStudioDryRun(!!v)} data-testid="checkbox-studio-dryrun" />
                  Dry Run (mock auditor — no LLM credits)
                </label>
              )}
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {studioSource === "haylo" ? (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3" data-testid="text-studio-step1">Step 1: Select Haylo Article</h3>
                  {hayloListLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : hayloArticlesList && hayloArticlesList.length > 0 ? (
                    <>
                      <Select value={studioHayloId} onValueChange={(v) => { setStudioHayloId(v); setStudioResult(null) }}>
                        <SelectTrigger data-testid="select-studio-haylo">
                          <SelectValue placeholder="Choose a Haylo essay..." />
                        </SelectTrigger>
                        <SelectContent>
                          {hayloArticlesList.map((h: any) => (
                            <SelectItem key={h.id} value={h.id}>
                              {h.title.slice(0, 80)}{h.title.length > 80 ? "…" : ""} · {h.topicSlug} · placed {h.placementCount}×
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        Showing {hayloArticlesList.length} ready essays from the Haylo Library. Manage essays under <code>/admin/haylo</code>.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No ready Haylo essays. Add one in the <a href="/admin/haylo" className="underline">Haylo Library</a> first.
                    </p>
                  )}
                </Card>
              ) : (
                <Card className="p-4">
                  <h3 className="font-semibold mb-3" data-testid="text-studio-step1">Step 1: Select Template</h3>
                  {templatesLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : knowledgeTemplates && knowledgeTemplates.length > 0 ? (
                    <Select value={studioTemplateId} onValueChange={(v) => { setStudioTemplateId(v); setStudioResult(null) }}>
                      <SelectTrigger data-testid="select-studio-template">
                        <SelectValue placeholder="Choose a press release template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {knowledgeTemplates.filter(t => t.isActive).map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm text-muted-foreground">No templates found. Create one in the Templates tab first.</p>
                  )}
                </Card>
              )}

              <Card className="p-4">
                <h3 className="font-semibold mb-3" data-testid="text-studio-step2">Step 2: Select Cities</h3>
                <div className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <Select value={studioStateFilter} onValueChange={(v) => { setStudioStateFilter(v); setStudioSelectedCities([]) }}>
                      <SelectTrigger className="w-[200px]" data-testid="select-studio-state">
                        <SelectValue placeholder="Filter by state..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        {uniqueStates.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">
                      {studioSelectedCities.length} of {
                        (studioStateFilter && studioStateFilter !== "all"
                          ? cities?.filter(c => c.stateCode === studioStateFilter) || []
                          : cities || []
                        ).length
                      } selected
                    </span>
                  </div>
                  {(() => {
                    const filteredCities = studioStateFilter && studioStateFilter !== "all"
                      ? cities?.filter(c => c.stateCode === studioStateFilter) || []
                      : cities || []
                    const sortedCities = [...filteredCities].sort((a, b) => a.cityName.localeCompare(b.cityName))
                    return (
                      <>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStudioSelectedCities(sortedCities.map(c => c.slug))}
                            data-testid="button-studio-select-all"
                          >
                            Select All ({sortedCities.length})
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setStudioSelectedCities([])}
                            data-testid="button-studio-deselect-all"
                          >
                            Deselect All
                          </Button>
                        </div>
                        <div className="border rounded-lg p-2 max-h-64 overflow-y-auto grid grid-cols-2 gap-1">
                          {sortedCities.map(c => (
                            <label key={c.slug} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded" data-testid={`studio-city-${c.slug}`}>
                              <input
                                type="checkbox"
                                checked={studioSelectedCities.includes(c.slug)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setStudioSelectedCities(prev => [...prev, c.slug])
                                  } else {
                                    setStudioSelectedCities(prev => prev.filter(s => s !== c.slug))
                                  }
                                }}
                              />
                              {c.cityName}, {c.stateCode}
                            </label>
                          ))}
                        </div>
                      </>
                    )
                  })()}
                </div>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-3" data-testid="text-studio-step3">Step 3: Options & Submit</h3>
                <div className="space-y-3">
                  {studioSource === "template" && (
                    <>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={studioAutoPublish}
                            onCheckedChange={(v) => setStudioAutoPublish(!!v)}
                            data-testid="checkbox-studio-auto-publish"
                          />
                          Auto-publish (skip pending)
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={studioUpdateExisting}
                            onCheckedChange={(v) => setStudioUpdateExisting(!!v)}
                            data-testid="checkbox-studio-update-existing"
                          />
                          Update existing articles
                        </label>
                      </div>
                      <div>
                        <Label htmlFor="studio-campaign-name">Campaign Name (optional)</Label>
                        <Input
                          id="studio-campaign-name"
                          value={studioCampaignName}
                          onChange={(e) => setStudioCampaignName(e.target.value)}
                          placeholder="e.g. PR Hash-256 Wave 2"
                          data-testid="input-studio-campaign-name"
                        />
                        <p className="text-xs text-muted-foreground mt-1">Articles will be grouped under this campaign</p>
                      </div>
                      {!studioUpdateExisting && studioSelectedCities.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Cities that already have articles will be skipped. Enable "Update existing" to overwrite them.
                        </p>
                      )}
                    </>
                  )}
                  {studioSource === "haylo" && (
                    <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                      <div className="font-semibold text-foreground">How pairs route:</div>
                      <div>• <span className="font-medium text-green-600">PASS</span> → published as <code>pending</code> in Knowledge → Articles (publish from there)</div>
                      <div>• <span className="font-medium text-yellow-600">WARN</span> → Newsroom → Review Queue for human approval</div>
                      <div>• <span className="font-medium text-red-600">FAIL</span> → blocked; logged in generation log</div>
                      <div>Max {25} cities per submit. Larger batches: split into runs.</div>
                    </div>
                  )}
                  <Button
                    onClick={() => {
                      if (studioSource === "haylo") {
                        if (studioSelectedCities.length > 0 && studioHayloId) {
                          const msg = `Glue ${studioSelectedCities.length} press release${studioSelectedCities.length === 1 ? "" : "s"} from this Haylo article${studioDryRun ? " (DRY RUN — mock auditor)" : ""}?`
                          if (confirm(msg)) studioPairMutation.mutate()
                        }
                      } else {
                        if (studioSelectedCities.length > 0 && studioTemplateId) {
                          const msg = studioUpdateExisting
                            ? `Apply template to ${studioSelectedCities.length} cities? Existing articles will be updated.`
                            : `Apply template to ${studioSelectedCities.length} cities?`
                          if (confirm(msg)) studioApplyMutation.mutate()
                        }
                      }
                    }}
                    disabled={
                      studioSelectedCities.length === 0 ||
                      (studioSource === "haylo"
                        ? !studioHayloId || studioPairMutation.isPending || studioSelectedCities.length > 25
                        : !studioTemplateId || studioApplyMutation.isPending)
                    }
                    className="w-full"
                    data-testid="button-studio-apply"
                  >
                    {studioSource === "haylo" ? (
                      studioPairMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gluing {studioSelectedCities.length} pair{studioSelectedCities.length === 1 ? "" : "s"}...</>
                      ) : (
                        <><Send className="mr-2 h-4 w-4" /> Glue & Audit {studioSelectedCities.length} {studioSelectedCities.length === 1 ? "City" : "Cities"}{studioDryRun ? " (Dry Run)" : ""}</>
                      )
                    ) : studioApplyMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying to {studioSelectedCities.length} cities...</>
                    ) : (
                      <><Send className="mr-2 h-4 w-4" /> Apply Template to {studioSelectedCities.length} {studioSelectedCities.length === 1 ? "City" : "Cities"}</>
                    )}
                  </Button>
                </div>
              </Card>

              {studioResult && (
                <Card className="p-4 border-green-500/30 bg-green-500/5" data-testid="studio-result-card">
                  <div className="flex items-center gap-2 mb-3 font-semibold">
                    <CheckCircle className="h-5 w-5 text-green-500" /> Template Applied
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-center mb-4">
                    <div>
                      <div className="text-2xl font-bold text-green-500">{studioResult.generated || 0}</div>
                      <div className="text-xs text-muted-foreground">Created</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-blue-500">{studioResult.updated || 0}</div>
                      <div className="text-xs text-muted-foreground">Updated</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-yellow-500">{studioResult.skipped || 0}</div>
                      <div className="text-xs text-muted-foreground">Skipped</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-red-500">{studioResult.errors || 0}</div>
                      <div className="text-xs text-muted-foreground">Errors</div>
                    </div>
                  </div>
                  {studioResult.results && (
                    <div className="border rounded p-2 max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">City</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                            <TableHead className="text-xs">Slug</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {studioResult.results.map((r: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-sm py-1">{r.city}</TableCell>
                              <TableCell className="py-1">
                                <Badge variant="outline" className={
                                  r.status === "error" ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                  r.status === "skipped" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                  r.status === "updated" ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                  "bg-green-500/10 text-green-500 border-green-500/20"
                                }>
                                  {r.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground py-1 max-w-[200px] truncate">
                                {r.slug || r.error || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card className="p-4">
                <h3 className="font-semibold mb-3">Preview</h3>
                {studioTemplateId && cities && cities.length > 0 ? (
                  <div className="space-y-3">
                    <Select value={studioPreviewCity} onValueChange={setStudioPreviewCity}>
                      <SelectTrigger data-testid="select-studio-preview-city">
                        <SelectValue placeholder="Pick a city to preview..." />
                      </SelectTrigger>
                      <SelectContent>
                        {[...(cities || [])].sort((a, b) => a.cityName.localeCompare(b.cityName)).map(c => (
                          <SelectItem key={c.slug} value={c.slug}>{c.cityName}, {c.stateCode}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {studioPreviewCity && (() => {
                      const template = knowledgeTemplates?.find(t => t.id === studioTemplateId)
                      const city = cities?.find(c => c.slug === studioPreviewCity)
                      if (!template || !city) return null
                      const replacePlaceholders = (pattern: string) => pattern
                        .replace(/\{\{city\}\}/g, city.cityName)
                        .replace(/\{\{city_upper\}\}/g, city.cityName.toUpperCase())
                        .replace(/\{\{state_name\}\}/g, (city as any).stateName || "")
                        .replace(/\{\{state_code\}\}/g, city.stateCode || "")
                        .replace(/\{\{slug\}\}/g, city.slug)
                        .replace(/\{\{landmarks\}\}/g, ((city as any).localLandmarks || (city as any).landmarks || []).join(", ") || "local business districts")
                        .replace(/\{\{nearby_cities\}\}/g, ((city as any).nearbyCities || []).join(", ") || "surrounding communities")
                      const previewTitle = replacePlaceholders(template.titlePattern)
                      const previewHeadline = replacePlaceholders(template.headlinePattern)
                      return (
                        <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">SEO Title</span>
                            <p className="text-sm font-medium" data-testid="text-preview-title">{previewTitle}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Headline</span>
                            <p className="text-sm" data-testid="text-preview-headline">{previewHeadline}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Slug</span>
                            <p className="text-xs text-muted-foreground font-mono" data-testid="text-preview-slug">
                              tableicity-{city.cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}-cap-table
                            </p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Live URL</span>
                            <a
                              href={`/discovery/knowledge/tableicity-${city.cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}-cap-table`}
                              target="_blank"
                              rel="noopener"
                              className="text-xs text-blue-500 hover:underline block truncate"
                              data-testid="link-preview-url"
                            >
                              /discovery/knowledge/tableicity-{city.cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}-cap-table
                            </a>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a template above to preview how it will look for different cities.</p>
                )}
              </Card>

              <Card className="p-4 bg-muted/20">
                <h3 className="font-semibold mb-2 text-sm">How It Works</h3>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  <li className="flex gap-2"><span className="text-primary font-bold">1.</span> Choose a template with placeholders</li>
                  <li className="flex gap-2"><span className="text-primary font-bold">2.</span> Select cities (filter by state)</li>
                  <li className="flex gap-2"><span className="text-primary font-bold">3.</span> Preview how it looks for any city</li>
                  <li className="flex gap-2"><span className="text-primary font-bold">4.</span> Apply — creates/updates press releases</li>
                </ul>
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    Placeholders: <code className="bg-muted px-1 rounded">{"{{city}}"}</code> <code className="bg-muted px-1 rounded">{"{{state_name}}"}</code> <code className="bg-muted px-1 rounded">{"{{state_code}}"}</code> <code className="bg-muted px-1 rounded">{"{{landmarks}}"}</code> <code className="bg-muted px-1 rounded">{"{{nearby_cities}}"}</code>
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Press release templates with placeholders: <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{city}}"}</code> <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{state_name}}"}</code> <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{state_code}}"}</code> <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{landmarks}}"}</code> <code className="text-xs bg-muted px-1 py-0.5 rounded">{"{{nearby_cities}}"}</code>
            </p>
            <div className="flex gap-2">
              {knowledgeTemplates && knowledgeTemplates.length > 0 && (
                <Dialog open={generateFromTemplateOpen} onOpenChange={(o) => { setGenerateFromTemplateOpen(o); if (!o) setGenerateResult(null); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="default" data-testid="button-generate-from-template">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Generate for All Cities
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Generate Articles from Template</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div>
                        <Label>Template</Label>
                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                          <SelectTrigger data-testid="select-template-for-gen">
                            <SelectValue placeholder="Select template..." />
                          </SelectTrigger>
                          <SelectContent>
                            {knowledgeTemplates?.filter(t => t.isActive).map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={autoPublish}
                          onCheckedChange={(v) => setAutoPublish(!!v)}
                          data-testid="checkbox-auto-publish"
                        />
                        <Label>Auto-publish (skip pending/draft)</Label>
                      </div>
                      {generateResult && (
                        <Card className="p-3 bg-green-500/10 border-green-500/20">
                          <p className="text-sm font-medium text-green-500" data-testid="text-generate-result">
                            Generated {generateResult.generated} articles{generateResult.errors > 0 ? `, ${generateResult.errors} errors` : ""}
                          </p>
                        </Card>
                      )}
                      <Button
                        onClick={() => generateFromTemplateMutation.mutate()}
                        disabled={!selectedTemplateId || generateFromTemplateMutation.isPending}
                        className="w-full"
                        data-testid="button-confirm-generate"
                      >
                        {generateFromTemplateMutation.isPending ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
                        ) : (
                          "Generate for All Published Cities"
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <Dialog open={templateCreateOpen} onOpenChange={setTemplateCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-create-template">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    New Template
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Knowledge Template</DialogTitle>
                  </DialogHeader>
                  <TemplateForm
                    onSubmit={(data) => createTemplateMutation.mutate(data)}
                    isPending={createTemplateMutation.isPending}
                    cities={cities || []}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {templatesLoading ? (
            <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : knowledgeTemplates && knowledgeTemplates.length > 0 ? (
            <div className="space-y-3">
              {knowledgeTemplates.map(t => (
                <Card key={t.id} className="p-4" data-testid={`template-card-${t.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{t.name}</h3>
                        <Badge variant={t.isActive ? "default" : "secondary"}>
                          {t.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">Title: {t.titlePattern}</p>
                      <p className="text-sm text-muted-foreground">Headline: {t.headlinePattern}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Created {new Date(t.createdAt).toLocaleDateString()} · Updated {new Date(t.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditTemplate(t)} data-testid={`button-edit-template-${t.id}`} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this template?")) deleteTemplateMutation.mutate(t.id) }} data-testid={`button-delete-template-${t.id}`} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-templates">No templates yet. Create your first press release template.</p>
            </Card>
          )}

          <Dialog open={!!editTemplate} onOpenChange={(o) => { if (!o) setEditTemplate(null) }}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Template</DialogTitle>
              </DialogHeader>
              {editTemplate && (
                <TemplateForm
                  initial={editTemplate}
                  onSubmit={(data) => updateTemplateMutation.mutate({ id: editTemplate.id, data })}
                  isPending={updateTemplateMutation.isPending}
                  cities={cities || []}
                />
              )}
            </DialogContent>
          </Dialog>
        </div>
      )}

      {activeTab === "analytics" && (
        <div className="space-y-6">
          {analytics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="analytics-cards">
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground font-medium mb-1">Published This Month</div>
                  <p className="text-3xl font-bold" data-testid="analytics-published-month">{analytics.publishedThisMonth}</p>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground font-medium mb-1">Discover-Eligible</div>
                  <p className="text-3xl font-bold text-green-500" data-testid="analytics-discover-eligible">{analytics.discoverEligible}</p>
                  <p className="text-xs text-muted-foreground mt-1">Published + image ≥ 1200px</p>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground font-medium mb-1">Avg Freshness Score</div>
                  <p className="text-3xl font-bold" data-testid="analytics-freshness">{analytics.avgFreshnessScore}</p>
                  <p className="text-xs text-muted-foreground mt-1">3=Fresh, 2=Recent, 1=Aging</p>
                </Card>
                <Card className="p-4">
                  <div className="text-xs text-muted-foreground font-medium mb-1">Pending Review</div>
                  <p className="text-3xl font-bold text-yellow-500" data-testid="analytics-pending">{analytics.pendingCount}</p>
                </Card>
              </div>

              <Card className="p-4">
                <h3 className="font-medium mb-3">Google Search Console Performance</h3>
                <p className="text-sm text-muted-foreground mb-4">Connect Google Search Console to enable performance data.</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Article</TableHead>
                      <TableHead>Impressions</TableHead>
                      <TableHead>Clicks</TableHead>
                      <TableHead>Avg Position</TableHead>
                      <TableHead>Last Synced</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {articles?.filter(a => a.status === "published").slice(0, 10).map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm max-w-[200px] truncate">{a.headline.replace(/<[^>]*>/g, "")}</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          )}
        </div>
      )}

      {activeTab === "coverage" && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <Select value={coverageStateFilter} onValueChange={setCoverageStateFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-coverage-state">
                <SelectValue placeholder="All states" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {coverageStates.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={coverageStatusFilter} onValueChange={setCoverageStatusFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-coverage-status">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Not Generated">Not Generated</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Published">Published</SelectItem>
              </SelectContent>
            </Select>
            {(coverageStateFilter || coverageStatusFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setCoverageStateFilter(""); setCoverageStatusFilter("") }}>
                Clear
              </Button>
            )}
            <span className="text-sm text-muted-foreground ml-auto">
              {filteredCoverage.length} cities
            </span>
          </div>

          {coverage ? (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>City</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Published</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCoverage.map(c => (
                    <TableRow key={c.citySlug} data-testid={`coverage-row-${c.citySlug}`}>
                      <TableCell className="font-medium">{c.cityName}</TableCell>
                      <TableCell>{c.state}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            c.status === "Published" ? "bg-green-500/10 text-green-500 border-green-500/20" :
                            c.status === "Pending" ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                            "bg-gray-500/10 text-gray-400 border-gray-500/20"
                          }
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.lastPublished ? new Date(c.lastPublished).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!editArticle} onOpenChange={(o) => { if (!o) { setEditArticle(null); resetForm() } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Article: {editArticle?.slug}</DialogTitle>
          </DialogHeader>
          {articleForm(true)}
        </DialogContent>
      </Dialog>

      <Dialog open={!!versionsArticle} onOpenChange={(o) => { if (!o) setVersionsArticle(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
          </DialogHeader>
          {versions?.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>v{v.versionNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{v.snapshotReason}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{v.createdBy || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(v.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-versions">No versions yet</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TemplateForm({ initial, onSubmit, isPending, cities }: {
  initial?: KnowledgeTemplateItem
  onSubmit: (data: any) => void
  isPending: boolean
  cities: CityRecord[]
}) {
  const [name, setName] = useState(initial?.name || "")
  const [titlePattern, setTitlePattern] = useState(initial?.titlePattern || "")
  const [headlinePattern, setHeadlinePattern] = useState(initial?.headlinePattern || "")
  const [subheadlinePattern, setSubheadlinePattern] = useState(initial?.subheadlinePattern || "")
  const [metaDescriptionPattern, setMetaDescriptionPattern] = useState(initial?.metaDescriptionPattern || "")
  const [datelinePattern, setDatelinePattern] = useState(initial?.datelinePattern || "")
  const [bodyHtmlPattern, setBodyHtmlPattern] = useState(initial?.bodyHtmlPattern || "")
  const [boilerplateHtml, setBoilerplateHtml] = useState(initial?.boilerplateHtml || "")
  const [ogImageUrl, setOgImageUrl] = useState(initial?.ogImageUrl || "https://www.tableicity.com/beast-06-zk-network.png")
  const [allowIndexing, setAllowIndexing] = useState(initial?.allowIndexing ?? true)
  const [previewCity, setPreviewCity] = useState("")
  const [showPreview, setShowPreview] = useState(false)

  const replacePlaceholders = (pattern: string) => {
    const city = cities.find(c => c.slug === previewCity)
    if (!city || !pattern) return pattern
    return pattern
      .replace(/\{\{city\}\}/g, city.cityName)
      .replace(/\{\{city_upper\}\}/g, city.cityName.toUpperCase())
      .replace(/\{\{state_name\}\}/g, (city as any).stateName || "")
      .replace(/\{\{state_code\}\}/g, city.stateCode || "")
      .replace(/\{\{slug\}\}/g, city.slug)
      .replace(/\{\{landmarks\}\}/g, ((city as any).localLandmarks || (city as any).landmarks || []).join(", ") || "local business districts")
      .replace(/\{\{nearby_cities\}\}/g, ((city as any).nearbyCities || []).join(", ") || "surrounding communities")
  }

  return (
    <div className="space-y-4 pt-2">
      <div>
        <Label>Template Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Launch Narrative v1" data-testid="input-template-name" />
      </div>
      <div>
        <Label>Meta Title</Label>
        <Input value={titlePattern} onChange={(e) => setTitlePattern(e.target.value)} placeholder="e.g., Cap Table Readiness in {{city}}, {{state_code}} | Tableicity" data-testid="input-template-title" />
      </div>
      <div>
        <Label>Meta Description</Label>
        <Textarea value={metaDescriptionPattern} onChange={(e) => setMetaDescriptionPattern(e.target.value)} rows={2} data-testid="input-template-meta" />
      </div>
      <div>
        <Label>Headline Pattern (HTML supported)</Label>
        <Textarea value={headlinePattern} onChange={(e) => setHeadlinePattern(e.target.value)} placeholder="e.g., {{city}}, {{state_name}} Founders Embrace Privacy-First Cap Table Management" rows={2} className="font-mono text-xs" data-testid="input-template-headline" />
      </div>
      <div>
        <Label>Subheadline Pattern (HTML supported)</Label>
        <Textarea value={subheadlinePattern} onChange={(e) => setSubheadlinePattern(e.target.value)} rows={2} className="font-mono text-xs" data-testid="input-template-subheadline" />
      </div>
      <div>
        <Label>Dateline Pattern</Label>
        <Input value={datelinePattern} onChange={(e) => setDatelinePattern(e.target.value)} placeholder="e.g., {{city_upper}}, {{state_code}} —" data-testid="input-template-dateline" />
      </div>
      <div>
        <Label>Body HTML Pattern</Label>
        <Textarea value={bodyHtmlPattern} onChange={(e) => setBodyHtmlPattern(e.target.value)} rows={12} className="font-mono text-xs" data-testid="input-template-body" />
      </div>
      <div>
        <Label>Boilerplate HTML</Label>
        <Textarea value={boilerplateHtml} onChange={(e) => setBoilerplateHtml(e.target.value)} rows={4} className="font-mono text-xs" data-testid="input-template-boilerplate" />
      </div>
      <div>
        <Label>OG Image URL</Label>
        <Input value={ogImageUrl} onChange={(e) => setOgImageUrl(e.target.value)} data-testid="input-template-og-image" />
      </div>

      <div className="border rounded-lg p-4 bg-muted/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Live Preview</h3>
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} data-testid="button-toggle-preview">
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
        </div>
        {showPreview && (
          <div className="space-y-3">
            <Select value={previewCity} onValueChange={setPreviewCity}>
              <SelectTrigger data-testid="select-template-preview-city">
                <SelectValue placeholder="Pick a city to preview..." />
              </SelectTrigger>
              <SelectContent>
                {[...cities].sort((a, b) => a.cityName.localeCompare(b.cityName)).map(c => (
                  <SelectItem key={c.slug} value={c.slug}>{c.cityName}, {c.stateCode}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {previewCity && (
              <div className="rounded-lg overflow-hidden border border-white/10" data-testid="template-preview-panel">
                <div className="bg-[#0f172a] p-6 space-y-4">
                  {datelinePattern && (
                    <p className="text-xs uppercase tracking-wider text-blue-200/50">{replacePlaceholders(datelinePattern)}</p>
                  )}
                  <h1 className="text-2xl font-bold text-white leading-tight" dangerouslySetInnerHTML={{ __html: replacePlaceholders(headlinePattern).replace(/<\/?h[1-6][^>]*>/gi, "") }} />
                  {subheadlinePattern && (
                    <h2 className="text-sm font-normal text-blue-200/70" dangerouslySetInnerHTML={{ __html: replacePlaceholders(subheadlinePattern).replace(/<\/?h[1-6][^>]*>/gi, "") }} />
                  )}
                  <div className="text-xs text-blue-200/50 border-b border-white/10 pb-3">
                    By Tableicity &middot; {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                  <div
                    className="prose prose-sm prose-invert max-w-none
                      prose-headings:text-blue-200/70 prose-headings:font-medium
                      prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2
                      prose-h3:text-sm prose-h3:mt-3 prose-h3:mb-1
                      prose-p:text-blue-100/80 prose-p:text-xs
                      prose-strong:text-white prose-li:text-blue-100/80 prose-li:text-xs
                      prose-a:text-blue-400"
                    dangerouslySetInnerHTML={{ __html: replacePlaceholders(bodyHtmlPattern) }}
                  />
                  {boilerplateHtml && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-[10px] uppercase tracking-wider text-blue-200/40 mb-2">About Tableicity</p>
                      <div className="text-xs text-blue-200/50" dangerouslySetInnerHTML={{ __html: replacePlaceholders(boilerplateHtml) }} />
                    </div>
                  )}
                </div>
              </div>
            )}
            {!previewCity && (
              <p className="text-xs text-muted-foreground text-center py-2">Pick a city above to see how the template will look</p>
            )}
          </div>
        )}
      </div>

      <Button
        onClick={() => onSubmit({ name, titlePattern, headlinePattern, subheadlinePattern: subheadlinePattern || undefined, metaDescriptionPattern: metaDescriptionPattern || undefined, datelinePattern: datelinePattern || undefined, bodyHtmlPattern, boilerplateHtml: boilerplateHtml || undefined, ogImageUrl: ogImageUrl || undefined, allowIndexing })}
        disabled={isPending || !name || !titlePattern || !headlinePattern || !bodyHtmlPattern}
        className="w-full"
        data-testid="button-submit-template"
      >
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {initial ? "Update Template" : "Create Template"}
      </Button>
    </div>
  )
}


interface FlipItemArticle { id: string; slug: string; title: string }
interface FlipItemCity { id: string; slug: string; label: string }
interface PreviewResp {
  parsed: {
    articleSafeList: string[]
    citySafeList: string[]
    homeCount: number
    unknownEntries: string[]
  }
  articles: {
    total: number
    willFlipToNoindex: number
    willKeepIndexed: number
    alreadyNoindex: number
    safeListMissing: string[]
    willFlip: FlipItemArticle[]
    willKeep: FlipItemArticle[]
  }
  cities: {
    total: number
    willFlipToNoindex: number
    willKeepIndexed: number
    alreadyNoindex: number
    safeListMissing: string[]
    willFlip: FlipItemCity[]
    willKeep: FlipItemCity[]
  }
}

function SeoVisibilitySection() {
  const { toast } = useToast()
  const [safeListText, setSafeListText] = useState("")
  const [preview, setPreview] = useState<PreviewResp | null>(null)
  const [restoreText, setRestoreText] = useState("")
  const [showAllArticleFlips, setShowAllArticleFlips] = useState(false)
  const [showAllCityFlips, setShowAllCityFlips] = useState(false)

  const indexedUrls = useMemo(
    () =>
      safeListText
        .split(/[\r\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [safeListText]
  )

  const loadProtectedMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/admin/knowledge/seo-visibility/protected-list")
      return await res.json() as { urls: string[]; count: number }
    },
    onSuccess: (data) => {
      setSafeListText(data.urls.join("\n"))
      toast({ title: "Loaded protected list", description: `${data.count} URLs from John/PR DO NOT TOUCH/.` })
    },
    onError: (e: any) => toast({ title: "Load failed", description: e.message, variant: "destructive" }),
  })

  const previewMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/knowledge/seo-visibility/preview", {
        indexedUrls,
      })
      return (await res.json()) as PreviewResp
    },
    onSuccess: (data) => setPreview(data),
    onError: (e: any) => toast({ title: "Preview failed", description: e.message, variant: "destructive" }),
  })

  const applyMut = useMutation({
    mutationFn: async (allowMissing: boolean) => {
      const res = await apiRequest("POST", "/api/admin/knowledge/seo-visibility/apply", {
        indexedUrls,
        confirm: true,
        allowMissing,
      })
      return await res.json()
    },
    onSuccess: (data) => {
      if (data.aborted) {
        const a = data.articleSafeListMissing?.length || 0
        const c = data.citySafeListMissing?.length || 0
        toast({
          title: "Aborted: safe-list entries not found",
          description: `${a} article slug(s) and ${c} city slug(s) on your safe-list were not found. Re-confirm to proceed anyway.`,
          variant: "destructive",
        })
        return
      }
      toast({
        title: "Bulk noindex applied",
        description: `Flipped ${data.articlesFlipped} articles and ${data.citiesFlipped} cities.`,
      })
      setPreview(null)
      previewMut.mutate()
    },
    onError: (e: any) => toast({ title: "Apply failed", description: e.message, variant: "destructive" }),
  })

  const restoreMut = useMutation({
    mutationFn: async () => {
      const urls = restoreText.split(/[\r\n,]+/).map((s) => s.trim()).filter(Boolean)
      if (!urls.length) throw new Error("Enter at least one slug or URL")
      const res = await apiRequest("PATCH", "/api/admin/knowledge/seo-visibility/apply", { urls })
      return await res.json()
    },
    onSuccess: (data) => {
      toast({
        title: "Restored",
        description: `Restored ${data.articlesRestored} article(s) and ${data.citiesRestored} city/cities to indexable.`,
      })
      setRestoreText("")
    },
    onError: (e: any) => toast({ title: "Restore failed", description: e.message, variant: "destructive" }),
  })

  const totalMissing =
    (preview?.articles.safeListMissing.length || 0) + (preview?.cities.safeListMissing.length || 0)
  const totalFlip =
    (preview?.articles.willFlipToNoindex || 0) + (preview?.cities.willFlipToNoindex || 0)

  return (
    <div className="space-y-6">
      <Card className="p-6 border-amber-300 bg-amber-50/40">
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="text-lg font-semibold">Bulk SEO Visibility Control (Cities + PRs)</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Paste a mixed list of URLs or slugs Google has confirmed indexed. Everything else (published cities + published PRs)
              will be parked: cities → <code className="bg-white px-1.5 py-0.5 rounded text-xs">allowIndexing=false</code>, PRs →{" "}
              <code className="bg-white px-1.5 py-0.5 rounded text-xs">noindex, follow</code>. PR changes are snapshotted into version history. Reversible per item.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="safe-list">Indexed URL safe-list (one per line; supports full URLs or bare slugs)</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadProtectedMut.mutate()}
            disabled={loadProtectedMut.isPending}
            data-testid="button-load-protected"
          >
            {loadProtectedMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5 mr-1.5" />}
            Load 41 protected URLs
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          These URLs will <strong>stay indexed</strong>. URL prefix decides routing:{" "}
          <code className="text-xs">/locations/&lt;slug&gt;</code> targets a city,{" "}
          <code className="text-xs">/discovery/knowledge/&lt;slug&gt;</code> targets a press release. The bare homepage{" "}
          <code className="text-xs">/</code> is ignored (always indexed).
        </p>
        <Textarea
          id="safe-list"
          rows={10}
          placeholder={"https://www.tableicity.com/locations/austin-tx\nhttps://www.tableicity.com/discovery/knowledge/tableicity-boston-cap-table"}
          value={safeListText}
          onChange={(e) => setSafeListText(e.target.value)}
          data-testid="textarea-safe-list"
          className="font-mono text-xs"
        />
        <div className="text-xs text-muted-foreground mt-1">{indexedUrls.length} entry/entries parsed.</div>

        <div className="flex gap-2 mt-4">
          <Button onClick={() => previewMut.mutate()} disabled={previewMut.isPending} data-testid="button-preview-seo-flip">
            {previewMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}
            Dry-run preview
          </Button>
          {preview && totalFlip > 0 && (
            <Button
              variant="destructive"
              onClick={() => {
                const allowMissing = totalMissing > 0
                const baseMsg = `Flip ${preview.articles.willFlipToNoindex} PR(s) to noindex AND ${preview.cities.willFlipToNoindex} city/cities to allowIndexing=false?\n\nKeeping ${preview.articles.willKeepIndexed} PR(s) and ${preview.cities.willKeepIndexed} city/cities indexed.\n\nReversible per item.`
                const warn = allowMissing
                  ? `\n\nWARNING: ${totalMissing} safe-list entry/entries were not found among published items — they will be ignored. Continue anyway?`
                  : ""
                if (confirm(baseMsg + warn)) applyMut.mutate(allowMissing)
              }}
              disabled={applyMut.isPending}
              data-testid="button-apply-seo-flip"
            >
              {applyMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldOff className="h-4 w-4 mr-2" />}
              Apply: park {totalFlip} item(s)
            </Button>
          )}
        </div>
      </Card>

      {preview && (
        <>
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Press Releases ({preview.articles.total} published)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
              <div className="rounded border p-3 bg-red-50"><div className="text-xs text-muted-foreground">Will flip → noindex</div><div className="text-2xl font-semibold text-red-700" data-testid="stat-art-flip">{preview.articles.willFlipToNoindex}</div></div>
              <div className="rounded border p-3 bg-emerald-50"><div className="text-xs text-muted-foreground">Will keep indexed</div><div className="text-2xl font-semibold text-emerald-700" data-testid="stat-art-keep">{preview.articles.willKeepIndexed}</div></div>
              <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Already noindex</div><div className="text-2xl font-semibold" data-testid="stat-art-already">{preview.articles.alreadyNoindex}</div></div>
              <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Safe-list missing</div><div className="text-2xl font-semibold text-amber-700" data-testid="stat-art-missing">{preview.articles.safeListMissing.length}</div></div>
            </div>
            {preview.articles.safeListMissing.length > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 mb-4 text-xs">
                <strong>Article slugs not found:</strong>{" "}
                <code>{preview.articles.safeListMissing.join(", ")}</code>
              </div>
            )}
            {preview.articles.willKeep.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm mb-2 text-emerald-700">Will stay indexed ({preview.articles.willKeep.length})</h4>
                <ul className="text-xs space-y-1 max-h-40 overflow-auto border rounded p-2">
                  {preview.articles.willKeep.map((a) => (
                    <li key={a.id} data-testid={`art-keep-${a.slug}`}><code>{a.slug}</code> — {a.title}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.articles.willFlip.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 text-red-700">Will flip to noindex ({preview.articles.willFlip.length})</h4>
                <ul className="text-xs space-y-1 max-h-60 overflow-auto border rounded p-2">
                  {(showAllArticleFlips ? preview.articles.willFlip : preview.articles.willFlip.slice(0, 25)).map((a) => (
                    <li key={a.id} data-testid={`art-flip-${a.slug}`}><code>{a.slug}</code> — {a.title}</li>
                  ))}
                </ul>
                {preview.articles.willFlip.length > 25 && (
                  <Button variant="link" size="sm" onClick={() => setShowAllArticleFlips((v) => !v)}>
                    {showAllArticleFlips ? "Show less" : `Show all ${preview.articles.willFlip.length}`}
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-3">City Pages ({preview.cities.total} published)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
              <div className="rounded border p-3 bg-red-50"><div className="text-xs text-muted-foreground">Will park (allowIndexing=false)</div><div className="text-2xl font-semibold text-red-700" data-testid="stat-city-flip">{preview.cities.willFlipToNoindex}</div></div>
              <div className="rounded border p-3 bg-emerald-50"><div className="text-xs text-muted-foreground">Will keep indexed</div><div className="text-2xl font-semibold text-emerald-700" data-testid="stat-city-keep">{preview.cities.willKeepIndexed}</div></div>
              <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Already parked</div><div className="text-2xl font-semibold" data-testid="stat-city-already">{preview.cities.alreadyNoindex}</div></div>
              <div className="rounded border p-3"><div className="text-xs text-muted-foreground">Safe-list missing</div><div className="text-2xl font-semibold text-amber-700" data-testid="stat-city-missing">{preview.cities.safeListMissing.length}</div></div>
            </div>
            {preview.cities.safeListMissing.length > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 mb-4 text-xs">
                <strong>City slugs not found:</strong>{" "}
                <code>{preview.cities.safeListMissing.join(", ")}</code>
              </div>
            )}
            {preview.cities.willKeep.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-sm mb-2 text-emerald-700">Will stay indexed ({preview.cities.willKeep.length})</h4>
                <ul className="text-xs space-y-1 max-h-40 overflow-auto border rounded p-2">
                  {preview.cities.willKeep.map((c) => (
                    <li key={c.id} data-testid={`city-keep-${c.slug}`}><code>{c.slug}</code> — {c.label}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.cities.willFlip.length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-2 text-red-700">Will park ({preview.cities.willFlip.length})</h4>
                <ul className="text-xs space-y-1 max-h-60 overflow-auto border rounded p-2">
                  {(showAllCityFlips ? preview.cities.willFlip : preview.cities.willFlip.slice(0, 25)).map((c) => (
                    <li key={c.id} data-testid={`city-flip-${c.slug}`}><code>{c.slug}</code> — {c.label}</li>
                  ))}
                </ul>
                {preview.cities.willFlip.length > 25 && (
                  <Button variant="link" size="sm" onClick={() => setShowAllCityFlips((v) => !v)}>
                    {showAllCityFlips ? "Show less" : `Show all ${preview.cities.willFlip.length}`}
                  </Button>
                )}
              </div>
            )}
          </Card>

          {preview.parsed.unknownEntries.length > 0 && (
            <Card className="p-4 border-amber-300 bg-amber-50/40">
              <div className="text-sm">
                <strong>Unrecognized entries (ignored):</strong>{" "}
                <code className="text-xs">{preview.parsed.unknownEntries.join(", ")}</code>
              </div>
            </Card>
          )}
        </>
      )}

      <Card className="p-6">
        <h3 className="font-semibold mb-2">Per-item restore</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Paste URLs or bare slugs to restore back to indexable (one per line or comma-separated). Cities and PRs both supported.
        </p>
        <Textarea
          rows={3}
          value={restoreText}
          onChange={(e) => setRestoreText(e.target.value)}
          placeholder="https://www.tableicity.com/locations/austin-tx"
          className="font-mono text-xs"
          data-testid="textarea-restore-slugs"
        />
        <Button
          className="mt-3"
          variant="outline"
          onClick={() => restoreMut.mutate()}
          disabled={restoreMut.isPending}
          data-testid="button-restore-slugs"
        >
          {restoreMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArchiveRestore className="h-4 w-4 mr-2" />}
          Restore to indexable
        </Button>
      </Card>
    </div>
  )
}

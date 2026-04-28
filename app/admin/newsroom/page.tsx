"use client"
import { useState, useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Bot, PlayCircle, FileSearch, Users, PenLine, ShieldCheck, Link2, Activity, AlertTriangle, RotateCcw, Settings, DollarSign, Trash2, Sparkles, Zap, Eye } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

interface Agent {
  id: string
  role: string
  displayName: string
  description: string
  provider: string | null
  modelEndpoint: string | null
  isActive: boolean
}

interface Job {
  id: string
  citySlug: string
  status: string
  currentStage: string | null
  agentsCompleted: string[]
  dryRun: boolean
  errorMessage: string | null
  claimedBy: string | null
  claimedAt: string | null
  heartbeatAt: string | null
  createdAt: string
  updatedAt: string
}

interface CostRollup {
  totals: {
    total_tokens: string | number
    total_cost_usd: string
    total_runs: number
    dry_runs: number
    runs_24h: number
    cost_24h: string
    cost_7d: string
  }
  byJob: Array<{ job_id: string; runs: number; tokens: string | number; cost_usd: string }>
  byAgent: Array<{ agent_id: string; runs: number; tokens: string | number; cost_usd: string }>
}

const STALE_LEASE_MS = 5 * 60 * 1000
function isStale(job: Job): boolean {
  if (job.status !== "running" || !job.heartbeatAt) return false
  return Date.now() - new Date(job.heartbeatAt).getTime() > STALE_LEASE_MS
}

interface Run {
  id: string
  agentId: string
  jobId: string | null
  citySlug: string | null
  status: string
  dryRun: boolean
  errorMessage: string | null
  tokensUsed: number | null
  costUsd: string | null
  createdAt: string
}

interface ReviewItem {
  id: string
  citySlug: string
  qcScore: number | null
  status: string
  draftPayload: any
  createdAt: string
}

interface Knowledge {
  id: string
  agentId: string
  citySlug: string | null
  key: string
  value: any
  sourceUrl: string | null
  fetchedAt: string
}

const ROLE_ICONS: Record<string, any> = {
  researcher: FileSearch,
  data_analyst: Users,
  copywriter: PenLine,
  seo_qc: ShieldCheck,
  internal_linker: Link2,
}

function statusColor(status: string) {
  switch (status) {
    case "queued": return "bg-blue-100 text-blue-800"
    case "running": return "bg-yellow-100 text-yellow-800"
    case "completed": return "bg-green-100 text-green-800"
    case "failed": return "bg-red-100 text-red-800"
    case "pending": return "bg-blue-100 text-blue-800"
    case "approved": return "bg-green-100 text-green-800"
    case "rejected": return "bg-gray-100 text-gray-800"
    default: return "bg-gray-100 text-gray-800"
  }
}

interface InternalLink {
  id: string
  targetSlug: string
  anchorText: string
  position: number | null
  accepted: boolean
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

function buildPreviewHtml(draft: any): string {
  const title = escapeHtml(String(draft.title ?? ""))
  const headline = escapeHtml(String(draft.headline ?? ""))
  const subheadline = draft.subheadline ? `<p style="color:#475569;font-size:18px;margin:4px 0 16px 0;">${escapeHtml(String(draft.subheadline))}</p>` : ""
  const dateline = draft.dateline ? `<p style="color:#64748b;font-size:13px;margin:0 0 12px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(String(draft.dateline))}</p>` : ""
  const meta = draft.metaDescription ? `<p style="color:#64748b;font-size:13px;font-style:italic;margin:0 0 24px 0;border-left:3px solid #cbd5e1;padding-left:12px;">${escapeHtml(String(draft.metaDescription))}</p>` : ""
  const body = String(draft.bodyHtml ?? "")
  const boilerplate = draft.boilerplateHtml ? `<hr style="margin:32px 0 16px 0;border:none;border-top:1px solid #e2e8f0;" /><div style="color:#64748b;font-size:14px;">${String(draft.boilerplateHtml)}</div>` : ""
  const author = draft.authorName ? `<p style="color:#64748b;font-size:13px;margin:24px 0 0 0;">— ${escapeHtml(String(draft.authorName))}${draft.publisherName ? `, ${escapeHtml(String(draft.publisherName))}` : ""}</p>` : ""

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>
  html,body{margin:0;padding:0;background:#fff;color:#0f172a;}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;padding:32px 40px;max-width:760px;margin:0 auto;}
  h1{font-size:30px;line-height:1.25;margin:0 0 8px 0;font-weight:800;letter-spacing:-0.01em;}
  h2{font-size:22px;line-height:1.3;margin:24px 0 8px 0;font-weight:700;}
  h3{font-size:18px;line-height:1.35;margin:20px 0 6px 0;font-weight:600;}
  p{margin:0 0 14px 0;}
  a{color:#2563eb;text-decoration:underline;}
  strong,b{font-weight:600;}
  ul,ol{margin:0 0 14px 0;padding-left:24px;}
  li{margin-bottom:4px;}
  blockquote{margin:0 0 14px 0;padding:8px 16px;border-left:4px solid #cbd5e1;color:#475569;font-style:italic;}
  img{max-width:100%;height:auto;}
</style></head>
<body>
  <h1>${title}</h1>
  ${subheadline}
  ${dateline}
  ${meta}
  ${headline && headline !== title ? `<h2>${headline}</h2>` : ""}
  ${body}
  ${boilerplate}
  ${author}
</body></html>`
}

function ReviewCard({ item, onAction, pending }: { item: ReviewItem; onAction: (status: "approved" | "rejected") => void; pending: boolean }) {
  const draft = (item.draftPayload || {}) as any
  const isV1 = draft?.version === "v1"
  const [previewOpen, setPreviewOpen] = useState(false)
  const { data: links } = useQuery<InternalLink[]>({
    queryKey: ["/api/admin/newsroom/internal-links", { reviewQueueId: item.id }],
    queryFn: async () => {
      const url = new URL("/api/admin/newsroom/internal-links", window.location.origin)
      url.searchParams.set("reviewQueueId", item.id)
      const res = await fetch(url.toString(), { credentials: "include" })
      return res.json()
    },
  })

  const previewHtml = isV1 ? buildPreviewHtml(draft) : ""

  return (
    <Card className="p-4" data-testid={`card-review-${item.id}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{item.citySlug}</span>
          {item.qcScore != null && <Badge variant="outline">QC {item.qcScore}/100</Badge>}
          {isV1 ? <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">v1 schema ✓</Badge> : <Badge variant="destructive">non-v1 — cannot publish</Badge>}
        </div>
        <div className="flex gap-2">
          {isV1 && (
            <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)} data-testid={`button-preview-${item.id}`}>
              <Eye className="h-4 w-4 mr-1" /> Preview
            </Button>
          )}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onAction("rejected")} data-testid={`button-reject-${item.id}`}>Reject</Button>
          <Button size="sm" disabled={pending} onClick={() => onAction("approved")} data-testid={`button-approve-${item.id}`}>Approve & Publish</Button>
        </div>
      </div>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle data-testid={`text-preview-title-${item.id}`}>Preview: {draft.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden border rounded">
            <iframe
              sandbox=""
              srcDoc={previewHtml}
              className="w-full h-[70vh] bg-white"
              title="Press release preview"
              data-testid={`iframe-preview-${item.id}`}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)} data-testid={`button-preview-close-${item.id}`}>Close</Button>
            <Button variant="outline" disabled={pending} onClick={() => { setPreviewOpen(false); onAction("rejected") }} data-testid={`button-preview-reject-${item.id}`}>Reject</Button>
            <Button disabled={pending} onClick={() => { setPreviewOpen(false); onAction("approved") }} data-testid={`button-preview-approve-${item.id}`}>Approve &amp; Publish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isV1 && (
        <div className="mb-2 space-y-1 text-sm">
          <div><span className="text-muted-foreground">Title:</span> <span className="font-medium" data-testid={`text-draft-title-${item.id}`}>{draft.title}</span></div>
          <div><span className="text-muted-foreground">Slug:</span> <code className="text-xs">{draft.suggestedSlug}</code></div>
          {draft.headline && <div><span className="text-muted-foreground">H1:</span> {draft.headline}</div>}
        </div>
      )}
      {links && links.length > 0 && (
        <div className="mb-2">
          <div className="text-xs font-medium text-muted-foreground mb-1">Suggested internal links ({links.length})</div>
          <ul className="text-xs space-y-0.5">
            {links.map((l) => (
              <li key={l.id} className="flex gap-2"><code>/{l.targetSlug}</code> <span className="text-muted-foreground">→</span> <span>{l.anchorText}</span></li>
            ))}
          </ul>
        </div>
      )}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Raw draft payload</summary>
        <pre className="mt-2 overflow-auto rounded bg-muted p-2">{JSON.stringify(item.draftPayload, null, 2)}</pre>
      </details>
    </Card>
  )
}

export default function NewsroomPage() {
  const [citySlug, setCitySlug] = useState("")
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [jobFilter, setJobFilter] = useState<"all" | "live" | "dry">("all")

  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/admin/newsroom/agents"],
  })

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/admin/newsroom/jobs"],
    refetchInterval: 5000,
  })

  const { data: cost } = useQuery<CostRollup>({
    queryKey: ["/api/admin/newsroom/cost-rollup"],
    refetchInterval: 10000,
  })

  const { data: sweepStatus } = useQuery<{ counts: { pipelineJobs: number; agentRuns: number; reviewQueue: number } }>({
    queryKey: ["/api/admin/newsroom/sweep-dryrun"],
    refetchInterval: 15000,
  })

  const releaseMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest("POST", `/api/admin/newsroom/jobs/${jobId}/release`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/jobs"] })
      toast({ title: "Lease released", description: "Job returned to queued — next worker can claim it." })
    },
  })

  const { data: runs } = useQuery<Run[]>({
    queryKey: ["/api/admin/newsroom/runs"],
    refetchInterval: 5000,
  })

  const { data: review } = useQuery<ReviewItem[]>({
    queryKey: ["/api/admin/newsroom/review"],
    refetchInterval: 8000,
  })

  const { data: knowledge } = useQuery<Knowledge[]>({
    queryKey: selectedAgentId
      ? ["/api/admin/newsroom/knowledge", { agentId: selectedAgentId }]
      : ["/api/admin/newsroom/knowledge"],
    queryFn: async ({ queryKey }) => {
      const params = (queryKey[1] as any) || {}
      const url = new URL("/api/admin/newsroom/knowledge", window.location.origin)
      if (params.agentId) url.searchParams.set("agentId", params.agentId)
      const res = await fetch(url.toString(), { credentials: "include" })
      return res.json()
    },
  })

  const enqueueMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/newsroom/jobs", {
        citySlug,
        dryRun: false,
        payload: {},
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/jobs"] })
      setCitySlug("")
    },
  })

  const liveMutation = useMutation({
    mutationFn: async (args: { citySlug: string; dryRun: boolean }) => {
      const res = await apiRequest("POST", "/api/admin/newsroom/run-live", args)
      return res.json() as Promise<{
        ok: boolean
        mode: string
        modelLabel: string
        jobId: string
        reviewQueueId: string
        stagesCompleted: string[]
        draftSummary: { title: string; suggestedSlug: string; bodyChars: number; internalLinks: number; qcScore: number }
        totalTokens: number
        totalCostUsd: number
        durationMs: number
      }>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/jobs"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/runs"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/review"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/cost-rollup"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/sweep-dryrun"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/knowledge"] })
      toast({
        title: `Live pipeline complete (${data.modelLabel})`,
        description: `${data.stagesCompleted.length} stages, ${(data.durationMs / 1000).toFixed(1)}s · QC ${data.draftSummary.qcScore}/100 · ${data.totalTokens.toLocaleString()} tokens · $${data.totalCostUsd.toFixed(4)}. Open Review Queue to inspect the draft.`,
      })
    },
    onError: (err: Error) => {
      const raw = err?.message || "Live run failed"
      let msg = raw
      const m = raw.match(/^\d+:\s*(.+)$/s)
      if (m) {
        try { const body = JSON.parse(m[1]); if (body?.error) msg = body.error } catch { msg = m[1] }
      }
      toast({ title: "Live pipeline failed", description: msg, variant: "destructive" })
    },
  })

  const fixtureMutation = useMutation({
    mutationFn: async () => {
      const slug = citySlug || "worcester-ma"
      const res = await apiRequest("POST", "/api/admin/newsroom/run-fixture", { citySlug: slug })
      return res.json() as Promise<{
        ok: boolean
        jobId: string
        reviewQueueId: string
        stagesCompleted: string[]
        draftSummary: { title: string; suggestedSlug: string; bodyChars: number; internalLinks: number; qcScore: number }
        totalTokens: number
        totalCostUsd: number
        durationMs: number
      }>
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/jobs"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/runs"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/review"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/cost-rollup"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/sweep-dryrun"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/knowledge"] })
      toast({
        title: "Gate 1 fixture complete",
        description: `${data.stagesCompleted.length} stages, ${data.durationMs}ms · QC ${data.draftSummary.qcScore}/100 · ${data.draftSummary.bodyChars} chars · ${data.draftSummary.internalLinks} links. Open the Review Queue tab to inspect the draft.`,
      })
    },
    onError: (err: Error) => {
      const raw = err?.message || "Fixture run failed"
      let msg = raw
      const m = raw.match(/^\d+:\s*(.+)$/s)
      if (m) {
        try { const body = JSON.parse(m[1]); if (body?.error) msg = body.error } catch { msg = m[1] }
      }
      toast({ title: "Fixture run failed", description: msg, variant: "destructive" })
    },
  })

  const { toast } = useToast()
  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const res = await apiRequest("PATCH", `/api/admin/newsroom/review/${id}`, { status })
      return res.json() as Promise<{ review: ReviewItem; publishedArticle: { id: string; slug: string; status: string; robots: string } | null }>
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/review"] })
      if (vars.status === "approved" && data.publishedArticle) {
        toast({
          title: "Published as pending knowledge article",
          description: `Slug: ${data.publishedArticle.slug} — robots: noindex (safe-default). Flip to live from the Knowledge tab.`,
        })
      } else if (vars.status === "rejected") {
        toast({ title: "Draft rejected", description: "No article was created." })
      }
    },
    onError: (err: Error) => {
      const raw = err?.message || "Failed to update review"
      let msg = raw
      const m = raw.match(/^\d+:\s*(.+)$/s)
      if (m) {
        try { const body = JSON.parse(m[1]); if (body?.error) msg = body.error } catch { msg = m[1] }
      }
      toast({ title: "Review action failed", description: msg, variant: "destructive" })
    },
  })

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Bot className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-newsroom-title">Newsroom</h1>
          <p className="text-sm text-muted-foreground">
            5-agent AI pipeline that turns city pages from door hangers into rank-worthy local content.
          </p>
        </div>
      </div>

      {sweepStatus && sweepStatus.counts.pipelineJobs + sweepStatus.counts.agentRuns + sweepStatus.counts.reviewQueue > 0 && (
        <Card className="mb-6 p-4 border-amber-500/50 bg-amber-500/5" data-testid="card-gate4-block">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-amber-700 dark:text-amber-400">Audit trail dirty — Gate 4 closure blocked.</p>
              <p className="mt-1 text-muted-foreground">
                {sweepStatus.counts.pipelineJobs} dry-run job(s), {sweepStatus.counts.agentRuns} agent run(s), and {sweepStatus.counts.reviewQueue} review queue row(s) present.
                Per Architect ratification (Gate Table v1.0): the Architect MUST click <strong>Purge dry-run</strong> below — with the Conductor as witness — before Gate 4 can close.
                If you are reviewing live (non-dry-run) work and dry-run rows are also present, sweep first.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">City slug</label>
            <Input
              placeholder="e.g. worcester-ma"
              value={citySlug}
              onChange={(e) => setCitySlug(e.target.value)}
              data-testid="input-city-slug"
            />
          </div>
          <Button
            disabled={!citySlug || enqueueMutation.isPending}
            onClick={() => enqueueMutation.mutate()}
            data-testid="button-enqueue-job"
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Enqueue pipeline
          </Button>
          <Button
            variant="default"
            disabled={!citySlug || liveMutation.isPending}
            onClick={() => {
              const slug = citySlug
              if (!slug) return
              if (!confirm(`Run live OpenAI pipeline for "${slug}"?\n\nModel: gpt-4.1-nano · 5 stages · ~15–35 seconds · ~$0.0024 per run.`)) return
              liveMutation.mutate({ citySlug: slug, dryRun: false })
            }}
            data-testid="button-run-live"
            title="Run all 5 stages with real OpenAI (gpt-4.1-nano). ~$0.0024 per run."
          >
            <Zap className="mr-2 h-4 w-4" />
            {liveMutation.isPending ? "Running live…" : "Run Live (OpenAI)"}
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              const r = await fetch("/api/admin/newsroom/sweep-dryrun")
              const p = await r.json()
              const total = p.counts.pipelineJobs + p.counts.agentRuns + p.counts.reviewQueue
              if (total === 0) {
                toast({ title: "Nothing to purge", description: "No dry-run rows in the system." })
                return
              }
              if (!confirm(`Purge ${p.counts.pipelineJobs} jobs + ${p.counts.agentRuns} agent runs + ${p.counts.reviewQueue} review queue rows. Real (live) jobs will not be touched. Continue?`)) return
              const res = await apiRequest("POST", "/api/admin/newsroom/sweep-dryrun", {})
              const data = await res.json()
              toast({ title: "Sweep complete", description: `Deleted ${data.deleted.pipelineJobs} jobs, ${data.deleted.agentRuns} runs, ${data.deleted.reviewQueue} review rows.` })
              queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/jobs"] })
              queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/runs"] })
              queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/review"] })
              queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/cost-rollup"] })
            }}
            data-testid="button-sweep-dryrun"
            title="Permanently delete every dry_run=true job, agent run, and review queue row. Live data is untouched."
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Purge dry-run
          </Button>
        </div>
      </Card>

      {cost && (
        <Card className="mb-6 p-4" data-testid="card-cost-rollup">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            Cost rollup
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div><div className="text-xs text-muted-foreground">Runs (all)</div><div className="text-lg font-semibold" data-testid="text-cost-total-runs">{cost.totals.total_runs} <span className="text-xs font-normal text-muted-foreground">({cost.totals.dry_runs} dry)</span></div></div>
            <div><div className="text-xs text-muted-foreground">Tokens (all)</div><div className="text-lg font-semibold">{Number(cost.totals.total_tokens).toLocaleString()}</div></div>
            <div><div className="text-xs text-muted-foreground">Cost (all)</div><div className="text-lg font-semibold" data-testid="text-cost-total">${Number(cost.totals.total_cost_usd).toFixed(4)}</div></div>
            <div><div className="text-xs text-muted-foreground">Cost 24h</div><div className="text-lg font-semibold" data-testid="text-cost-24h">${Number(cost.totals.cost_24h).toFixed(4)}</div></div>
            <div><div className="text-xs text-muted-foreground">Cost 7d</div><div className="text-lg font-semibold" data-testid="text-cost-7d">${Number(cost.totals.cost_7d).toFixed(4)}</div></div>
          </div>
        </Card>
      )}

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents" data-testid="tab-agents">Agents</TabsTrigger>
          <TabsTrigger value="pipeline" data-testid="tab-pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="review" data-testid="tab-review">
            Review Queue {review && review.length > 0 && <Badge className="ml-2">{review.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="knowledge" data-testid="tab-knowledge">Knowledge</TabsTrigger>
          <TabsTrigger value="runs" data-testid="tab-runs">Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-4">
          {agentsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {agents?.map((a) => {
                const Icon = ROLE_ICONS[a.role] || Bot
                const lastRun = runs?.find((r) => r.agentId === a.id)
                return (
                  <Card key={a.id} className="p-5" data-testid={`card-agent-${a.role}`}>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{a.displayName}</h3>
                        <p className="text-xs text-muted-foreground">{a.provider} · {a.modelEndpoint}</p>
                      </div>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-3">{a.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <Badge variant={a.isActive ? "default" : "secondary"}>
                        {a.isActive ? "active" : "inactive"}
                      </Badge>
                      {lastRun && (
                        <span className={`px-2 py-0.5 rounded ${statusColor(lastRun.status)}`}>
                          last: {lastRun.status}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSelectedAgentId(a.id)}
                        data-testid={`button-view-knowledge-${a.role}`}
                      >
                        View knowledge
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingAgent(a)}
                        data-testid={`button-edit-agent-${a.role}`}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filter:</span>
            <Button size="sm" variant={jobFilter === "all" ? "default" : "outline"} onClick={() => setJobFilter("all")} data-testid="filter-jobs-all">All</Button>
            <Button size="sm" variant={jobFilter === "live" ? "default" : "outline"} onClick={() => setJobFilter("live")} data-testid="filter-jobs-live">Live only</Button>
            <Button size="sm" variant={jobFilter === "dry" ? "default" : "outline"} onClick={() => setJobFilter("dry")} data-testid="filter-jobs-dry">Dry only</Button>
            {jobs && jobs.some(isStale) && (
              <Badge variant="destructive" className="ml-2" data-testid="badge-stale-count">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {jobs.filter(isStale).length} stale
              </Badge>
            )}
          </div>
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">City</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Mode</th>
                  <th className="px-4 py-2 font-medium">Worker</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = (jobs || []).filter((j) =>
                    jobFilter === "all" ? true : jobFilter === "live" ? !j.dryRun : j.dryRun
                  )
                  if (filtered.length === 0) {
                    return <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No jobs match this filter.</td></tr>
                  }
                  return filtered.map((j) => {
                    const stale = isStale(j)
                    return (
                    <tr key={j.id} className={`border-t ${stale ? "bg-red-50" : ""}`} data-testid={`row-job-${j.id}`}>
                      <td className="px-4 py-2 font-mono">{j.citySlug}</td>
                      <td className="px-4 py-2">{j.currentStage || "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${statusColor(j.status)}`}>{j.status}</span>
                        {stale && <Badge variant="destructive" className="ml-2" data-testid={`badge-stale-${j.id}`}><AlertTriangle className="mr-1 h-3 w-3" />stale</Badge>}
                      </td>
                      <td className="px-4 py-2">{j.dryRun ? <Badge variant="outline">dry</Badge> : <Badge>live</Badge>}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{j.claimedBy || "—"}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(j.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        {(stale || j.status === "running") && (
                          <Button
                            size="sm"
                            variant={stale ? "destructive" : "outline"}
                            disabled={releaseMutation.isPending}
                            onClick={() => releaseMutation.mutate(j.id)}
                            data-testid={`button-release-${j.id}`}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" />
                            Release
                          </Button>
                        )}
                      </td>
                    </tr>
                  )})
                })()}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="mt-4">
          <div className="space-y-3">
            {!review || review.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">Review queue is empty.</Card>
            ) : (
              review.map((r) => <ReviewCard key={r.id} item={r} onAction={(status) => reviewMutation.mutate({ id: r.id, status })} pending={reviewMutation.isPending} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="mt-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filter by agent:</span>
            <Button
              size="sm"
              variant={!selectedAgentId ? "default" : "outline"}
              onClick={() => setSelectedAgentId(null)}
            >All</Button>
            {agents?.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant={selectedAgentId === a.id ? "default" : "outline"}
                onClick={() => setSelectedAgentId(a.id)}
              >{a.displayName}</Button>
            ))}
          </div>
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">City</th>
                  <th className="px-4 py-2 font-medium">Key</th>
                  <th className="px-4 py-2 font-medium">Value</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Fetched</th>
                </tr>
              </thead>
              <tbody>
                {!knowledge || knowledge.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No knowledge entries yet. Workers will populate this.</td></tr>
                ) : (
                  knowledge.map((k) => (
                    <tr key={k.id} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs">{k.citySlug || "—"}</td>
                      <td className="px-4 py-2 font-medium">{k.key}</td>
                      <td className="px-4 py-2 text-xs max-w-md truncate">{JSON.stringify(k.value)}</td>
                      <td className="px-4 py-2 text-xs">
                        {k.sourceUrl ? (
                          <a href={k.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">link</a>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(k.fetchedAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        <TabsContent value="runs" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">Agent</th>
                  <th className="px-4 py-2 font-medium">City</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Tokens</th>
                  <th className="px-4 py-2 font-medium">Cost</th>
                  <th className="px-4 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {!runs || runs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No agent runs yet.</td></tr>
                ) : (
                  runs.map((r) => {
                    const agent = agents?.find((a) => a.id === r.agentId)
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2">{agent?.displayName || r.agentId.slice(0, 8)}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.citySlug || "—"}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${statusColor(r.status)}`}>{r.status}</span>
                        </td>
                        <td className="px-4 py-2 text-xs">{r.tokensUsed ?? "—"}</td>
                        <td className="px-4 py-2 text-xs">{r.costUsd ? `$${r.costUsd}` : "—"}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </Card>
        </TabsContent>
      </Tabs>
      <AgentEditor agent={editingAgent} onClose={() => setEditingAgent(null)} />
    </div>
  )
}

function AgentEditor({ agent, onClose }: { agent: Agent | null; onClose: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState<{ provider: string; modelEndpoint: string; systemPrompt: string; sources: string; isActive: boolean }>({
    provider: "", modelEndpoint: "", systemPrompt: "", sources: "", isActive: true,
  })

  const { data: full } = useQuery<any>({
    queryKey: agent ? ["/api/admin/newsroom/agents", agent.id] : ["__noop__"],
    queryFn: async () => {
      if (!agent) return null
      const all = await (await fetch("/api/admin/newsroom/agents", { credentials: "include" })).json()
      return all.find((a: any) => a.id === agent.id)
    },
    enabled: !!agent,
  })

  useEffect(() => {
    if (full) {
      setForm({
        provider: full.provider || "",
        modelEndpoint: full.modelEndpoint || "",
        systemPrompt: full.systemPrompt || "",
        sources: Array.isArray(full.sources) ? full.sources.join("\n") : "",
        isActive: full.isActive,
      })
    }
  }, [full])

  const save = useMutation({
    mutationFn: async () => {
      if (!agent) return
      return apiRequest("PATCH", `/api/admin/newsroom/agents/${agent.id}`, {
        provider: form.provider || null,
        modelEndpoint: form.modelEndpoint || null,
        systemPrompt: form.systemPrompt || null,
        sources: form.sources.split("\n").map((s) => s.trim()).filter(Boolean),
        isActive: form.isActive,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/agents"] })
      toast({ title: "Agent updated", description: `${agent?.displayName} configuration saved.` })
      onClose()
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" })
    },
  })

  return (
    <Dialog open={!!agent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure agent: {agent?.displayName}</DialogTitle>
        </DialogHeader>
        {!full ? (
          <div className="py-8"><Skeleton className="h-32" /></div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Provider</label>
                <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="anthropic, openai, perplexity..." data-testid="input-agent-provider" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Model endpoint</label>
                <Input value={form.modelEndpoint} onChange={(e) => setForm({ ...form, modelEndpoint: e.target.value })} placeholder="claude-3-5-sonnet, gpt-4o..." data-testid="input-agent-model" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">System prompt</label>
              <Textarea value={form.systemPrompt} onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} rows={6} className="font-mono text-xs" data-testid="textarea-agent-prompt" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Sources (one per line)</label>
              <Textarea value={form.sources} onChange={(e) => setForm({ ...form, sources: e.target.value })} rows={4} className="font-mono text-xs" placeholder="wbjournal.com&#10;sec.gov/edgar" data-testid="textarea-agent-sources" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} data-testid="switch-agent-active" />
              Active (eligible to run)
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={save.isPending || !full} onClick={() => save.mutate()} data-testid="button-save-agent">
            {save.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

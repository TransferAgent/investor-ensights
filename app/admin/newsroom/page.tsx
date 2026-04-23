"use client"
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Bot, PlayCircle, FileSearch, Users, PenLine, ShieldCheck, Link2, Activity } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

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
  createdAt: string
  updatedAt: string
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

function ReviewCard({ item, onAction, pending }: { item: ReviewItem; onAction: (status: "approved" | "rejected") => void; pending: boolean }) {
  const draft = (item.draftPayload || {}) as any
  const isV1 = draft?.version === "v1"
  const { data: links } = useQuery<InternalLink[]>({
    queryKey: ["/api/admin/newsroom/internal-links", { reviewQueueId: item.id }],
    queryFn: async () => {
      const url = new URL("/api/admin/newsroom/internal-links", window.location.origin)
      url.searchParams.set("reviewQueueId", item.id)
      const res = await fetch(url.toString(), { credentials: "include" })
      return res.json()
    },
  })
  return (
    <Card className="p-4" data-testid={`card-review-${item.id}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{item.citySlug}</span>
          {item.qcScore != null && <Badge variant="outline">QC {item.qcScore}/100</Badge>}
          {isV1 ? <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">v1 schema ✓</Badge> : <Badge variant="destructive">non-v1 — cannot publish</Badge>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={pending} onClick={() => onAction("rejected")} data-testid={`button-reject-${item.id}`}>Reject</Button>
          <Button size="sm" disabled={pending} onClick={() => onAction("approved")} data-testid={`button-approve-${item.id}`}>Approve & Publish</Button>
        </div>
      </div>
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
  const [dryRun, setDryRun] = useState(true)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)

  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/admin/newsroom/agents"],
  })

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ["/api/admin/newsroom/jobs"],
    refetchInterval: 5000,
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
        dryRun,
        payload: {},
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/newsroom/jobs"] })
      setCitySlug("")
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              data-testid="checkbox-dry-run"
            />
            Dry run (no LLM credits burned)
          </label>
          <Button
            disabled={!citySlug || enqueueMutation.isPending}
            onClick={() => enqueueMutation.mutate()}
            data-testid="button-enqueue-job"
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Enqueue pipeline
          </Button>
        </div>
      </Card>

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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => setSelectedAgentId(a.id)}
                      data-testid={`button-view-knowledge-${a.role}`}
                    >
                      View knowledge
                    </Button>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2 font-medium">City</th>
                  <th className="px-4 py-2 font-medium">Stage</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Mode</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {!jobs || jobs.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No jobs yet. Enqueue one above.</td></tr>
                ) : (
                  jobs.map((j) => (
                    <tr key={j.id} className="border-t" data-testid={`row-job-${j.id}`}>
                      <td className="px-4 py-2 font-mono">{j.citySlug}</td>
                      <td className="px-4 py-2">{j.currentStage || "—"}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${statusColor(j.status)}`}>{j.status}</span>
                      </td>
                      <td className="px-4 py-2">{j.dryRun ? <Badge variant="outline">dry</Badge> : <Badge>live</Badge>}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(j.createdAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
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
    </div>
  )
}

"use client"
import { useState, useMemo } from "react"
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  BookOpen,
  Eye,
  AlertTriangle,
  CheckCircle,
} from "lucide-react"

interface HayloArticle {
  id: string
  slug: string
  title: string
  topicSlug: string
  bodyHtml: string
  summary: string | null
  status: string
  source: string
  sourceFilename: string | null
  contentHash: string
  placementCount: number
  createdAt: string
  updatedAt: string
}

interface ScanResult {
  inboxPath: string
  totalSeen: number
  imported: Array<{ filename: string; id: string; title: string; topicSlug: string }>
  skipped: Array<{ filename: string; reason: string; existingId?: string }>
  errors: Array<{ filename: string; message: string }>
}

const STATUS_OPTIONS = [
  { value: "ready", label: "Ready" },
  { value: "draft", label: "Draft" },
  { value: "retired", label: "Retired" },
]

function statusBadgeClass(status: string): string {
  if (status === "ready") return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
  if (status === "draft") return "bg-amber-100 text-amber-800 hover:bg-amber-100"
  return "bg-zinc-200 text-zinc-700 hover:bg-zinc-200"
}

interface ArticleFormState {
  title: string
  topicSlug: string
  slug: string
  status: string
  summary: string
  bodyHtml: string
}

const EMPTY_FORM: ArticleFormState = {
  title: "",
  topicSlug: "",
  slug: "",
  status: "ready",
  summary: "",
  bodyHtml: "",
}

export default function HayloLibraryPage() {
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [topicFilter, setTopicFilter] = useState<string>("all")
  const [search, setSearch] = useState<string>("")
  const [openAdd, setOpenAdd] = useState(false)
  const [editing, setEditing] = useState<HayloArticle | null>(null)
  const [previewing, setPreviewing] = useState<HayloArticle | null>(null)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [form, setForm] = useState<ArticleFormState>(EMPTY_FORM)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: articles, isLoading } = useQuery<HayloArticle[]>({
    queryKey: ["/api/admin/haylo-articles"],
  })

  const topics = useMemo(() => {
    const set = new Set<string>()
    for (const a of articles ?? []) set.add(a.topicSlug)
    return Array.from(set).sort()
  }, [articles])

  const filtered = useMemo(() => {
    let list = articles ?? []
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter)
    if (topicFilter !== "all") list = list.filter((a) => a.topicSlug === topicFilter)
    if (search.trim().length > 0) {
      const s = search.toLowerCase()
      list = list.filter((a) => a.title.toLowerCase().includes(s) || a.slug.toLowerCase().includes(s))
    }
    return list
  }, [articles, statusFilter, topicFilter, search])

  const totalReady = useMemo(() => (articles ?? []).filter((a) => a.status === "ready").length, [articles])
  const totalPlacements = useMemo(() => (articles ?? []).reduce((sum, a) => sum + (a.placementCount ?? 0), 0), [articles])

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<ArticleFormState>) => {
      return await apiRequest("POST", "/api/admin/haylo-articles", payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/haylo-articles"] })
      setOpenAdd(false)
      setForm(EMPTY_FORM)
      toast({ title: "Haylo article saved", description: "Available for pairing in Newsroom." })
    },
    onError: async (err: any) => {
      const msg = err?.message ?? "Save failed"
      toast({ title: "Could not save", description: msg, variant: "destructive" })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ArticleFormState> }) => {
      return await apiRequest("PATCH", `/api/admin/haylo-articles/${id}`, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/haylo-articles"] })
      setEditing(null)
      setForm(EMPTY_FORM)
      toast({ title: "Article updated" })
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err?.message ?? "", variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/haylo-articles/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/haylo-articles"] })
      toast({ title: "Article deleted" })
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err?.message ?? "", variant: "destructive" })
    },
    onSettled: () => {
      setDeletingId(null)
    },
  })

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/haylo-articles/scan-inbox")
      return (await res.json()) as ScanResult
    },
    onSuccess: (result) => {
      setScanResult(result)
      queryClient.invalidateQueries({ queryKey: ["/api/admin/haylo-articles"] })
      toast({
        title: `Scanned ${result.totalSeen} file${result.totalSeen === 1 ? "" : "s"}`,
        description: `Imported ${result.imported.length} · Skipped ${result.skipped.length} · Errors ${result.errors.length}`,
      })
    },
    onError: (err: any) => {
      toast({ title: "Scan failed", description: err?.message ?? "", variant: "destructive" })
    },
  })

  function startEdit(a: HayloArticle) {
    setEditing(a)
    setForm({
      title: a.title,
      topicSlug: a.topicSlug,
      slug: a.slug,
      status: a.status,
      summary: a.summary ?? "",
      bodyHtml: a.bodyHtml,
    })
  }

  function submitForm() {
    if (form.title.trim().length === 0 || form.topicSlug.trim().length === 0 || form.bodyHtml.trim().length === 0) {
      toast({ title: "Missing fields", description: "Title, topic, and body HTML are required.", variant: "destructive" })
      return
    }
    const payload = {
      title: form.title.trim(),
      topicSlug: form.topicSlug.trim(),
      slug: form.slug.trim() || undefined,
      status: form.status,
      summary: form.summary.trim().length > 0 ? form.summary.trim() : null,
      bodyHtml: form.bodyHtml,
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  function confirmDelete(a: HayloArticle) {
    if (a.placementCount > 0) {
      toast({
        title: "Cannot delete",
        description: `This article has ${a.placementCount} active placements. Retire it instead.`,
        variant: "destructive",
      })
      return
    }
    if (window.confirm(`Delete "${a.title}"? This cannot be undone.`)) {
      setDeletingId(a.id)
      deleteMutation.mutate(a.id)
    }
  }

  return (
    <div className="space-y-6" data-testid="page-haylo-library">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold" data-testid="text-page-title">
            <BookOpen className="h-6 w-6" /> Haylo Library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Production-ready essays from Haylo Lab. Newsroom pairs these with cities to produce press releases.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            data-testid="button-scan-inbox"
          >
            {scanMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Scan Inbox
          </Button>
          <Dialog open={openAdd} onOpenChange={(o) => { setOpenAdd(o); if (!o) setForm(EMPTY_FORM) }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-haylo-article">
                <Plus className="mr-2 h-4 w-4" />
                Add Article
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Haylo Article</DialogTitle>
                <DialogDescription>
                  Paste production-ready HTML from Haylo Lab. The body is preserved byte-for-byte; Newsroom only adds the local vibe and wrapper at glue time.
                </DialogDescription>
              </DialogHeader>
              <ArticleForm form={form} setForm={setForm} />
              <DialogFooter>
                <Button variant="outline" onClick={() => { setOpenAdd(false); setForm(EMPTY_FORM) }}>Cancel</Button>
                <Button onClick={submitForm} disabled={createMutation.isPending} data-testid="button-save-haylo-article">
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Article
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total articles</div>
          <div className="mt-1 text-2xl font-semibold" data-testid="stat-total-articles">{articles?.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Ready for pairing</div>
          <div className="mt-1 text-2xl font-semibold" data-testid="stat-ready-articles">{totalReady}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Active placements</div>
          <div className="mt-1 text-2xl font-semibold" data-testid="stat-total-placements">{totalPlacements}</div>
        </Card>
      </div>

      {scanResult && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-medium">Last inbox scan: <span className="font-mono text-sm">{scanResult.inboxPath}/</span></div>
            <Button variant="ghost" size="sm" onClick={() => setScanResult(null)}>Dismiss</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <div className="font-medium text-emerald-700">Imported ({scanResult.imported.length})</div>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground" data-testid="list-scan-imported">
                {scanResult.imported.slice(0, 8).map((i) => (<li key={i.filename}>· {i.filename}</li>))}
                {scanResult.imported.length > 8 && <li>+ {scanResult.imported.length - 8} more</li>}
                {scanResult.imported.length === 0 && <li className="italic">none</li>}
              </ul>
            </div>
            <div>
              <div className="font-medium text-amber-700">Skipped ({scanResult.skipped.length})</div>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {scanResult.skipped.slice(0, 8).map((i) => (<li key={i.filename}>· {i.filename} — {i.reason}</li>))}
                {scanResult.skipped.length > 8 && <li>+ {scanResult.skipped.length - 8} more</li>}
                {scanResult.skipped.length === 0 && <li className="italic">none</li>}
              </ul>
            </div>
            <div>
              <div className="font-medium text-rose-700">Errors ({scanResult.errors.length})</div>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {scanResult.errors.slice(0, 8).map((i) => (<li key={i.filename}>· {i.filename} — {i.message}</li>))}
                {scanResult.errors.length === 0 && <li className="italic">none</li>}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search title or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
            data-testid="input-search-haylo"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={topicFilter} onValueChange={setTopicFilter}>
            <SelectTrigger className="w-48" data-testid="select-topic-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {topics.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground" data-testid="text-result-count">
            Showing {filtered.length} of {articles?.length ?? 0}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground" data-testid="text-empty-state">
            {(articles?.length ?? 0) === 0 ? (
              <>
                <BookOpen className="mx-auto mb-2 h-8 w-8 opacity-50" />
                No Haylo articles yet. Click <strong>Add Article</strong> to paste one in,
                or drop <code>.html</code> files into <code className="rounded bg-muted px-1">haylo-inbox/</code> and click <strong>Scan Inbox</strong>.
              </>
            ) : (
              <>No articles match the current filters.</>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Placements</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id} data-testid={`row-haylo-${a.id}`}>
                  <TableCell>
                    <div className="font-medium" data-testid={`text-title-${a.id}`}>{a.title}</div>
                    <div className="text-xs text-muted-foreground font-mono">{a.slug}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">{a.topicSlug}</Badge></TableCell>
                  <TableCell><Badge className={statusBadgeClass(a.status)}>{a.status}</Badge></TableCell>
                  <TableCell data-testid={`text-placements-${a.id}`}>{a.placementCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.source}{a.sourceFilename ? ` · ${a.sourceFilename}` : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(a.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setPreviewing(a)} data-testid={`button-preview-${a.id}`} title="Preview">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => startEdit(a)} data-testid={`button-edit-${a.id}`} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => confirmDelete(a)}
                        disabled={deletingId === a.id}
                        data-testid={`button-delete-${a.id}`}
                        title="Delete"
                      >
                        {deletingId === a.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-destructive" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setForm(EMPTY_FORM) } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Haylo Article</DialogTitle>
            <DialogDescription>
              Editing the body changes the content hash. If your new body matches another article, the save will be rejected.
            </DialogDescription>
          </DialogHeader>
          <ArticleForm form={form} setForm={setForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setForm(EMPTY_FORM) }}>Cancel</Button>
            <Button onClick={submitForm} disabled={updateMutation.isPending} data-testid="button-update-haylo-article">
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewing} onOpenChange={(o) => { if (!o) setPreviewing(null) }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewing?.title}</DialogTitle>
            <DialogDescription>
              <span className="font-mono text-xs">{previewing?.slug}</span> · topic {previewing?.topicSlug} · {previewing?.bodyHtml.length.toLocaleString()} chars
            </DialogDescription>
          </DialogHeader>
          {previewing && (
            <iframe
              title="Haylo article preview"
              sandbox=""
              className="h-[60vh] w-full rounded border bg-white"
              srcDoc={previewing.bodyHtml}
              data-testid="preview-body"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ArticleForm({ form, setForm }: { form: ArticleFormState; setForm: (f: ArticleFormState) => void }) {
  return (
    <div className="space-y-3 py-2">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="haylo-title">Title</Label>
          <Input
            id="haylo-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Securing Early Funding for Startups Without the Stress"
            data-testid="input-title"
          />
        </div>
        <div>
          <Label htmlFor="haylo-topic">Topic slug</Label>
          <Input
            id="haylo-topic"
            value={form.topicSlug}
            onChange={(e) => setForm({ ...form, topicSlug: e.target.value })}
            placeholder="early-funding-stress"
            data-testid="input-topic"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="haylo-slug">Slug (optional)</Label>
          <Input
            id="haylo-slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="auto-generated from title"
            data-testid="input-slug"
          />
        </div>
        <div>
          <Label htmlFor="haylo-status">Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger id="haylo-status" data-testid="select-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="haylo-summary">Summary (optional)</Label>
        <Input
          id="haylo-summary"
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
          placeholder="Short description shown in lists"
          data-testid="input-summary"
        />
      </div>
      <div>
        <Label htmlFor="haylo-body">Body HTML <span className="text-xs text-muted-foreground">(preserved byte-for-byte)</span></Label>
        <Textarea
          id="haylo-body"
          value={form.bodyHtml}
          onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
          placeholder='<article class="halo-published">…'
          className="min-h-[280px] font-mono text-xs"
          data-testid="textarea-body"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Tip: include <code className="rounded bg-muted px-1">&lt;!-- newsroom:local-vibe --&gt;</code> in the body where the local vibe block should land. Without it, Newsroom inserts after the first <code>&lt;/section&gt;</code>.
        </p>
      </div>
    </div>
  )
}

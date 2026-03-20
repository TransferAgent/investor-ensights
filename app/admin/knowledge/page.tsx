"use client"
import { useState } from "react"
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
  Plus,
  Pencil,
  Trash2,
  Send,
  Archive,
  History,
  ExternalLink,
  Eye,
} from "lucide-react"

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
  authorName: string
  publisherName: string
  robots: string
  datePublished: string | null
  dateModified: string
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

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  published: "bg-green-500/10 text-green-500 border-green-500/20",
  archived: "bg-gray-500/10 text-gray-400 border-gray-500/20",
}

export default function KnowledgeAdmin() {
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [editArticle, setEditArticle] = useState<KnowledgeArticle | null>(null)
  const [versionsArticle, setVersionsArticle] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("")

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

  const { data: versions } = useQuery<ArticleVersion[]>({
    queryKey: ["/api/admin/knowledge", versionsArticle, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/knowledge/${versionsArticle}/versions`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load")
      return res.json()
    },
    enabled: !!versionsArticle,
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
      toast({ title: "Article published" })
    },
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/admin/knowledge/${id}/archive`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      toast({ title: "Article archived" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/knowledge/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] })
      toast({ title: "Article deleted" })
    },
  })

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

  const articleForm = (isEdit: boolean) => (
    <div className="grid gap-4 max-h-[70vh] overflow-y-auto pr-2">
      <div>
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" value={formSlug} onChange={(e) => setFormSlug(e.target.value)} placeholder="my-press-release" data-testid="input-slug" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">SEO Title</Label>
          <Input id="title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="SEO page title" data-testid="input-title" />
        </div>
        <div>
          <Label htmlFor="dateline">Dateline</Label>
          <Input id="dateline" value={formDateline} onChange={(e) => setFormDateline(e.target.value)} placeholder="NEW YORK, March 18, 2026" data-testid="input-dateline" />
        </div>
      </div>
      <div>
        <Label htmlFor="headline">Headline</Label>
        <Input id="headline" value={formHeadline} onChange={(e) => setFormHeadline(e.target.value)} placeholder="Press release headline" data-testid="input-headline" />
      </div>
      <div>
        <Label htmlFor="subheadline">Subheadline</Label>
        <Input id="subheadline" value={formSubheadline} onChange={(e) => setFormSubheadline(e.target.value)} placeholder="Optional subheadline" data-testid="input-subheadline" />
      </div>
      <div>
        <Label htmlFor="metaDesc">Meta Description</Label>
        <Textarea id="metaDesc" value={formMetaDesc} onChange={(e) => setFormMetaDesc(e.target.value)} placeholder="SEO meta description" rows={2} data-testid="input-meta-desc" />
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

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : !articles?.length ? (
        <Card className="p-8 text-center text-muted-foreground" data-testid="text-no-articles">
          No articles found. Create your first press release.
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Headline</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((a) => (
                <TableRow key={a.id} data-testid={`row-article-${a.id}`}>
                  <TableCell className="font-medium max-w-[250px] truncate">{a.headline}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{a.slug}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[a.status] || ""} data-testid={`badge-status-${a.id}`}>
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(a.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {a.status === "published" && (
                        <Button variant="ghost" size="icon" asChild data-testid={`button-view-${a.id}`}>
                          <a href={`/discovery/knowledge/${a.slug}`} target="_blank" rel="noopener">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openEdit(a)} data-testid={`button-edit-${a.id}`}>
                        <Pencil className="h-4 w-4" />
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
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
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

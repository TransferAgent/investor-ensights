"use client"
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Plus, Pencil, Trash2, Eye, EyeOff, ExternalLink } from "lucide-react"

interface CustomPage {
  id: string
  slug: string
  pageTitle: string
  metaTitle: string | null
  metaDescription: string | null
  isPublished: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

export default function PagesAdmin() {
  const router = useRouter()
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [newSlug, setNewSlug] = useState("")
  const [newTitle, setNewTitle] = useState("")

  const { data: pages, isLoading } = useQuery<CustomPage[]>({
    queryKey: ["/api/admin/pages"],
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/pages", {
        slug: newSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        pageTitle: newTitle,
      })
    },
    onSuccess: async (res) => {
      const page = await res.json()
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] })
      setCreateOpen(false)
      setNewSlug("")
      setNewTitle("")
      toast({ title: "Page created" })
      router.push(`/admin/pages/${page.id}/edit`)
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    },
  })

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      return apiRequest("PATCH", `/api/admin/pages/${id}`, { isPublished })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/pages/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] })
      toast({ title: "Page deleted" })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-pages-title">Page Management</h1>
          <p className="text-sm text-muted-foreground">Create and manage custom marketing pages</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-page">
              <Plus className="mr-2 h-4 w-4" />
              New Page
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Page</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="page-title">Page Title</Label>
                <Input
                  id="page-title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Pricing"
                  data-testid="input-page-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="page-slug">URL Slug</Label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground">/</span>
                  <Input
                    id="page-slug"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="e.g., pricing"
                    data-testid="input-page-slug"
                  />
                </div>
              </div>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newSlug || !newTitle || createMutation.isPending}
                className="w-full"
                data-testid="button-create-page"
              >
                {createMutation.isPending ? "Creating..." : "Create Page"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Page Title</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!pages || pages.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No pages yet. Click "New Page" to create your first page.
                </TableCell>
              </TableRow>
            )}
            {pages?.map((page) => (
              <TableRow key={page.id} data-testid={`row-page-${page.id}`}>
                <TableCell className="font-medium" data-testid={`text-page-title-${page.id}`}>
                  {page.pageTitle}
                </TableCell>
                <TableCell>
                  <code className="text-sm text-muted-foreground">/{page.slug}</code>
                </TableCell>
                <TableCell>
                  <Badge variant={page.isPublished ? "default" : "secondary"} data-testid={`badge-page-status-${page.id}`}>
                    {page.isPublished ? "Live" : "Draft"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(page.updatedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => router.push(`/admin/pages/${page.id}/edit`)}
                      data-testid={`button-edit-page-${page.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => togglePublishMutation.mutate({ id: page.id, isPublished: !page.isPublished })}
                      data-testid={`button-toggle-publish-${page.id}`}
                    >
                      {page.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    {page.isPublished && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => window.open(`/${page.slug}`, "_blank")}
                        data-testid={`button-view-page-${page.id}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${page.pageTitle}"? This cannot be undone.`)) {
                          deleteMutation.mutate(page.id)
                        }
                      }}
                      data-testid={`button-delete-page-${page.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

"use client"
import { useState, useRef } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  Upload,
  Download,
  Trash2,
  FileText,
  File,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react"

interface DataStoreFileItem {
  id: string
  filename: string
  originalName: string
  mimeType: string
  fileSize: number
  category: string
  status: string
  notes: string | null
  uploadedBy: string | null
  createdAt: string
  updatedAt: string
}

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", icon: Clock, label: "Pending Review" },
  approved: { color: "bg-green-500/10 text-green-500 border-green-500/20", icon: CheckCircle, label: "Approved" },
  rejected: { color: "bg-red-500/10 text-red-500 border-red-500/20", icon: XCircle, label: "Rejected" },
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") return <File className="h-5 w-5 text-red-500" />
  if (mimeType.includes("word")) return <FileText className="h-5 w-5 text-blue-500" />
  return <FileText className="h-5 w-5 text-muted-foreground" />
}

const CATEGORY = "email"

export default function EmailPage() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadNotes, setUploadNotes] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  const { data: files, isLoading } = useQuery<DataStoreFileItem[]>({
    queryKey: ["/api/admin/data-store", filterStatus, CATEGORY],
    queryFn: async () => {
      const params = new URLSearchParams({ category: CATEGORY })
      if (filterStatus) params.set("status", filterStatus)
      const res = await fetch(`/api/admin/data-store?${params}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load")
      return res.json()
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("category", CATEGORY)
      if (uploadNotes) formData.append("notes", uploadNotes)
      const res = await fetch("/api/admin/data-store", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Upload failed")
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-store"] })
      toast({ title: "File uploaded successfully" })
      setUploadOpen(false)
      setUploadNotes("")
      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/admin/data-store/${id}`, { status })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-store"] })
      toast({ title: "Status updated" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/data-store/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/data-store"] })
      toast({ title: "File deleted" })
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Email</h1>
          <p className="text-sm text-muted-foreground mt-1">Upload and manage email campaigns, templates, and narratives</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-upload-file">
              <Upload className="mr-2 h-4 w-4" />
              Upload File
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Email Content</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Supported: PDF, Word (.doc/.docx), TXT, HTML, Markdown (max 10MB)</p>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.html,.md"
                  onChange={handleFileSelect}
                  disabled={uploadMutation.isPending}
                  data-testid="input-file-upload"
                />
              </div>
              <div>
                <Textarea
                  placeholder="Notes about this file (optional)..."
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={3}
                  data-testid="input-upload-notes"
                />
              </div>
              {uploadMutation.isPending && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Files</p>
          <p className="text-2xl font-bold" data-testid="text-total-files">{files?.length ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-500" data-testid="text-pending-files">{files?.filter(f => f.status === "pending").length ?? "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Approved</p>
          <p className="text-2xl font-bold text-green-500" data-testid="text-approved-files">{files?.filter(f => f.status === "approved").length ?? "—"}</p>
        </Card>
      </div>

      <div className="flex gap-2">
        {["", "pending", "approved", "rejected"].map((s) => (
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
      ) : !files?.length ? (
        <Card className="p-8 text-center text-muted-foreground" data-testid="text-no-files">
          No email files uploaded yet. Upload your first email content.
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((f) => {
                const sc = statusConfig[f.status] || statusConfig.pending
                const StatusIcon = sc.icon
                return (
                  <TableRow key={f.id} data-testid={`row-file-${f.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(f.mimeType)}
                        <div>
                          <p className="font-medium text-sm">{f.originalName}</p>
                          <p className="text-xs text-muted-foreground">{f.mimeType.split("/").pop()}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatFileSize(f.fileSize)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sc.color}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {sc.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{f.notes || "—"}</TableCell>
                    <TableCell className="text-sm">{new Date(f.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <a href={`/api/admin/data-store/${f.id}/download`} target="_blank" rel="noopener">
                          <Button variant="ghost" size="icon" title="Download" data-testid={`button-download-${f.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                        {f.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateStatusMutation.mutate({ id: f.id, status: "approved" })}
                            disabled={updateStatusMutation.isPending}
                            title="Approve"
                            data-testid={`button-approve-${f.id}`}
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                        {f.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => updateStatusMutation.mutate({ id: f.id, status: "rejected" })}
                            disabled={updateStatusMutation.isPending}
                            title="Reject"
                            data-testid={`button-reject-${f.id}`}
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { if (confirm("Delete this file?")) deleteMutation.mutate(f.id) }}
                          title="Delete"
                          data-testid={`button-delete-${f.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

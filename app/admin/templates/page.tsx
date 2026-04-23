"use client"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import {
  Plus,
  FileText,
  Loader2,
  Edit,
  Info,
} from "lucide-react"

interface ContentTemplate {
  id: string
  templateName: string
  templateDescription: string | null
  metaTitlePattern: string | null
  metaDescriptionPattern: string | null
  h1HeaderPattern: string | null
  h2SubheaderPattern: string | null
  bodyContentPattern: string | null
  ctaText: string | null
  ctaUrlPattern: string | null
  isActive: boolean
  isDefault: boolean
  allowIndexing: boolean
  version: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

function TemplateForm({
  template,
  onClose,
}: {
  template?: ContentTemplate
  onClose: () => void
}) {
  const { toast } = useToast()
  const isEdit = !!template

  const [form, setForm] = useState({
    templateName: template?.templateName || "",
    templateDescription: template?.templateDescription || "",
    metaTitlePattern: template?.metaTitlePattern || "",
    metaDescriptionPattern: template?.metaDescriptionPattern || "",
    h1HeaderPattern: template?.h1HeaderPattern || "",
    h2SubheaderPattern: template?.h2SubheaderPattern || "",
    bodyContentPattern: template?.bodyContentPattern || "",
    ctaText: template?.ctaText || "",
    ctaUrlPattern: template?.ctaUrlPattern || "",
    isActive: template?.isActive ?? true,
    isDefault: template?.isDefault ?? false,
    allowIndexing: template?.allowIndexing ?? true,
    _previewBody: false as boolean,
  })

  const mutation = useMutation({
    mutationFn: async () => {
      const { _previewBody, ...payload } = form
      if (isEdit) {
        await apiRequest("PATCH", `/api/admin/templates/${template.id}`, payload)
      } else {
        await apiRequest("POST", "/api/admin/templates", payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/templates"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] })
      toast({
        title: isEdit ? "Template Updated" : "Template Created",
        description: `"${form.templateName}" has been saved`,
      })
      onClose()
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      })
    },
  })

  const update = (key: string, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate()
      }}
      className="space-y-4 max-h-[70vh] overflow-y-auto pr-1"
    >
      <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Use placeholders like <code className="font-mono text-xs bg-muted px-1 rounded">{`{{city}}`}</code>,{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">{`{{state}}`}</code>,{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">{`{{state_name}}`}</code>,{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">{`{{slug}}`}</code>,{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">{`{{address}}`}</code>,{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">{`{{landmarks}}`}</code>,{" "}
          <code className="font-mono text-xs bg-muted px-1 rounded">{`{{nearby_cities}}`}</code>{" "}
          in your patterns
        </span>
      </div>

      <div className="space-y-1.5">
        <Label>Template Name *</Label>
        <Input
          value={form.templateName}
          onChange={(e) => update("templateName", e.target.value)}
          placeholder="e.g., Standard City Page"
          required
          data-testid="input-template-name"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Description</Label>
        <Input
          value={form.templateDescription}
          onChange={(e) => update("templateDescription", e.target.value)}
          placeholder="Brief description of this template"
          data-testid="input-template-desc"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Meta Title Pattern</Label>
          <Input
            value={form.metaTitlePattern}
            onChange={(e) => update("metaTitlePattern", e.target.value)}
            placeholder="{{city}} Services | YourCompany"
            data-testid="input-meta-title"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Meta Description Pattern</Label>
          <Input
            value={form.metaDescriptionPattern}
            onChange={(e) => update("metaDescriptionPattern", e.target.value)}
            placeholder="Professional services in {{city}}, {{state}}"
            data-testid="input-meta-desc"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>H1 Header Pattern</Label>
        <Input
          value={form.h1HeaderPattern}
          onChange={(e) => update("h1HeaderPattern", e.target.value)}
          placeholder="Welcome to Our {{city}} Office"
          data-testid="input-h1"
        />
      </div>

      <div className="space-y-1.5">
        <Label>H2 Subheader Pattern</Label>
        <Input
          value={form.h2SubheaderPattern}
          onChange={(e) => update("h2SubheaderPattern", e.target.value)}
          placeholder="Professional Services in {{city}}, {{state_name}}"
          data-testid="input-h2"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>Body Content Pattern (HTML supported)</Label>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border"
            onClick={() => update("_previewBody", !form._previewBody)}
            data-testid="button-toggle-preview"
          >
            {form._previewBody ? "Edit" : "Preview"}
          </button>
        </div>
        {form._previewBody ? (
          <div
            className="rounded-md border p-4 min-h-[150px] text-sm prose prose-sm max-w-none bg-muted/30"
            dangerouslySetInnerHTML={{ __html: form.bodyContentPattern }}
            data-testid="preview-body"
          />
        ) : (
          <Textarea
            value={form.bodyContentPattern}
            onChange={(e) => update("bodyContentPattern", e.target.value)}
            placeholder="<h3>Privacy-First Cap Table in {{city}}</h3><p>We're proud to serve the {{city}} community...</p>"
            rows={10}
            className="font-mono text-xs"
            data-testid="input-body"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Use HTML tags for rich content: &lt;h3&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;&lt;li&gt;, etc.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>CTA Text</Label>
          <Input
            value={form.ctaText}
            onChange={(e) => update("ctaText", e.target.value)}
            placeholder="Contact Us Today"
            data-testid="input-cta-text"
          />
        </div>
        <div className="space-y-1.5">
          <Label>CTA URL Pattern</Label>
          <Input
            value={form.ctaUrlPattern}
            onChange={(e) => update("ctaUrlPattern", e.target.value)}
            placeholder="/contact?location={{slug}}"
            data-testid="input-cta-url"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            checked={form.isActive}
            onCheckedChange={(v) => update("isActive", v)}
            data-testid="switch-active"
          />
          <Label>Active</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.isDefault}
            onCheckedChange={(v) => update("isDefault", v)}
            data-testid="switch-default"
          />
          <Label>Default Template</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={form.allowIndexing}
            onCheckedChange={(v) => update("allowIndexing", v)}
            data-testid="switch-allow-indexing"
          />
          <Label>Allow Indexing (off = noindex)</Label>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending || !form.templateName}
          data-testid="button-save-template"
        >
          {mutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isEdit ? "Update" : "Create"} Template
        </Button>
      </div>
    </form>
  )
}

export default function AdminTemplatesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ContentTemplate | undefined>()

  const { data: templates = [], isLoading } = useQuery<ContentTemplate[]>({
    queryKey: ["/api/admin/templates"],
  })

  const openCreate = () => {
    setEditingTemplate(undefined)
    setDialogOpen(true)
  }

  const openEdit = (t: ContentTemplate) => {
    setEditingTemplate(t)
    setDialogOpen(true)
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-templates-title">
            Content Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Create reusable content patterns with placeholders
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} data-testid="button-new-template">
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Edit Template" : "Create Template"}
              </DialogTitle>
            </DialogHeader>
            <TemplateForm
              template={editingTemplate}
              onClose={() => setDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-2 h-5 w-40" />
              <Skeleton className="mb-4 h-4 w-60" />
              <Skeleton className="h-3 w-32" />
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="mb-1 text-lg font-medium">No templates yet</p>
          <p className="mb-4 text-sm text-muted-foreground">
            Create your first content template to get started
          </p>
          <Button onClick={openCreate} data-testid="button-create-first-template">
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id} className="p-5" data-testid={`card-template-${t.id}`}>
              <div className="mb-3 flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{t.templateName}</h3>
                    <p className="text-xs text-muted-foreground">v{t.version}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {t.isDefault && <Badge variant="default">Default</Badge>}
                  <Badge variant={t.isActive ? "secondary" : "outline"}>
                    {t.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              {t.templateDescription && (
                <p className="mb-3 text-sm text-muted-foreground">
                  {t.templateDescription}
                </p>
              )}

              {t.h1HeaderPattern && (
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-medium">H1:</span>{" "}
                  <span className="font-mono">{t.h1HeaderPattern}</span>
                </p>
              )}
              {t.metaTitlePattern && (
                <p className="mb-3 text-xs text-muted-foreground">
                  <span className="font-medium">Title:</span>{" "}
                  <span className="font-mono">{t.metaTitlePattern}</span>
                </p>
              )}

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(t)}
                  data-testid={`button-edit-template-${t.id}`}
                >
                  <Edit className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

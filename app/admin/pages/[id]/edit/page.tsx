"use client"
import { useState, useEffect, use } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { useToast } from "@/hooks/use-toast"
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Eye,
  ExternalLink,
  Check,
  AlertCircle,
} from "lucide-react"

interface PageSlide {
  id: string
  pageId: string
  slideType: string
  slideOrder: number
  contentJson: any
  contentHtml: string | null
  backgroundColor: string | null
  paddingClass: string | null
  containerWidth: string | null
}

interface PageWithSlides {
  id: string
  slug: string
  pageTitle: string
  metaTitle: string | null
  metaDescription: string | null
  ogImageUrl: string | null
  isPublished: boolean
  displayOrder: number
  slides: PageSlide[]
}

const SLIDE_TYPES = [
  { value: "hero", label: "Hero Section" },
  { value: "features", label: "Feature Grid" },
  { value: "pricing", label: "Pricing Table" },
  { value: "text", label: "Text Block" },
  { value: "image_text", label: "Image + Text" },
  { value: "cta", label: "Call to Action" },
  { value: "html", label: "Custom HTML" },
]

const SLIDE_TEMPLATES: Record<string, any> = {
  hero: {
    type: "hero",
    headline: "Your Headline Here",
    subheadline: "A compelling subheadline that describes your value proposition",
    cta_text: "Get Started",
    cta_url: "/locations",
  },
  features: {
    type: "features",
    layout: "3-column",
    headline: "Our Features",
    features: [
      { icon: "BarChart3", title: "Analytics", description: "Track performance across all markets" },
      { icon: "Users", title: "Team Collaboration", description: "Unified platform for your team" },
      { icon: "Zap", title: "Fast Deployment", description: "Launch campaigns in minutes" },
    ],
  },
  pricing: {
    type: "pricing",
    headline: "Simple Pricing",
    tiers: [
      { name: "Starter", price: "$99/mo", features: ["Up to 10 cities", "Basic analytics"], cta_text: "Start Free", cta_url: "/contact" },
      { name: "Professional", price: "$299/mo", popular: true, features: ["Up to 50 cities", "Advanced analytics", "Priority support"], cta_text: "Get Started", cta_url: "/contact" },
      { name: "Enterprise", price: "Custom", features: ["Unlimited cities", "Dedicated manager", "SLA guarantee"], cta_text: "Contact Sales", cta_url: "/contact" },
    ],
  },
  text: {
    type: "text",
    headline: "About Us",
    body: "Write your content here. You can include multiple paragraphs separated by newlines.",
  },
  image_text: {
    type: "image_text",
    layout: "image-left",
    headline: "Why Choose Us",
    body: "Describe your value proposition here.",
    image_url: "https://placehold.co/600x400",
    image_alt: "Description of the image",
  },
  cta: {
    type: "cta",
    headline: "Ready to Get Started?",
    subheadline: "Contact our team today and discover how we can help grow your business.",
    cta_text: "Contact Us",
    cta_url: "/contact",
  },
  html: {
    type: "html",
    html: "<div class='py-12 text-center'><h2 class='text-3xl font-bold mb-4'>Custom Section</h2><p class='text-lg text-gray-600'>Edit this HTML to create any layout you need.</p></div>",
  },
}

const BG_OPTIONS = [
  { value: "", label: "Default" },
  { value: "bg-primary", label: "Primary" },
  { value: "bg-muted", label: "Muted" },
  { value: "bg-muted/50", label: "Subtle" },
]

const PADDING_OPTIONS = [
  { value: "", label: "Default (py-16)" },
  { value: "py-8", label: "Small (py-8)" },
  { value: "py-12", label: "Medium (py-12)" },
  { value: "py-20", label: "Large (py-20)" },
  { value: "py-24", label: "Extra Large (py-24)" },
]

const CONTAINER_OPTIONS = [
  { value: "", label: "Default (max-w-6xl)" },
  { value: "max-w-4xl", label: "Narrow (max-w-4xl)" },
  { value: "max-w-5xl", label: "Medium (max-w-5xl)" },
  { value: "max-w-7xl", label: "Wide (max-w-7xl)" },
  { value: "max-w-full", label: "Full Width" },
]

export default function PageEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()

  const [pageTitle, setPageTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [metaTitle, setMetaTitle] = useState("")
  const [metaDescription, setMetaDescription] = useState("")
  const [settingsDirty, setSettingsDirty] = useState(false)

  const [slideEditorOpen, setSlideEditorOpen] = useState(false)
  const [editingSlide, setEditingSlide] = useState<PageSlide | null>(null)
  const [slideType, setSlideType] = useState("hero")
  const [slideJson, setSlideJson] = useState("")
  const [slideBg, setSlideBg] = useState("")
  const [slidePadding, setSlidePadding] = useState("")
  const [slideContainer, setSlideContainer] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)

  const { data: page, isLoading } = useQuery<PageWithSlides>({
    queryKey: ["/api/admin/pages", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/pages/${id}`, { credentials: "include" })
      if (!res.ok) throw new Error("Failed to load page")
      return res.json()
    },
  })

  useEffect(() => {
    if (page) {
      setPageTitle(page.pageTitle)
      setSlug(page.slug)
      setMetaTitle(page.metaTitle || "")
      setMetaDescription(page.metaDescription || "")
      setSettingsDirty(false)
    }
  }, [page])

  const updatePageMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/admin/pages/${id}`, {
        pageTitle,
        slug,
        metaTitle: metaTitle || null,
        metaDescription: metaDescription || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages", id] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] })
      setSettingsDirty(false)
      toast({ title: "Page settings saved" })
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    },
  })

  const togglePublishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/admin/pages/${id}`, { isPublished: !page?.isPublished })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages", id] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages"] })
      toast({ title: page?.isPublished ? "Page unpublished" : "Page published" })
    },
  })

  const createSlideMutation = useMutation({
    mutationFn: async () => {
      const contentJson = JSON.parse(slideJson)
      return apiRequest("POST", `/api/admin/pages/${id}/slides`, {
        slideType,
        contentJson,
        backgroundColor: slideBg || null,
        paddingClass: slidePadding || null,
        containerWidth: slideContainer || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages", id] })
      closeSlideEditor()
      toast({ title: "Slide added" })
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    },
  })

  const updateSlideMutation = useMutation({
    mutationFn: async () => {
      if (!editingSlide) return
      const contentJson = JSON.parse(slideJson)
      return apiRequest("PATCH", `/api/admin/pages/${id}/slides/${editingSlide.id}`, {
        slideType,
        contentJson,
        backgroundColor: slideBg || null,
        paddingClass: slidePadding || null,
        containerWidth: slideContainer || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages", id] })
      closeSlideEditor()
      toast({ title: "Slide updated" })
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    },
  })

  const deleteSlideMutation = useMutation({
    mutationFn: async (slideId: string) => {
      return apiRequest("DELETE", `/api/admin/pages/${id}/slides/${slideId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages", id] })
      toast({ title: "Slide deleted" })
    },
  })

  const reorderMutation = useMutation({
    mutationFn: async ({ slideId, direction }: { slideId: string; direction: "up" | "down" }) => {
      return apiRequest("POST", `/api/admin/pages/${id}/slides/reorder`, { slideId, direction })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pages", id] })
    },
  })

  function openNewSlide() {
    setEditingSlide(null)
    setSlideType("hero")
    setSlideJson(JSON.stringify(SLIDE_TEMPLATES.hero, null, 2))
    setSlideBg("")
    setSlidePadding("")
    setSlideContainer("")
    setJsonError(null)
    setSlideEditorOpen(true)
  }

  function openEditSlide(slide: PageSlide) {
    setEditingSlide(slide)
    setSlideType(slide.slideType)
    setSlideJson(JSON.stringify(slide.contentJson, null, 2))
    setSlideBg(slide.backgroundColor || "")
    setSlidePadding(slide.paddingClass || "")
    setSlideContainer(slide.containerWidth || "")
    setJsonError(null)
    setSlideEditorOpen(true)
  }

  function closeSlideEditor() {
    setSlideEditorOpen(false)
    setEditingSlide(null)
    setJsonError(null)
  }

  function handleSlideTypeChange(newType: string) {
    setSlideType(newType)
    if (!editingSlide) {
      setSlideJson(JSON.stringify(SLIDE_TEMPLATES[newType] || {}, null, 2))
    }
  }

  function validateJson(value: string) {
    setSlideJson(value)
    try {
      JSON.parse(value)
      setJsonError(null)
    } catch (e: any) {
      setJsonError(e.message)
    }
  }

  function getSlidePreview(slide: PageSlide): string {
    const content = slide.contentJson as any
    if (content?.headline) return content.headline
    if (content?.type === "html") return "Custom HTML section"
    if (content?.body) return content.body.substring(0, 60) + "..."
    return slide.slideType
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!page) {
    return <div className="text-center py-12 text-muted-foreground">Page not found</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/admin/pages">
            <Button variant="ghost" size="icon" data-testid="button-back-pages">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-edit-page-title">
              Edit: {page.pageTitle}
            </h1>
            <p className="text-sm text-muted-foreground">/{page.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {page.isPublished && (
            <Button
              variant="outline"
              onClick={() => window.open(`/${page.slug}`, "_blank")}
              data-testid="button-preview-page"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View Live
            </Button>
          )}
          <Button
            variant={page.isPublished ? "outline" : "default"}
            onClick={() => togglePublishMutation.mutate()}
            disabled={togglePublishMutation.isPending}
            data-testid="button-toggle-publish"
          >
            {page.isPublished ? (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Unpublish
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">Page Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Page Title</Label>
            <Input
              id="edit-title"
              value={pageTitle}
              onChange={(e) => { setPageTitle(e.target.value); setSettingsDirty(true) }}
              data-testid="input-edit-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-slug">URL Slug</Label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground">/</span>
              <Input
                id="edit-slug"
                value={slug}
                onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")); setSettingsDirty(true) }}
                data-testid="input-edit-slug"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-meta-title">Meta Title (SEO)</Label>
            <Input
              id="edit-meta-title"
              value={metaTitle}
              onChange={(e) => { setMetaTitle(e.target.value); setSettingsDirty(true) }}
              placeholder="Page title for search engines"
              data-testid="input-edit-meta-title"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-meta-desc">Meta Description (SEO)</Label>
            <Input
              id="edit-meta-desc"
              value={metaDescription}
              onChange={(e) => { setMetaDescription(e.target.value); setSettingsDirty(true) }}
              placeholder="Page description for search engines"
              data-testid="input-edit-meta-desc"
            />
          </div>
        </div>
        {settingsDirty && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => updatePageMutation.mutate()}
              disabled={updatePageMutation.isPending}
              data-testid="button-save-settings"
            >
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">
          Page Content ({page.slides?.length || 0} slides)
        </h2>
        <Button onClick={openNewSlide} data-testid="button-add-slide">
          <Plus className="mr-2 h-4 w-4" />
          Add Slide
        </Button>
      </div>

      {(!page.slides || page.slides.length === 0) && (
        <Card className="p-8 text-center text-muted-foreground">
          No slides yet. Click "Add Slide" to start building your page.
        </Card>
      )}

      <div className="space-y-3">
        {page.slides?.map((slide, idx) => (
          <Card key={slide.id} className="p-4" data-testid={`card-slide-${slide.id}`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === 0 || reorderMutation.isPending}
                    onClick={() => reorderMutation.mutate({ slideId: slide.id, direction: "up" })}
                    className="h-6 w-6"
                    data-testid={`button-slide-up-${slide.id}`}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={idx === (page.slides?.length || 0) - 1 || reorderMutation.isPending}
                    onClick={() => reorderMutation.mutate({ slideId: slide.id, direction: "down" })}
                    className="h-6 w-6"
                    data-testid={`button-slide-down-${slide.id}`}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {SLIDE_TYPES.find(t => t.value === slide.slideType)?.label || slide.slideType}
                    </Badge>
                    <span className="text-sm text-muted-foreground">Slide {idx + 1}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1" data-testid={`text-slide-preview-${slide.id}`}>
                    {getSlidePreview(slide)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => openEditSlide(slide)}
                  data-testid={`button-edit-slide-${slide.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (confirm("Delete this slide?")) {
                      deleteSlideMutation.mutate(slide.id)
                    }
                  }}
                  data-testid={`button-delete-slide-${slide.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={slideEditorOpen} onOpenChange={setSlideEditorOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSlide ? "Edit Slide" : "Add New Slide"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Slide Type</Label>
              <Select value={slideType} onValueChange={handleSlideTypeChange}>
                <SelectTrigger data-testid="select-slide-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLIDE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Content (JSON)</Label>
                {jsonError ? (
                  <span className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Invalid JSON
                  </span>
                ) : slideJson && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Valid JSON
                  </span>
                )}
              </div>
              <Textarea
                value={slideJson}
                onChange={(e) => validateJson(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                data-testid="textarea-slide-json"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Background</Label>
                <Select value={slideBg} onValueChange={setSlideBg}>
                  <SelectTrigger data-testid="select-slide-bg">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    {BG_OPTIONS.map((o) => (
                      <SelectItem key={o.value || "default"} value={o.value || "none"}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Padding</Label>
                <Select value={slidePadding} onValueChange={setSlidePadding}>
                  <SelectTrigger data-testid="select-slide-padding">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    {PADDING_OPTIONS.map((o) => (
                      <SelectItem key={o.value || "default"} value={o.value || "none"}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Container Width</Label>
                <Select value={slideContainer} onValueChange={setSlideContainer}>
                  <SelectTrigger data-testid="select-slide-container">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTAINER_OPTIONS.map((o) => (
                      <SelectItem key={o.value || "default"} value={o.value || "none"}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeSlideEditor}>
                Cancel
              </Button>
              <Button
                onClick={() => editingSlide ? updateSlideMutation.mutate() : createSlideMutation.mutate()}
                disabled={!!jsonError || !slideJson || createSlideMutation.isPending || updateSlideMutation.isPending}
                data-testid="button-save-slide"
              >
                <Save className="mr-2 h-4 w-4" />
                {editingSlide ? "Update Slide" : "Add Slide"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"
import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Loader2,
  Lock,
  ArrowRight,
  Upload,
  Download,
  ShieldAlert,
  Sparkles,
  FileText,
} from "lucide-react"

type WizardStep = 1 | 2 | 3 | 4

interface Readiness {
  slug: string
  tenant: {
    personaDisplayName: string
    publisherName: string
    authorName: string
    companyName: string | null
    brandVertical: string | null
    brandTagline: string | null
    brandFeatureCta: string | null
  }
  brand: { complete: boolean }
  cities: { total: number; withEnabledResearchSource: number; groundingGateOpen: boolean }
  haylo: { total: number; ready: boolean }
  publishReady: boolean
}

interface MeResponse {
  isConductor: boolean
}

interface DerivedBrand {
  personaDisplayName: string
  publisherName: string
  authorName: string
  brandVertical: string
  brandTagline: string
  brandFeatureCta: string
  confidence: number
  rationale: string
  model: string
  tokensUsed: number
}

// ============================================================================
// STEP 1 — Identity (slug + names + slug-confirm + Create persona)
// ============================================================================

function StepIdentity({ onCreated }: { onCreated: (slug: string) => void }) {
  const { toast } = useToast()
  const [slug, setSlug] = useState("")
  const [confirmSlug, setConfirmSlug] = useState("")
  const [personaDisplayName, setPersonaDisplayName] = useState("")
  const [publisherName, setPublisherName] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [companyName, setCompanyName] = useState("")

  const slugClean = slug.trim().toLowerCase()
  const slugLooksValid = /^[a-z][a-z0-9_]{1,62}$/.test(slugClean)
  const fieldsFilled =
    slugLooksValid &&
    personaDisplayName.trim().length > 0 &&
    publisherName.trim().length > 0 &&
    authorName.trim().length > 0 &&
    companyName.trim().length > 0
  const slugConfirmed = confirmSlug.trim() === slugClean && slugClean.length > 0
  const canCreate = fieldsFilled && slugConfirmed

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/personas", {
        slug: slugClean,
        personaDisplayName: personaDisplayName.trim(),
        publisherName: publisherName.trim(),
        authorName: authorName.trim(),
        companyName: companyName.trim(),
        confirmSlug: confirmSlug.trim(),
      })
      return res.json()
    },
    onSuccess: (resp: { slug: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] })
      toast({ title: "Persona created", description: `Tenant schema tenant_${resp.slug} provisioned. Brand voice will be derived from your Haylo essay next.` })
      onCreated(resp.slug)
    },
    onError: (err: Error) => {
      toast({ title: "Could not create persona", description: err.message, variant: "destructive" })
    },
  })

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div>
          <h3 className="font-semibold">Identity</h3>
          <p className="text-xs text-muted-foreground">
            Just the basics. Brand voice (tagline, vertical, CTA) is derived from your Haylo essay in the next step — no hand-typing required.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="slug">Slug <span className="text-destructive">*</span></Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="acme-equity"
              data-testid="input-slug"
            />
            <p className="text-xs text-muted-foreground">
              Becomes <code>tenant_{slugClean || "…"}</code> and the article URL prefix. <strong>Cannot be renamed.</strong>
            </p>
            {slug.length > 0 && !slugLooksValid && (
              <p className="text-xs text-destructive">Must start with a letter; 2–63 chars; a-z, 0-9, _ only.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="personaDisplayName">Persona display name <span className="text-destructive">*</span></Label>
            <Input
              id="personaDisplayName"
              value={personaDisplayName}
              onChange={(e) => setPersonaDisplayName(e.target.value)}
              placeholder="Acme Equity"
              data-testid="input-persona-display-name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="publisherName">Publisher name <span className="text-destructive">*</span></Label>
            <Input
              id="publisherName"
              value={publisherName}
              onChange={(e) => setPublisherName(e.target.value)}
              placeholder="Acme Equity"
              data-testid="input-publisher-name"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="authorName">Author name <span className="text-destructive">*</span></Label>
            <Input
              id="authorName"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Acme Equity Newsroom"
              data-testid="input-author-name"
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label htmlFor="companyName">Legal company name <span className="text-destructive">*</span></Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Equity Holdings, Inc."
              data-testid="input-company-name"
            />
          </div>
        </div>
      </Card>

      <Card className="space-y-3 border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
        <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
          <Lock className="h-4 w-4" /> One-way door — re-type the slug, then create
        </div>
        <p className="text-sm text-amber-900 dark:text-amber-200">
          Creating provisions <code>tenant_{slugClean || "…"}</code> on the database. The slug becomes part of every article URL and cannot be renamed.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            placeholder={slugLooksValid ? `Type "${slugClean}" to confirm` : "Enter a valid slug above first"}
            data-testid="input-confirm-slug"
            disabled={!slugLooksValid}
            className="sm:max-w-xs"
          />
          <Button
            disabled={!canCreate || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            data-testid="button-create-persona"
          >
            {createMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
            ) : (
              <>Create persona <ArrowRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}

// ============================================================================
// STEP 2 — Haylo seed + LLM-derived brand voice
// ============================================================================

function StepHayloAndBrand({
  slug,
  readiness,
  refetchReadiness,
  onAdvance,
}: {
  slug: string
  readiness?: Readiness
  refetchReadiness: () => void
  onAdvance: () => void
}) {
  const { toast } = useToast()

  // Haylo input
  const [hayloTitle, setHayloTitle] = useState("")
  const [hayloTopic, setHayloTopic] = useState("")
  const [hayloBody, setHayloBody] = useState("")
  const [hayloSummary, setHayloSummary] = useState("")

  // Derived brand (editable)
  const [brand, setBrand] = useState({
    personaDisplayName: "",
    publisherName: "",
    authorName: "",
    brandVertical: "",
    brandTagline: "",
    brandFeatureCta: "",
  })
  const [confidence, setConfidence] = useState<number | null>(null)
  const [rationale, setRationale] = useState<string>("")
  const [model, setModel] = useState<string>("")

  // When tenant readiness loads, prefill the editable brand form so the
  // staffer can resume mid-flow without losing previously-derived values.
  useEffect(() => {
    if (!readiness) return
    setBrand((b) => ({
      personaDisplayName: b.personaDisplayName || readiness.tenant.personaDisplayName || "",
      publisherName: b.publisherName || readiness.tenant.publisherName || "",
      authorName: b.authorName || readiness.tenant.authorName || "",
      brandVertical: b.brandVertical || stripPlaceholder(readiness.tenant.brandVertical) || "",
      brandTagline: b.brandTagline || stripPlaceholder(readiness.tenant.brandTagline) || "",
      brandFeatureCta: b.brandFeatureCta || stripPlaceholder(readiness.tenant.brandFeatureCta) || "",
    }))
  }, [readiness])

  const canDerive = hayloTitle.trim().length >= 5 && hayloBody.trim().length >= 100

  const deriveMutation = useMutation({
    mutationFn: async (): Promise<DerivedBrand> => {
      const res = await apiRequest("POST", "/api/admin/personas/derive-brand", {
        hayloTitle: hayloTitle.trim(),
        hayloBodyHtml: hayloBody,
        currentTenant: {
          personaDisplayName: readiness?.tenant.personaDisplayName,
          publisherName: readiness?.tenant.publisherName,
          authorName: readiness?.tenant.authorName,
          companyName: readiness?.tenant.companyName ?? undefined,
        },
      })
      return res.json()
    },
    onSuccess: (d) => {
      setBrand({
        personaDisplayName: d.personaDisplayName,
        publisherName: d.publisherName,
        authorName: d.authorName,
        brandVertical: d.brandVertical,
        brandTagline: d.brandTagline,
        brandFeatureCta: d.brandFeatureCta,
      })
      setConfidence(d.confidence)
      setRationale(d.rationale)
      setModel(d.model)
      toast({
        title: "Brand voice derived",
        description: `Confidence ${(d.confidence * 100).toFixed(0)}% · ${d.tokensUsed} tokens · ${d.model}`,
      })
    },
    onError: (err: Error) => {
      toast({ title: "Derive failed", description: err.message, variant: "destructive" })
    },
  })

  const brandFilled =
    brand.brandVertical.trim().length >= 4 &&
    brand.brandTagline.trim().length >= 20 &&
    brand.brandFeatureCta.trim().length >= 4

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      // Save brand first (PATCH tenant), then haylo essay (cross-tenant POST).
      // Order matters: if essay POST fails we still keep the brand changes.
      await apiRequest("PATCH", `/api/admin/tenants/${slug}`, {
        personaDisplayName: brand.personaDisplayName.trim() || undefined,
        publisherName: brand.publisherName.trim() || undefined,
        authorName: brand.authorName.trim() || undefined,
        brandVertical: brand.brandVertical.trim(),
        brandTagline: brand.brandTagline.trim(),
        brandFeatureCta: brand.brandFeatureCta.trim(),
      })

      await apiRequest("POST", `/api/admin/personas/${slug}/haylo`, {
        title: hayloTitle.trim(),
        topicSlug: hayloTopic.trim() || undefined,
        bodyHtml: hayloBody,
        summary: hayloSummary.trim() || undefined,
      })
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Brand voice + Haylo essay locked to this persona." })
      refetchReadiness()
      onAdvance()
    },
    onError: (err: Error) => {
      toast({ title: "Save failed", description: err.message, variant: "destructive" })
    },
  })

  // Live SEO preview, regenerated whenever the editable brand changes.
  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/personas/preview-meta", {
        personaDisplayName: brand.personaDisplayName || "Persona",
        brandTagline: brand.brandTagline || "your tagline appears here",
        brandFeatureCta: brand.brandFeatureCta || "your CTA appears here",
      })
      return res.json()
    },
  })
  useEffect(() => {
    const t = setTimeout(() => previewMutation.mutate(), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand.personaDisplayName, brand.brandTagline, brand.brandFeatureCta])

  const wordCount = useMemo(
    () => hayloBody.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length,
    [hayloBody],
  )

  const canSaveAll =
    hayloTitle.trim().length >= 3 &&
    hayloBody.trim().length >= 50 &&
    brandFilled

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card className="space-y-3 p-5">
          <div>
            <h3 className="font-semibold">Paste a Haylo essay (the brand seed)</h3>
            <p className="text-xs text-muted-foreground">
              Title + body. The model reads this to derive vertical, tagline, and feature CTA. Best results with H1 + 5 well-formed answer blocks (300+ words total).
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="hayloTitle">Title (H1) <span className="text-destructive">*</span></Label>
              <Input
                id="hayloTitle"
                value={hayloTitle}
                onChange={(e) => setHayloTitle(e.target.value)}
                placeholder="Why local cap-table activity matters in 2026"
                data-testid="input-haylo-title"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hayloTopic">Topic slug (optional)</Label>
              <Input
                id="hayloTopic"
                value={hayloTopic}
                onChange={(e) => setHayloTopic(e.target.value)}
                placeholder="cap-tables"
                data-testid="input-haylo-topic"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hayloSummary">Summary (optional)</Label>
              <Input
                id="hayloSummary"
                value={hayloSummary}
                onChange={(e) => setHayloSummary(e.target.value)}
                placeholder="One-line summary"
                data-testid="input-haylo-summary"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="hayloBody">Body HTML <span className="text-destructive">*</span></Label>
              <Textarea
                id="hayloBody"
                value={hayloBody}
                onChange={(e) => setHayloBody(e.target.value)}
                placeholder="<h1>…</h1><h2>Question 1</h2><p>Answer…</p> …"
                rows={10}
                className="font-mono text-xs"
                data-testid="input-haylo-body"
              />
              <p className="text-xs text-muted-foreground">{wordCount} words</p>
            </div>
          </div>
          <Button
            onClick={() => deriveMutation.mutate()}
            disabled={!canDerive || deriveMutation.isPending}
            variant="default"
            data-testid="button-derive-brand"
          >
            {deriveMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading your Haylo essay…</>
            ) : (
              <><Sparkles className="mr-2 h-4 w-4" /> Derive brand voice from this essay</>
            )}
          </Button>
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Brand voice {confidence !== null ? "(derived — review and edit)" : "(empty — derive first)"}</h3>
            {confidence !== null && (
              <Badge variant={confidence >= 0.6 ? "outline" : "secondary"}>
                {(confidence * 100).toFixed(0)}% confidence
              </Badge>
            )}
          </div>
          {confidence !== null && confidence < 0.6 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Low-confidence derive</AlertTitle>
              <AlertDescription>
                The essay was thin. Consider adding more body content (more answer blocks) and re-deriving.
              </AlertDescription>
            </Alert>
          )}
          {rationale && (
            <p className="rounded-md border bg-muted/40 p-2 text-xs italic text-muted-foreground">
              {rationale} <span className="not-italic">(via {model})</span>
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="brandPersona">Persona display name</Label>
              <Input id="brandPersona" value={brand.personaDisplayName} onChange={(e) => setBrand({ ...brand, personaDisplayName: e.target.value })} data-testid="input-brand-persona" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="brandPublisher">Publisher name</Label>
              <Input id="brandPublisher" value={brand.publisherName} onChange={(e) => setBrand({ ...brand, publisherName: e.target.value })} data-testid="input-brand-publisher" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="brandAuthor">Author name</Label>
              <Input id="brandAuthor" value={brand.authorName} onChange={(e) => setBrand({ ...brand, authorName: e.target.value })} data-testid="input-brand-author" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="brandVertical">Brand vertical <span className="text-destructive">*</span></Label>
              <Input id="brandVertical" value={brand.brandVertical} onChange={(e) => setBrand({ ...brand, brandVertical: e.target.value })} placeholder="Cap-table & equity guidance" data-testid="input-brand-vertical" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="brandFeatureCta">Feature CTA <span className="text-destructive">*</span></Label>
              <Input id="brandFeatureCta" value={brand.brandFeatureCta} onChange={(e) => setBrand({ ...brand, brandFeatureCta: e.target.value })} placeholder="Cap-table guidance" data-testid="input-brand-feature-cta" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="brandTagline">Tagline <span className="text-destructive">*</span></Label>
              <Textarea id="brandTagline" value={brand.brandTagline} onChange={(e) => setBrand({ ...brand, brandTagline: e.target.value })} rows={2} placeholder="Cap table, equity, and 409A guidance for emerging companies." data-testid="input-brand-tagline" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            You can fine-tune brand voice later from the persona's settings without re-running the wizard.
          </p>
        </Card>

        <Button
          onClick={() => saveAllMutation.mutate()}
          disabled={!canSaveAll || saveAllMutation.isPending}
          data-testid="button-save-haylo-and-brand"
        >
          {saveAllMutation.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <>Save brand + Haylo essay <ArrowRight className="ml-2 h-4 w-4" /></>
          )}
        </Button>
      </div>

      <div className="space-y-3">
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Haylo source</h4>
            <Badge variant="outline" className="text-xs">{wordCount} words</Badge>
          </div>
          {hayloTitle ? (
            <>
              <div className="text-sm font-medium" data-testid="text-haylo-source-title">{hayloTitle}</div>
              <div className="line-clamp-4 text-xs text-muted-foreground">
                {hayloBody.replace(/<[^>]+>/g, " ").slice(0, 240) || "Body will appear here as you paste."}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground italic">
              Paste an essay on the left. The model will read it to derive your brand voice.
            </div>
          )}
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Live SEO preview</h4>
            <Badge variant="outline" className="text-xs">Austin, TX · sample</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            What Google will see for a sample article using your derived brand.
          </p>
          <div className="rounded-md border bg-background p-3 text-sm">
            <div className="line-clamp-2 font-medium text-blue-700 dark:text-blue-400" data-testid="text-preview-title">
              {previewMutation.data?.metaTitle || "Persona in Austin, TX: …"}
            </div>
            <div className="mt-1 text-xs text-green-700 dark:text-green-400">
              investorensights.com › discovery › knowledge › {slug}-austin-tx-…
            </div>
            <div className="mt-1 line-clamp-3 text-xs text-muted-foreground" data-testid="text-preview-description">
              {previewMutation.data?.metaDescription || "Persona in Austin, TX: your tagline appears here…"}
            </div>
          </div>
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span>Title: {previewMutation.data?.metaTitleLength ?? 0}/90</span>
            <span>Desc: {previewMutation.data?.metaDescriptionLength ?? 0}/300</span>
          </div>
        </Card>
      </div>
    </div>
  )
}

function stripPlaceholder(s: string | null | undefined): string {
  if (!s) return ""
  if (s === "(pending Haylo derive)") return ""
  return s
}

// ============================================================================
// STEP 3 — Cities (CSV upload + template download)
// ============================================================================

const CSV_TEMPLATE = `cityName,stateCode,stateName,streetAddress,zipCode,phoneNumber,email,latitude,longitude
Austin,TX,Texas,,,,,,
Denver,CO,Colorado,,,,,,
`

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length < 2) return []
  const header = lines[0].split(",").map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim())
    const obj: Record<string, string> = {}
    header.forEach((h, i) => (obj[h] = cells[i] ?? ""))
    return obj
  })
}

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "persona-cities-template.csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function StepCities({ slug, readiness, refetchReadiness }: { slug: string; readiness?: Readiness; refetchReadiness: () => void }) {
  const { toast } = useToast()
  const [csvText, setCsvText] = useState("")

  const upload = useMutation({
    mutationFn: async () => {
      const rows = parseCSV(csvText)
      if (rows.length === 0) throw new Error("CSV had no data rows. Need a header line + at least one row.")
      const res = await apiRequest("POST", `/api/admin/personas/${slug}/cities/bulk-csv`, { rows })
      return res.json()
    },
    onSuccess: (r: any) => {
      const partial = (r.skipped ?? 0) > 0 || (r.errors?.length ?? 0) > 0
      toast({
        title: partial ? `Uploaded with issues` : `Uploaded`,
        description: `Created ${r.created}, skipped ${r.skipped}, geocoded ${r.geocoded}.${r.errors?.length ? ` First error: ${r.errors[0]}` : ""}`,
        variant: partial ? "destructive" : "default",
      })
      setCsvText("")
      refetchReadiness()
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" })
    },
  })

  const onFile = (f: File | null) => {
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => setCsvText(reader.result?.toString() ?? "")
    reader.readAsText(f)
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">City Batch upload</h3>
            <p className="text-sm text-muted-foreground">
              Required header: <code>cityName,stateCode</code>. Missing coordinates auto-geocode.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
            <Download className="mr-2 h-4 w-4" /> Template
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            data-testid="input-cities-csv"
            className="max-w-xs"
          />
          <span className="text-xs text-muted-foreground">or paste below</span>
        </div>
        <Textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"cityName,stateCode\nAustin,TX\nDenver,CO"}
          rows={6}
          className="font-mono text-xs"
          data-testid="input-cities-csv-text"
        />
        <Button
          onClick={() => upload.mutate()}
          disabled={!csvText.trim() || upload.isPending}
          data-testid="button-upload-cities"
        >
          {upload.isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
          ) : (
            <><Upload className="mr-2 h-4 w-4" /> Upload to tenant_{slug}</>
          )}
        </Button>
      </Card>

      <Card className="space-y-2 p-5">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Tenant readiness</h4>
          <Badge variant="outline">{readiness?.cities.total ?? 0} cities</Badge>
        </div>
        {readiness && readiness.cities.total > 0 && !readiness.cities.groundingGateOpen && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Auto-scheduler not yet armed</AlertTitle>
            <AlertDescription>
              Cities exist but none have an enabled research source. The wizard can finish, but the auto-scheduler will not pick this persona until each city gets at least one enabled <code>city_research_sources</code> entry. Add them per-city after switching into <code>{slug}</code>.
            </AlertDescription>
          </Alert>
        )}
      </Card>
    </div>
  )
}

// ============================================================================
// STEP 4 — Finish
// ============================================================================

function StepFinish({ slug, readiness, onFinish }: { slug: string; readiness?: Readiness; onFinish: () => void }) {
  const allDone = !!readiness?.publishReady
  return (
    <Card className="space-y-4 p-5">
      <h3 className="font-semibold">Ready to publish</h3>
      <div className="grid gap-2 text-sm">
        <SummaryRow label="Persona" value={readiness?.tenant.personaDisplayName ?? slug} />
        <SummaryRow label="Brand vertical" value={stripPlaceholder(readiness?.tenant.brandVertical) || "—"} />
        <SummaryRow label="Tagline" value={stripPlaceholder(readiness?.tenant.brandTagline) || "—"} />
        <SummaryRow label="Feature CTA" value={stripPlaceholder(readiness?.tenant.brandFeatureCta) || "—"} />
        <SummaryRow label="Cities" value={`${readiness?.cities.total ?? 0}${readiness?.cities.groundingGateOpen ? "" : " (no research sources yet)"}`} />
        <SummaryRow label="Haylo essays" value={`${readiness?.haylo.total ?? 0}`} />
      </div>
      {!allDone && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Not ready yet</AlertTitle>
          <AlertDescription>
            Brand voice, ≥1 city, and ≥1 Haylo essay are all required.
          </AlertDescription>
        </Alert>
      )}
      <Button onClick={onFinish} disabled={!allDone} data-testid="button-finish-wizard">
        Finish
      </Button>
    </Card>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b pb-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

// ============================================================================
// Wizard shell
// ============================================================================

function StepIndicator({ step, label, active, complete }: { step: number; label: string; active: boolean; complete: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${active ? "font-semibold" : ""}`}>
      {complete ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />}
      <span className="text-sm">Step {step}: {label}</span>
    </div>
  )
}

export default function PersonaWizardPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()

  const slugFromUrl = params.get("slug")
  const stepFromUrl = (Math.min(4, Math.max(1, Number(params.get("step")) || 1))) as WizardStep

  const [activeSlug, setActiveSlug] = useState<string | null>(slugFromUrl)
  const [step, setStep] = useState<WizardStep>(stepFromUrl)

  useEffect(() => {
    setActiveSlug(slugFromUrl)
  }, [slugFromUrl])

  const { data: me } = useQuery<MeResponse>({ queryKey: ["/api/admin/me"] })

  const readinessQuery = useQuery<Readiness>({
    queryKey: ["/api/admin/personas", activeSlug, "readiness"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/personas/${activeSlug}/readiness`, { credentials: "include" })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to load readiness")
      return res.json()
    },
    enabled: !!activeSlug,
    refetchInterval: 5000,
  })

  if (me && !me.isConductor) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card className="p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Conductor only</h1>
          <p className="mt-2 text-muted-foreground">Sign in as a Conductor staff account to use the Persona Wizard.</p>
        </Card>
      </div>
    )
  }

  const r = readinessQuery.data
  const step1Done = !!activeSlug
  const step2Done = !!r?.brand.complete && (r?.haylo.total ?? 0) >= 1
  const step3Done = (r?.cities.total ?? 0) >= 1
  const allDone = !!r?.publishReady

  const goto = (s: WizardStep) => {
    setStep(s)
    if (activeSlug) router.replace(`/admin/personas/new?slug=${encodeURIComponent(activeSlug)}&step=${s}`)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-wizard-title">New Persona</h1>
          <p className="text-sm text-muted-foreground">
            Four steps. Brand voice is derived from your Haylo essay — no hand-typing the tagline. Quit anytime; resume from the list.
          </p>
        </div>
        <Link href="/admin/personas">
          <Button variant="ghost" size="sm">Back to list</Button>
        </Link>
      </div>

      <Card className="grid gap-3 p-4 md:grid-cols-4">
        <StepIndicator step={1} label="Identity" active={step === 1} complete={step1Done} />
        <StepIndicator step={2} label="Haylo + Brand" active={step === 2} complete={step2Done} />
        <StepIndicator step={3} label="Cities" active={step === 3} complete={step3Done} />
        <StepIndicator step={4} label="Finish" active={step === 4} complete={allDone} />
      </Card>

      {activeSlug && (
        <Card className="flex items-center justify-between bg-muted/30 p-3 text-sm">
          <span>
            Working on persona: <strong>{r?.tenant.personaDisplayName ?? activeSlug}</strong>{" "}
            <Badge variant="outline" className="ml-2 font-mono text-xs">{activeSlug}</Badge>
          </span>
          <span className="text-xs text-muted-foreground">Schema: <code>tenant_{activeSlug}</code></span>
        </Card>
      )}

      {step === 1 && !activeSlug && (
        <StepIdentity
          onCreated={(s) => {
            setActiveSlug(s)
            goto(2)
          }}
        />
      )}

      {step === 1 && activeSlug && (
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle>Step 1 complete</AlertTitle>
          <AlertDescription>
            Persona <strong>{activeSlug}</strong> exists. Continue to derive brand voice from a Haylo essay.
            <div className="mt-3"><Button size="sm" onClick={() => goto(2)} data-testid="button-goto-step-2">Continue to Haylo + Brand <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
          </AlertDescription>
        </Alert>
      )}

      {step === 2 && activeSlug && (
        <>
          <StepHayloAndBrand
            slug={activeSlug}
            readiness={r}
            refetchReadiness={() => readinessQuery.refetch()}
            onAdvance={() => goto(3)}
          />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => goto(1)}>Back</Button>
            <Button onClick={() => goto(3)} disabled={!step2Done} data-testid="button-goto-step-3">
              Skip to Cities <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {step === 3 && activeSlug && (
        <>
          <StepCities slug={activeSlug} readiness={r} refetchReadiness={() => readinessQuery.refetch()} />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => goto(2)}>Back</Button>
            <Button onClick={() => goto(4)} disabled={!step3Done} data-testid="button-goto-step-4">
              Continue to Finish <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {step === 4 && activeSlug && (
        <>
          <StepFinish
            slug={activeSlug}
            readiness={r}
            onFinish={() => {
              toast({ title: "Persona ready", description: `${activeSlug} has brand, cities, and Haylo essays.` })
              router.push("/admin/personas")
            }}
          />
          <div className="flex justify-start">
            <Button variant="ghost" onClick={() => goto(3)}>Back</Button>
          </div>
        </>
      )}

      {step !== 1 && !activeSlug && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No persona selected</AlertTitle>
          <AlertDescription>
            Start at Step 1 to create the persona before continuing.
            <div className="mt-3"><Button size="sm" onClick={() => goto(1)}>Go to Step 1</Button></div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

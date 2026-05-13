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
import { Checkbox } from "@/components/ui/checkbox"
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
  ShieldAlert,
} from "lucide-react"

type WizardStep = 1 | 2 | 3

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

// --- Step 1 -----------------------------------------------------------------

function StepBrand({ onCreated }: { onCreated: (slug: string) => void }) {
  const { toast } = useToast()
  const [slug, setSlug] = useState("")
  const [confirmSlug, setConfirmSlug] = useState("")
  const [personaDisplayName, setPersonaDisplayName] = useState("")
  const [publisherName, setPublisherName] = useState("")
  const [authorName, setAuthorName] = useState("")
  const [companyName, setCompanyName] = useState("")
  const [brandVertical, setBrandVertical] = useState("")
  const [brandTagline, setBrandTagline] = useState("")
  const [brandFeatureCta, setBrandFeatureCta] = useState("")
  const [brandHomeUrl, setBrandHomeUrl] = useState("")
  const [autoLockMeta, setAutoLockMeta] = useState(true)

  // Live meta preview (Tier-2 builder via server to share exact code path).
  const previewBody = useMemo(
    () => ({
      personaDisplayName: personaDisplayName || "Persona",
      brandTagline: brandTagline || "your tagline appears here",
      brandFeatureCta: brandFeatureCta || "your CTA appears here",
    }),
    [personaDisplayName, brandTagline, brandFeatureCta],
  )

  const previewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/personas/preview-meta", previewBody)
      return res.json()
    },
  })

  useEffect(() => {
    const t = setTimeout(() => previewMutation.mutate(), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personaDisplayName, brandTagline, brandFeatureCta])

  const slugClean = slug.trim().toLowerCase()
  const slugLooksValid = /^[a-z][a-z0-9_]{1,62}$/.test(slugClean)
  const allFieldsFilled =
    slugLooksValid &&
    personaDisplayName.trim().length > 0 &&
    publisherName.trim().length > 0 &&
    authorName.trim().length > 0 &&
    companyName.trim().length > 0 &&
    brandVertical.trim().length >= 2 &&
    brandTagline.trim().length >= 2 &&
    brandFeatureCta.trim().length >= 2
  const slugConfirmed = confirmSlug.trim() === slugClean && slugClean.length > 0
  const canCreate = allFieldsFilled && slugConfirmed

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/personas", {
        slug: slugClean,
        personaDisplayName: personaDisplayName.trim(),
        publisherName: publisherName.trim(),
        authorName: authorName.trim(),
        companyName: companyName.trim(),
        brandVertical: brandVertical.trim(),
        brandTagline: brandTagline.trim(),
        brandFeatureCta: brandFeatureCta.trim(),
        brandHomeUrl: brandHomeUrl.trim() || null,
        confirmSlug: confirmSlug.trim(),
      })
      return res.json()
    },
    onSuccess: (resp: { slug: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] })
      toast({ title: "Persona created", description: `Tenant schema tenant_${resp.slug} provisioned.` })
      onCreated(resp.slug)
    },
    onError: (err: Error) => {
      toast({ title: "Could not create persona", description: err.message, variant: "destructive" })
    },
  })

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        <Card className="space-y-4 p-5">
          <h3 className="font-semibold">Identity</h3>
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
                Lowercase letters, numbers, underscores. Becomes the schema name (<code>tenant_{slugClean || "…"}</code>) and the article URL prefix. <strong>Cannot be changed.</strong>
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

        <Card className="space-y-4 p-5">
          <h3 className="font-semibold">Brand voice</h3>
          <p className="text-xs text-muted-foreground">
            These fields parameterize SEO meta titles, descriptions, and the Tier-2 fallback for every published article. Required for on-brand output.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="brandVertical">Brand vertical <span className="text-destructive">*</span></Label>
              <Input
                id="brandVertical"
                value={brandVertical}
                onChange={(e) => setBrandVertical(e.target.value)}
                placeholder="Cap-table & equity guidance"
                data-testid="input-brand-vertical"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="brandFeatureCta">Feature CTA <span className="text-destructive">*</span></Label>
              <Input
                id="brandFeatureCta"
                value={brandFeatureCta}
                onChange={(e) => setBrandFeatureCta(e.target.value)}
                placeholder="Cap-table guidance"
                data-testid="input-brand-feature-cta"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="brandTagline">Tagline <span className="text-destructive">*</span></Label>
              <Textarea
                id="brandTagline"
                value={brandTagline}
                onChange={(e) => setBrandTagline(e.target.value)}
                placeholder="Cap table, equity, and 409A guidance"
                rows={2}
                data-testid="input-brand-tagline"
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="brandHomeUrl">Brand home URL (optional)</Label>
              <Input
                id="brandHomeUrl"
                value={brandHomeUrl}
                onChange={(e) => setBrandHomeUrl(e.target.value)}
                placeholder="https://www.acmeequity.com/locations/{city}"
                data-testid="input-brand-home-url"
              />
              <p className="text-xs text-muted-foreground">
                Optional. Used when the brand name appears in body copy. <code>{"{city}"}</code> gets replaced with the city slug.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-3">
            <Checkbox id="autoLock" checked={autoLockMeta} disabled aria-disabled="true" />
            <div className="space-y-0.5">
              <Label htmlFor="autoLock" className="cursor-not-allowed opacity-70">
                Auto-lock SEO meta on publish
              </Label>
              <p className="text-xs text-muted-foreground">
                Newly published articles will have their meta_locked_at stamped automatically. Wired up in the next gate (MT-4.14); always-on by default.
              </p>
            </div>
          </div>
        </Card>

        <Card className="space-y-3 border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
            <Lock className="h-4 w-4" /> One-way door
          </div>
          <p className="text-sm text-amber-900 dark:text-amber-200">
            Creating the persona provisions <code>tenant_{slugClean || "…"}</code> on the database. The slug becomes part of every article URL and cannot be renamed. Re-type the slug to confirm.
          </p>
          <Input
            value={confirmSlug}
            onChange={(e) => setConfirmSlug(e.target.value)}
            placeholder={`Type "${slugClean || "your-slug"}" to confirm`}
            data-testid="input-confirm-slug"
            disabled={!slugLooksValid}
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
        </Card>
      </div>

      <div className="space-y-3">
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Live SEO preview</h4>
            <Badge variant="outline" className="text-xs">Austin, TX · sample</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            What Google will see for a sample article. Updates as you type.
          </p>
          <div className="rounded-md border bg-background p-3 text-sm">
            <div className="line-clamp-2 font-medium text-blue-700 dark:text-blue-400" data-testid="text-preview-title">
              {previewMutation.data?.metaTitle || "Persona in Austin, TX: …"}
            </div>
            <div className="mt-1 text-xs text-green-700 dark:text-green-400">
              investorensights.com › discovery › knowledge › {slugClean || "…"}-austin-tx-…
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

// --- Step 2 (Cities) --------------------------------------------------------

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
      toast({
        title: `Uploaded`,
        description: `Created ${r.created}, skipped ${r.skipped}, geocoded ${r.geocoded}.`,
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
        <h3 className="font-semibold">City Batch upload</h3>
        <p className="text-sm text-muted-foreground">
          Required header: <code>cityName,stateCode</code>. Optional: <code>stateName,streetAddress,zipCode,phoneNumber,email,latitude,longitude</code>. Missing coordinates are geocoded automatically.
        </p>
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
          placeholder="cityName,stateCode\nAustin,TX\nDenver,CO"
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
              Cities exist but none have an enabled research source. The Wizard can finish, but the auto-scheduler will not pick this persona until each city gets at least one enabled <code>city_research_sources</code> entry. Add them per-city after switching into <code>{slug}</code>.
            </AlertDescription>
          </Alert>
        )}
      </Card>
    </div>
  )
}

// --- Step 3 (Haylo) --------------------------------------------------------

function StepHaylo({ slug, refetchReadiness }: { slug: string; refetchReadiness: () => void }) {
  const { toast } = useToast()
  const [title, setTitle] = useState("")
  const [topicSlug, setTopicSlug] = useState("")
  const [bodyHtml, setBodyHtml] = useState("")
  const [summary, setSummary] = useState("")

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/personas/${slug}/haylo`, {
        title: title.trim(),
        topicSlug: topicSlug.trim() || undefined,
        bodyHtml,
        summary: summary.trim() || undefined,
      })
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "Haylo article created" })
      setTitle("")
      setTopicSlug("")
      setBodyHtml("")
      setSummary("")
      refetchReadiness()
    },
    onError: (err: Error) => {
      toast({ title: "Could not create", description: err.message, variant: "destructive" })
    },
  })

  return (
    <Card className="space-y-3 p-5">
      <h3 className="font-semibold">Add a starter Haylo essay</h3>
      <p className="text-sm text-muted-foreground">
        Minimum one essay so the Newsroom pair generator has something to pair against. Full library tools (scan inbox, Halo Lab pull, duplicates) are available after switching into <code>{slug}</code>.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="hayloTitle">Title <span className="text-destructive">*</span></Label>
          <Input
            id="hayloTitle"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Why local equity activity matters"
            data-testid="input-haylo-title"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hayloTopic">Topic slug (optional)</Label>
          <Input
            id="hayloTopic"
            value={topicSlug}
            onChange={(e) => setTopicSlug(e.target.value)}
            placeholder="cap-tables"
            data-testid="input-haylo-topic"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="hayloSummary">Summary (optional)</Label>
          <Input
            id="hayloSummary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One-sentence summary"
            data-testid="input-haylo-summary"
          />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="hayloBody">Body HTML <span className="text-destructive">*</span></Label>
          <Textarea
            id="hayloBody"
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            placeholder="<p>Paste essay HTML here…</p>"
            rows={10}
            className="font-mono text-xs"
            data-testid="input-haylo-body"
          />
        </div>
      </div>
      <Button
        onClick={() => create.mutate()}
        disabled={create.isPending || title.trim().length < 3 || bodyHtml.trim().length < 10}
        data-testid="button-create-haylo"
      >
        {create.isPending ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
        ) : (
          <>Add essay</>
        )}
      </Button>
    </Card>
  )
}

// --- Wizard shell -----------------------------------------------------------

function StepIndicator({ step, active, label, complete }: { step: number; active: boolean; label: string; complete: boolean }) {
  return (
    <div className={`flex items-center gap-2 ${active ? "font-semibold" : ""}`}>
      {complete ? (
        <CheckCircle2 className="h-5 w-5 text-green-600" />
      ) : (
        <Circle className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
      )}
      <span className="text-sm">Step {step}: {label}</span>
    </div>
  )
}

export default function PersonaWizardPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { toast } = useToast()

  const slugFromUrl = params.get("slug")
  const stepFromUrl = (Number(params.get("step")) || 1) as WizardStep

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
          <p className="mt-2 text-muted-foreground">
            Sign in as a Conductor staff account to use the Persona Wizard.
          </p>
        </Card>
      </div>
    )
  }

  const r = readinessQuery.data
  const step1Done = !!r?.brand.complete
  const step2Done = (r?.cities.total ?? 0) >= 1
  const step3Done = (r?.haylo.total ?? 0) >= 1
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
            Three steps. Each one writes immediately, so you can quit and resume anytime.
          </p>
        </div>
        <Link href="/admin/personas">
          <Button variant="ghost" size="sm">Back to list</Button>
        </Link>
      </div>

      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <StepIndicator step={1} label="Identity & brand" active={step === 1} complete={step1Done} />
        <StepIndicator step={2} label="City Batch" active={step === 2} complete={step2Done} />
        <StepIndicator step={3} label="Haylo essays" active={step === 3} complete={step3Done} />
      </Card>

      {activeSlug && (
        <Card className="flex items-center justify-between bg-muted/30 p-3 text-sm">
          <span>
            Working on persona: <strong>{r?.tenant.personaDisplayName ?? activeSlug}</strong>{" "}
            <Badge variant="outline" className="ml-2 font-mono text-xs">{activeSlug}</Badge>
          </span>
          <span className="text-xs text-muted-foreground">
            Schema: <code>tenant_{activeSlug}</code>
          </span>
        </Card>
      )}

      {step === 1 && !activeSlug && (
        <StepBrand
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
            Persona <strong>{activeSlug}</strong> is created. Brand fields can be edited from the persona's Settings page after Wizard completion.
            <div className="mt-3"><Button size="sm" onClick={() => goto(2)} data-testid="button-goto-step-2">Continue to City Batch <ArrowRight className="ml-2 h-4 w-4" /></Button></div>
          </AlertDescription>
        </Alert>
      )}

      {step === 2 && activeSlug && (
        <>
          <StepCities slug={activeSlug} readiness={r} refetchReadiness={() => readinessQuery.refetch()} />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => goto(1)}>Back</Button>
            <Button onClick={() => goto(3)} disabled={!step2Done} data-testid="button-goto-step-3">
              Continue to Haylo <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {step === 3 && activeSlug && (
        <>
          <StepHaylo slug={activeSlug} refetchReadiness={() => readinessQuery.refetch()} />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => goto(2)}>Back</Button>
            <Button
              disabled={!allDone}
              onClick={() => {
                toast({ title: "Persona ready to publish", description: `${activeSlug} has brand, cities, and Haylo essays.` })
                router.push("/admin/personas")
              }}
              data-testid="button-finish-wizard"
            >
              Finish
            </Button>
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

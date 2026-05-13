"use client"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Users, ShieldAlert } from "lucide-react"

interface Persona {
  slug: string
  personaDisplayName: string
  publisherName: string
  authorName: string
  companyName: string | null
  brandVertical: string | null
  brandTagline: string | null
  brandFeatureCta: string | null
  createdAt: string
}

interface MeResponse {
  isConductor: boolean
}

export default function PersonasListPage() {
  const { data: me } = useQuery<MeResponse>({
    queryKey: ["/api/admin/me"],
  })

  const { data, isLoading, error } = useQuery<{ personas: Persona[] }>({
    queryKey: ["/api/admin/personas"],
    enabled: !!me?.isConductor,
  })

  if (me && !me.isConductor) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card className="p-8 text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">Conductor only</h1>
          <p className="mt-2 text-muted-foreground">
            Persona management is restricted to the Conductor tenant. Sign in
            as a Conductor staff account to add or review personas.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold" data-testid="text-personas-title">
            <Users className="h-6 w-6" /> Personas
          </h1>
          <p className="text-sm text-muted-foreground">
            Each persona is a publishing tenant. Adding one provisions a new
            isolated schema, brand voice, and city/Haylo workspace.
          </p>
        </div>
        <Link href="/admin/personas/new">
          <Button data-testid="button-add-persona">
            <Plus className="mr-2 h-4 w-4" /> Add Persona
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">
          Failed to load personas: {(error as Error).message}
        </Card>
      ) : (
        <div className="grid gap-3">
          {(data?.personas ?? []).map((p) => (
            <Card key={p.slug} className="flex items-center justify-between p-4" data-testid={`row-persona-${p.slug}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.personaDisplayName}</span>
                  <Badge variant="outline" className="font-mono text-xs">{p.slug}</Badge>
                  {(!p.brandVertical || !p.brandTagline || !p.brandFeatureCta) && (
                    <Badge variant="secondary">Brand fields incomplete</Badge>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {p.companyName ? `${p.companyName} · ` : ""}
                  Publisher: {p.publisherName} · Author: {p.authorName}
                </div>
                {p.brandTagline && (
                  <div className="mt-1 text-xs italic text-muted-foreground">
                    “{p.brandTagline}”
                  </div>
                )}
              </div>
              <Link href={`/admin/personas/new?slug=${encodeURIComponent(p.slug)}&step=2`}>
                <Button variant="outline" size="sm" data-testid={`link-resume-${p.slug}`}>
                  Resume setup
                </Button>
              </Link>
            </Card>
          ))}
          {(data?.personas ?? []).length === 0 && (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No personas yet. Click <strong>Add Persona</strong> to start the Wizard.
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

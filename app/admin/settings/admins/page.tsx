"use client"
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { ShieldCheck, Trash2, KeyRound, Plus, UserCircle, Building2, Pencil } from "lucide-react"

interface AdminRow {
  id: string
  username: string
  displayName: string | null
  createdAt: string
  tenantSlug: string | null
  tenantDisplayName: string | null
  tenantCompanyName: string | null
  tenantPublisherName: string | null
  tenantAuthorName: string | null
  tenantBrandHomeUrl: string | null
}

interface ListResponse {
  currentUsername: string
  currentTenantSlug: string
  admins: AdminRow[]
}

interface TenantRow {
  slug: string
  personaDisplayName: string
  publisherName: string
  authorName: string
}

const NEW_TENANT_SENTINEL = "__new__"

export default function AdminUsersPage() {
  const { toast } = useToast()
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newDisplay, setNewDisplay] = useState("")
  const [tenantChoice, setTenantChoice] = useState<string>("") // slug or NEW_TENANT_SENTINEL
  const [newTenantSlug, setNewTenantSlug] = useState("")
  const [newTenantDisplay, setNewTenantDisplay] = useState("")
  const [newTenantCompany, setNewTenantCompany] = useState("")
  const [newTenantPublisher, setNewTenantPublisher] = useState("Investor Ensights")
  const [newTenantAuthor, setNewTenantAuthor] = useState("Investor Ensights")
  const [newTenantBrandUrl, setNewTenantBrandUrl] = useState("")
  const [pwById, setPwById] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<AdminRow | null>(null)
  const [editDisplay, setEditDisplay] = useState("")
  const [editPersona, setEditPersona] = useState("")
  const [editCompany, setEditCompany] = useState("")
  const [editPublisher, setEditPublisher] = useState("")
  const [editAuthor, setEditAuthor] = useState("")
  const [editBrandUrl, setEditBrandUrl] = useState("")

  function openEdit(a: AdminRow) {
    setEditing(a)
    setEditDisplay(a.displayName ?? "")
    setEditPersona(a.tenantDisplayName ?? "")
    setEditCompany(a.tenantCompanyName ?? "")
    setEditPublisher(a.tenantPublisherName ?? "")
    setEditAuthor(a.tenantAuthorName ?? "")
    setEditBrandUrl(a.tenantBrandHomeUrl ?? "")
  }

  const { data, isLoading } = useQuery<ListResponse>({ queryKey: ["/api/admin/users"] })
  const { data: tenantsData } = useQuery<{ tenants: TenantRow[] }>({ queryKey: ["/api/admin/tenants"] })

  const tenants = tenantsData?.tenants ?? []
  const isNewTenant = tenantChoice === NEW_TENANT_SENTINEL

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        displayName: newDisplay.trim() || null,
      }
      if (isNewTenant) {
        payload.newTenant = {
          slug: newTenantSlug.trim().toLowerCase(),
          personaDisplayName: newTenantDisplay.trim(),
          companyName: newTenantCompany.trim(),
          publisherName: newTenantPublisher.trim(),
          authorName: newTenantAuthor.trim(),
          brandHomeUrl: newTenantBrandUrl.trim() || null,
        }
      } else {
        payload.tenantSlug = tenantChoice
      }
      return apiRequest("POST", "/api/admin/users", payload)
    },
    onSuccess: () => {
      toast({ title: "User created" })
      setNewEmail(""); setNewPassword(""); setNewDisplay("")
      setTenantChoice(""); setNewTenantSlug(""); setNewTenantDisplay(""); setNewTenantCompany(""); setNewTenantBrandUrl("")
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] })
    },
    onError: (e: any) => {
      toast({ title: "Could not create user", description: e?.message || "Try again", variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      toast({ title: "User removed" })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
    },
    onError: (e: any) => {
      toast({ title: "Could not delete", description: e?.message || "Try again", variant: "destructive" })
    },
  })

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("No user selected")
      const tenant: Record<string, string | null> = {}
      if (editing.tenantSlug) {
        tenant.personaDisplayName = editPersona.trim()
        tenant.companyName = editCompany.trim()
        tenant.publisherName = editPublisher.trim()
        tenant.authorName = editAuthor.trim()
        tenant.brandHomeUrl = editBrandUrl.trim() || null
      }
      const payload: any = { displayName: editDisplay.trim() || null }
      if (Object.keys(tenant).length > 0) payload.tenant = tenant
      return apiRequest("PATCH", `/api/admin/users/${editing.id}`, payload)
    },
    onSuccess: () => {
      toast({ title: "User updated" })
      setEditing(null)
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] })
    },
    onError: (e: any) => {
      toast({ title: "Could not update", description: e?.message || "Try again", variant: "destructive" })
    },
  })

  const passwordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, { password }),
    onSuccess: (_d, vars) => {
      toast({ title: "Password updated" })
      setPwById((p) => ({ ...p, [vars.id]: "" }))
    },
    onError: (e: any) => {
      toast({ title: "Could not update password", description: e?.message || "Try again", variant: "destructive" })
    },
  })

  const admins = data?.admins ?? []
  const currentUsername = data?.currentUsername

  const canSubmit = (() => {
    if (!newEmail.includes("@") || newPassword.length < 12) return false
    if (isNewTenant) {
      return /^[a-z][a-z0-9_]{0,62}$/.test(newTenantSlug.trim()) &&
        newTenantDisplay.trim().length > 0 && newTenantCompany.trim().length > 0 &&
        newTenantPublisher.trim().length > 0 && newTenantAuthor.trim().length > 0
    }
    return tenantChoice.length > 0
  })()

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Users & Tenants</h1>
          <p className="text-sm text-muted-foreground">
            Logged in as <span className="font-medium">{currentUsername || "…"}</span>
            {data?.currentTenantSlug && <> in tenant <span className="font-medium">{data.currentTenantSlug}</span></>}.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-4 w-4" /> Add a new user</CardTitle>
          <CardDescription>
            Each user belongs to exactly one tenant. Pick an existing tenant or create a new one — a new tenant
            provisions an empty schema (cities, articles, haylo, newsroom, audit log) automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email" type="email" value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="off" data-testid="input-new-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-display">Display name (optional)</Label>
              <Input
                id="new-display" value={newDisplay}
                onChange={(e) => setNewDisplay(e.target.value)}
                placeholder="Jane Doe"
                autoComplete="off" data-testid="input-new-display"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password</Label>
            <Input
              id="new-password" type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 12 characters"
              autoComplete="new-password" data-testid="input-new-password"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tenant-picker" className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Tenant
            </Label>
            <Select value={tenantChoice} onValueChange={setTenantChoice}>
              <SelectTrigger id="tenant-picker" data-testid="select-tenant">
                <SelectValue placeholder="Pick a tenant…" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.slug} value={t.slug} data-testid={`option-tenant-${t.slug}`}>
                    {t.personaDisplayName} ({t.slug})
                  </SelectItem>
                ))}
                <SelectItem value={NEW_TENANT_SENTINEL} data-testid="option-tenant-new">
                  + Create new tenant…
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isNewTenant && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="nt-slug">Tenant slug</Label>
                    <Input
                      id="nt-slug" value={newTenantSlug}
                      onChange={(e) => setNewTenantSlug(e.target.value)}
                      placeholder="persona2"
                      data-testid="input-new-tenant-slug"
                    />
                    <p className="text-xs text-muted-foreground">
                      lowercase, letters/numbers/underscores. Becomes the schema name and the article URL prefix.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nt-display">Display name</Label>
                    <Input
                      id="nt-display" value={newTenantDisplay}
                      onChange={(e) => setNewTenantDisplay(e.target.value)}
                      placeholder="Persona Two"
                      data-testid="input-new-tenant-display"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="nt-company">Company Name</Label>
                    <Input
                      id="nt-company" value={newTenantCompany}
                      onChange={(e) => setNewTenantCompany(e.target.value)}
                      placeholder="Persona Two Inc."
                      data-testid="input-new-tenant-company"
                    />
                    <p className="text-xs text-muted-foreground">
                      Legal/marketing brand name. Persists with the tenant; used for slug swaps and brand text in body copy.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nt-publisher">Publisher name</Label>
                    <Input
                      id="nt-publisher" value={newTenantPublisher}
                      onChange={(e) => setNewTenantPublisher(e.target.value)}
                      data-testid="input-new-tenant-publisher"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nt-author">Author name</Label>
                    <Input
                      id="nt-author" value={newTenantAuthor}
                      onChange={(e) => setNewTenantAuthor(e.target.value)}
                      data-testid="input-new-tenant-author"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="nt-brand-url">Brand link template (optional)</Label>
                    <Input
                      id="nt-brand-url" value={newTenantBrandUrl}
                      onChange={(e) => setNewTenantBrandUrl(e.target.value)}
                      placeholder="https://www.example.com/locations/{city}"
                      data-testid="input-new-tenant-brand-url"
                    />
                    <p className="text-xs text-muted-foreground">
                      First mention of the display name in any published article body links here. Use <code>{"{city}"}</code> as a placeholder for the article's city slug. Leave blank to keep brand mentions unlinked.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !canSubmit}
            data-testid="button-create-user"
          >
            {createMutation.isPending ? "Creating…" : "Create user"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing users</CardTitle>
          <CardDescription>
            You cannot delete the account you are logged in with, or the last remaining user.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : admins.length === 0 ? (
            <div className="text-sm text-muted-foreground">No users found.</div>
          ) : (
            <ul className="divide-y">
              {admins.map((a) => {
                const isSelf = a.username === currentUsername
                const isLast = admins.length <= 1
                const pw = pwById[a.id] ?? ""
                return (
                  <li key={a.id} className="py-4 space-y-3" data-testid={`row-user-${a.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <UserCircle className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="font-medium" data-testid={`text-user-email-${a.id}`}>
                            {a.username}
                            {isSelf && <span className="ml-2 text-xs text-primary">(you)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {a.displayName || "—"} · tenant{" "}
                            <span className="font-medium" data-testid={`text-user-tenant-${a.id}`}>
                              {a.tenantSlug || "(none)"}
                            </span>{" "}
                            · created {new Date(a.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline" size="sm"
                          onClick={() => openEdit(a)}
                          data-testid={`button-edit-user-${a.id}`}
                        >
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive" size="sm"
                              disabled={isSelf || isLast || deleteMutation.isPending}
                              data-testid={`button-delete-user-${a.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Delete
                            </Button>
                          </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {a.username}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes the user account. They will no longer be able to sign in.
                              Their tenant ({a.tenantSlug}) and its data are NOT deleted.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(a.id)}
                              data-testid={`button-confirm-delete-${a.id}`}
                            >
                              Delete user
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      </div>
                    </div>

                    <div className="flex items-end gap-2 pl-11">
                      <div className="flex-1 space-y-1.5">
                        <Label htmlFor={`pw-${a.id}`} className="text-xs flex items-center gap-1">
                          <KeyRound className="h-3 w-3" /> Set new password
                        </Label>
                        <Input
                          id={`pw-${a.id}`} type="password" value={pw}
                          onChange={(e) => setPwById((p) => ({ ...p, [a.id]: e.target.value }))}
                          placeholder="Minimum 12 characters"
                          autoComplete="new-password"
                          data-testid={`input-password-${a.id}`}
                        />
                      </div>
                      <Button
                        size="sm" variant="secondary"
                        disabled={pw.length < 12 || passwordMutation.isPending}
                        onClick={() => passwordMutation.mutate({ id: a.id, password: pw })}
                        data-testid={`button-update-password-${a.id}`}
                      >
                        Update
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit {editing?.username}</DialogTitle>
            <DialogDescription>
              Update this user's display name and the brand fields for their tenant
              {editing?.tenantSlug && <> (<span className="font-medium">{editing.tenantSlug}</span>)</>}.
              Tenant slug cannot be changed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-display">Display name</Label>
              <Input
                id="edit-display" value={editDisplay}
                onChange={(e) => setEditDisplay(e.target.value)}
                placeholder="Jane Doe"
                data-testid="input-edit-display"
              />
            </div>

            {editing?.tenantSlug && (
              <>
                <div className="border-t pt-4 space-y-4">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" /> Tenant: {editing.tenantSlug}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-persona">Display name</Label>
                      <Input
                        id="edit-persona" value={editPersona}
                        onChange={(e) => setEditPersona(e.target.value)}
                        data-testid="input-edit-persona"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-company">Company name</Label>
                      <Input
                        id="edit-company" value={editCompany}
                        onChange={(e) => setEditCompany(e.target.value)}
                        data-testid="input-edit-company"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-publisher">Publisher name</Label>
                      <Input
                        id="edit-publisher" value={editPublisher}
                        onChange={(e) => setEditPublisher(e.target.value)}
                        data-testid="input-edit-publisher"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-author">Author name</Label>
                      <Input
                        id="edit-author" value={editAuthor}
                        onChange={(e) => setEditAuthor(e.target.value)}
                        data-testid="input-edit-author"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="edit-brand-url">Brand link template</Label>
                    <Input
                      id="edit-brand-url" value={editBrandUrl}
                      onChange={(e) => setEditBrandUrl(e.target.value)}
                      placeholder="https://www.example.com/locations/{city}"
                      data-testid="input-edit-brand-url"
                    />
                    <p className="text-xs text-muted-foreground">
                      First mention of the display name in any published article body links here. Use <code>{"{city}"}</code> as a placeholder for the article's city slug. Leave blank to keep brand mentions unlinked.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending}
              data-testid="button-save-edit"
            >
              {editMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

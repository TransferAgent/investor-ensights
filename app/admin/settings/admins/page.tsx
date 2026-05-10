"use client"
import { useState, useEffect } from "react"
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { ShieldCheck, Trash2, KeyRound, Plus, UserCircle, Building2, Pencil } from "lucide-react"

interface AdminRow {
  id: string
  username: string
  displayName: string | null
  createdAt: string
  tenantSlug: string | null
  tenantDisplayName: string | null
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
  const [createAttempted, setCreateAttempted] = useState(false)
  const [editAttempted, setEditAttempted] = useState(false)

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
      setCreateAttempted(false)
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] })
    },
    onError: (e: any) => {
      toast({ title: "Could not create user", description: e?.message || "Try again", variant: "destructive" })
    },
  })

  // ---- Per-field required validation (Add User) ----
  const createMissing = {
    email: !newEmail.includes("@"),
    password: newPassword.length < 12,
    tenantChoice: tenantChoice.length === 0,
    ntSlug: isNewTenant && !/^[a-z][a-z0-9_]{0,62}$/.test(newTenantSlug.trim()),
    ntDisplay: isNewTenant && newTenantDisplay.trim().length === 0,
    ntCompany: isNewTenant && newTenantCompany.trim().length === 0,
    ntPublisher: isNewTenant && newTenantPublisher.trim().length === 0,
    ntAuthor: isNewTenant && newTenantAuthor.trim().length === 0,
    ntBrandUrl: isNewTenant && newTenantBrandUrl.trim().length === 0,
  }
  const createHasErrors = Object.values(createMissing).some(Boolean)
  const errBorder = (cond: boolean) => (cond ? " border-red-500 focus-visible:ring-red-500" : "")

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

  // ---- Edit dialog state ----
  const [editing, setEditing] = useState<AdminRow | null>(null)
  const [editDisplayName, setEditDisplayName] = useState("")
  const [editTenantDisplay, setEditTenantDisplay] = useState("")
  const [editTenantPublisher, setEditTenantPublisher] = useState("")
  const [editTenantAuthor, setEditTenantAuthor] = useState("")
  const [editTenantCompany, setEditTenantCompany] = useState("")
  const [editTenantBrandUrl, setEditTenantBrandUrl] = useState("")

  const openEdit = (row: AdminRow) => {
    setEditing(row)
    setEditAttempted(false)
    setEditDisplayName(row.displayName ?? "")
    // Tenant fields hydrate from /api/admin/tenants/[slug] below.
    setEditTenantDisplay(row.tenantDisplayName ?? "")
    setEditTenantPublisher("")
    setEditTenantAuthor("")
    setEditTenantCompany("")
    setEditTenantBrandUrl("")
  }

  const editingSlug = editing?.tenantSlug ?? null
  const { data: editingTenant } = useQuery<{
    tenant: {
      slug: string; personaDisplayName: string; publisherName: string;
      authorName: string; companyName: string; brandHomeUrl: string | null;
    }
  }>({
    queryKey: ["/api/admin/tenants", editingSlug],
    enabled: !!editingSlug,
  })

  // Hydrate tenant fields once when the tenant data arrives for the open dialog.
  useEffect(() => {
    if (!editing || !editingTenant?.tenant) return
    if (editingTenant.tenant.slug !== editingSlug) return
    setEditTenantDisplay(editingTenant.tenant.personaDisplayName)
    setEditTenantPublisher(editingTenant.tenant.publisherName)
    setEditTenantAuthor(editingTenant.tenant.authorName)
    setEditTenantCompany(editingTenant.tenant.companyName)
    setEditTenantBrandUrl(editingTenant.tenant.brandHomeUrl ?? "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTenant?.tenant?.slug, editingSlug])

  // ---- Per-field required validation (Edit) ----
  const editMissing = {
    tenantDisplay: !!editing?.tenantSlug && editTenantDisplay.trim().length === 0,
    tenantCompany: !!editing?.tenantSlug && editTenantCompany.trim().length === 0,
    tenantPublisher: !!editing?.tenantSlug && editTenantPublisher.trim().length === 0,
    tenantAuthor: !!editing?.tenantSlug && editTenantAuthor.trim().length === 0,
    tenantBrandUrl: !!editing?.tenantSlug && editTenantBrandUrl.trim().length === 0,
  }
  const editHasErrors = Object.values(editMissing).some(Boolean)

  const saveUserMutation = useMutation({
    mutationFn: async () => {
      if (!editing) return
      // PATCH user (displayName) and tenant (4 brand fields) in parallel.
      const tasks: Promise<any>[] = []
      if ((editDisplayName.trim() || null) !== editing.displayName) {
        tasks.push(apiRequest("PATCH", `/api/admin/users/${editing.id}`, {
          displayName: editDisplayName.trim() || null,
        }))
      }
      if (editing.tenantSlug) {
        tasks.push(apiRequest("PATCH", `/api/admin/tenants/${editing.tenantSlug}`, {
          personaDisplayName: editTenantDisplay.trim(),
          publisherName: editTenantPublisher.trim(),
          authorName: editTenantAuthor.trim(),
          companyName: editTenantCompany.trim(),
          brandHomeUrl: editTenantBrandUrl.trim() || null,
        }))
      }
      await Promise.all(tasks)
    },
    onSuccess: () => {
      toast({ title: "Saved" })
      setEditing(null)
      setEditAttempted(false)
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] })
      if (editingSlug) queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants", editingSlug] })
    },
    onError: (e: any) => {
      toast({ title: "Could not save", description: e?.message || "Try again", variant: "destructive" })
    },
  })

  const admins = data?.admins ?? []
  const currentUsername = data?.currentUsername

  const canSubmit = !createHasErrors

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
                className={errBorder(createAttempted && createMissing.email)}
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
              className={errBorder(createAttempted && createMissing.password)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tenant-picker" className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Tenant
            </Label>
            <Select value={tenantChoice} onValueChange={setTenantChoice}>
              <SelectTrigger
                id="tenant-picker" data-testid="select-tenant"
                className={errBorder(createAttempted && createMissing.tenantChoice)}
              >
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
                      className={errBorder(createAttempted && createMissing.ntSlug)}
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
                      className={errBorder(createAttempted && createMissing.ntDisplay)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="nt-company">Company Name</Label>
                    <Input
                      id="nt-company" value={newTenantCompany}
                      onChange={(e) => setNewTenantCompany(e.target.value)}
                      placeholder="Persona Two Inc."
                      data-testid="input-new-tenant-company"
                      className={errBorder(createAttempted && createMissing.ntCompany)}
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
                      className={errBorder(createAttempted && createMissing.ntPublisher)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nt-author">Author name</Label>
                    <Input
                      id="nt-author" value={newTenantAuthor}
                      onChange={(e) => setNewTenantAuthor(e.target.value)}
                      data-testid="input-new-tenant-author"
                      className={errBorder(createAttempted && createMissing.ntAuthor)}
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="nt-brand-url">Brand link template (Mandatory)</Label>
                    <Input
                      id="nt-brand-url" value={newTenantBrandUrl}
                      onChange={(e) => setNewTenantBrandUrl(e.target.value)}
                      placeholder="https://www.example.com/locations/{cityCore}"
                      data-testid="input-new-tenant-brand-url"
                      className={errBorder(createAttempted && createMissing.ntBrandUrl)}
                    />
                    <p className="text-xs text-muted-foreground">
                      First mention of the display name in any published article body links here. Placeholders: <code>{"{cityCore}"}</code> = city slug with the tenant suffix stripped (recommended for external sites), <code>{"{city}"}</code> = full registry slug.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Button
            onClick={() => {
              setCreateAttempted(true)
              if (createHasErrors) {
                toast({ title: "Please complete the required fields highlighted in red.", variant: "destructive" })
                return
              }
              createMutation.mutate()
            }}
            disabled={createMutation.isPending}
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

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit user & tenant</DialogTitle>
            <DialogDescription>
              {editing?.username} · tenant <span className="font-medium">{editing?.tenantSlug || "(none)"}</span>.
              Tenant fields apply to every user in this tenant and to all published content.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-display">User display name</Label>
              <Input
                id="edit-display" value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Jane Doe"
                data-testid="input-edit-display"
              />
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="text-sm font-medium flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> Tenant settings
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tenant-display">Persona display name</Label>
                  <Input
                    id="edit-tenant-display" value={editTenantDisplay}
                    onChange={(e) => setEditTenantDisplay(e.target.value)}
                    data-testid="input-edit-tenant-display"
                    className={errBorder(editAttempted && editMissing.tenantDisplay)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tenant-company">Company name</Label>
                  <Input
                    id="edit-tenant-company" value={editTenantCompany}
                    onChange={(e) => setEditTenantCompany(e.target.value)}
                    data-testid="input-edit-tenant-company"
                    className={errBorder(editAttempted && editMissing.tenantCompany)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tenant-publisher">Publisher name</Label>
                  <Input
                    id="edit-tenant-publisher" value={editTenantPublisher}
                    onChange={(e) => setEditTenantPublisher(e.target.value)}
                    data-testid="input-edit-tenant-publisher"
                    className={errBorder(editAttempted && editMissing.tenantPublisher)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-tenant-author">Author name</Label>
                  <Input
                    id="edit-tenant-author" value={editTenantAuthor}
                    onChange={(e) => setEditTenantAuthor(e.target.value)}
                    data-testid="input-edit-tenant-author"
                    className={errBorder(editAttempted && editMissing.tenantAuthor)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="edit-tenant-brand-url">Brand link template (Mandatory)</Label>
                  <Input
                    id="edit-tenant-brand-url" value={editTenantBrandUrl}
                    onChange={(e) => setEditTenantBrandUrl(e.target.value)}
                    placeholder="https://www.example.com/locations/{cityCore}"
                    data-testid="input-edit-tenant-brand-url"
                    className={errBorder(editAttempted && editMissing.tenantBrandUrl)}
                  />
                  <p className="text-xs text-muted-foreground">
                    First mention of the persona display name in any published article body links here. Placeholders: <code>{"{cityCore}"}</code> = city slug with the tenant suffix stripped (recommended for external sites), <code>{"{city}"}</code> = full registry slug.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button
              onClick={() => {
                setEditAttempted(true)
                if (editHasErrors) {
                  toast({ title: "Please complete the required fields highlighted in red.", variant: "destructive" })
                  return
                }
                saveUserMutation.mutate()
              }}
              disabled={saveUserMutation.isPending}
              data-testid="button-save-edit"
            >
              {saveUserMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

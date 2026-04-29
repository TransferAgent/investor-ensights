"use client"
import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ShieldCheck, Trash2, KeyRound, Plus, UserCircle } from "lucide-react"

interface AdminRow {
  id: string
  username: string
  displayName: string | null
  createdAt: string
}

interface ListResponse {
  currentUsername: string
  admins: AdminRow[]
}

export default function AdminUsersPage() {
  const { toast } = useToast()
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newDisplay, setNewDisplay] = useState("")
  const [pwById, setPwById] = useState<Record<string, string>>({})

  const { data, isLoading } = useQuery<ListResponse>({
    queryKey: ["/api/admin/users"],
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/admin/users", {
        username: newUsername.trim(),
        password: newPassword,
        displayName: newDisplay.trim() || null,
      })
    },
    onSuccess: () => {
      toast({ title: "Admin created" })
      setNewUsername("")
      setNewPassword("")
      setNewDisplay("")
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] })
    },
    onError: (e: any) => {
      toast({ title: "Could not create admin", description: e?.message || "Try again", variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      toast({ title: "Admin removed" })
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

  const admins = data?.admins ?? []
  const currentUsername = data?.currentUsername

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Admin Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage who can sign in to the admin panel. Logged in as <span className="font-medium">{currentUsername || "…"}</span>.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add a new admin
          </CardTitle>
          <CardDescription>Username can be an email. Password must be at least 12 characters.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. you@example.com"
                autoComplete="off"
                data-testid="input-new-username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-display">Display name (optional)</Label>
              <Input
                id="new-display"
                value={newDisplay}
                onChange={(e) => setNewDisplay(e.target.value)}
                placeholder="Super Admin"
                autoComplete="off"
                data-testid="input-new-display"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 12 characters"
              autoComplete="new-password"
              data-testid="input-new-password"
            />
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !newUsername.trim() || newPassword.length < 12}
            data-testid="button-create-admin"
          >
            {createMutation.isPending ? "Creating…" : "Create admin"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing admins</CardTitle>
          <CardDescription>
            You cannot delete the account you are logged in with, or the last remaining admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : admins.length === 0 ? (
            <div className="text-sm text-muted-foreground">No admins found.</div>
          ) : (
            <ul className="divide-y">
              {admins.map((a) => {
                const isSelf = a.username === currentUsername
                const isLast = admins.length <= 1
                const pw = pwById[a.id] ?? ""
                return (
                  <li key={a.id} className="py-4 space-y-3" data-testid={`row-admin-${a.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <UserCircle className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <div className="font-medium" data-testid={`text-admin-username-${a.id}`}>
                            {a.username}
                            {isSelf && <span className="ml-2 text-xs text-primary">(you)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {a.displayName || "—"} · created {new Date(a.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isSelf || isLast || deleteMutation.isPending}
                            data-testid={`button-delete-admin-${a.id}`}
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {a.username}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes the admin account. They will no longer be able to sign in.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(a.id)}
                              data-testid={`button-confirm-delete-${a.id}`}
                            >
                              Delete admin
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="flex items-end gap-2 pl-11">
                      <div className="flex-1 space-y-1.5">
                        <Label htmlFor={`pw-${a.id}`} className="text-xs flex items-center gap-1">
                          <KeyRound className="h-3 w-3" /> Set new password
                        </Label>
                        <Input
                          id={`pw-${a.id}`}
                          type="password"
                          value={pw}
                          onChange={(e) => setPwById((p) => ({ ...p, [a.id]: e.target.value }))}
                          placeholder="Minimum 12 characters"
                          autoComplete="new-password"
                          data-testid={`input-password-${a.id}`}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
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
    </div>
  )
}

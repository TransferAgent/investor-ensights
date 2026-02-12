"use client"
import { useEffect } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { QueryProvider } from "@/components/query-provider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { apiRequest, queryClient } from "@/lib/queryClient"
import {
  LayoutDashboard,
  MapPin,
  FileText,
  Layers,
  LogOut,
  Shield,
  ExternalLink,
} from "lucide-react"

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Cities", url: "/admin/cities", icon: MapPin },
  { title: "Templates", url: "/admin/templates", icon: FileText },
  { title: "Pages", url: "/admin/pages", icon: Layers },
]

interface AdminUser {
  id: string
  username: string
  displayName: string | null
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === "/admin/login"

  const { data: user, isLoading } = useQuery<AdminUser | null>({
    queryKey: ["/api/admin/me"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/admin/me", { credentials: "include" })
        if (res.status === 401) return null
        if (!res.ok) return null
        return res.json()
      } catch {
        return null
      }
    },
    staleTime: 0,
    refetchOnMount: "always",
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/logout")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] })
      router.push("/admin/login")
    },
  })

  useEffect(() => {
    if (!isLoading && !user && !isLoginPage) {
      router.push("/admin/login")
    }
  }, [isLoading, user, router, isLoginPage])

  if (isLoginPage) {
    return <>{children}</>
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 flex-col border-r bg-muted/30">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Shield className="h-5 w-5 text-primary" />
          <Link
            href="/admin"
            className="font-semibold"
            data-testid="link-admin-home"
          >
            Admin Panel
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const isActive =
              item.url === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.url)
            return (
              <Link key={item.title} href={item.url}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  data-testid={`link-nav-${item.title.toLowerCase()}`}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.title}
                </Button>
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-3">
          <Link href="/" target="_blank">
            <Button
              variant="ghost"
              className="w-full justify-start mb-1"
              data-testid="link-view-site"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              View All Locations
            </Button>
          </Link>
          <div className="mb-2 px-3 text-sm text-muted-foreground" data-testid="text-admin-user">
            {user.displayName || user.username}
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="button-logout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <AdminShell>{children}</AdminShell>
    </QueryProvider>
  )
}

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
  LogOut,
  Shield,
} from "lucide-react"

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Cities", url: "/admin/cities", icon: MapPin },
  { title: "Templates", url: "/admin/templates", icon: FileText },
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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="flex items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href="/admin"
              className="flex items-center gap-2 font-semibold"
              data-testid="link-admin-home"
            >
              <Shield className="h-4 w-4" />
              Admin Panel
            </Link>
            <nav className="flex items-center gap-1">
              {navItems.map((item) => {
                const isActive =
                  item.url === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.url)
                return (
                  <Link key={item.title} href={item.url}>
                    <Button
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      data-testid={`link-nav-${item.title.toLowerCase()}`}
                    >
                      <item.icon className="mr-1.5 h-4 w-4" />
                      {item.title}
                    </Button>
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground" data-testid="text-admin-user">
              {user.displayName || user.username}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              data-testid="button-logout"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
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

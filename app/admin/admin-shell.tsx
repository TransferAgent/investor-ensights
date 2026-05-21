"use client"
import { useEffect, useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { QueryProvider } from "@/components/query-provider"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { apiRequest, queryClient } from "@/lib/queryClient"
import {
  LayoutDashboard,
  MapPin,
  FileText,
  Layers,
  LogOut,
  Shield,
  ExternalLink,
  Newspaper,
  Database,
  Share2,
  ChevronRight,
  Twitter,
  Linkedin,
  Youtube,
  Film,
  Facebook,
  Mail,
  Bot,
  BookOpen,
  Users,
  UserPlus,
  Home,
} from "lucide-react"

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Cities", url: "/admin/cities", icon: MapPin },
  { title: "Templates", url: "/admin/templates", icon: FileText },
  { title: "Pages", url: "/admin/pages", icon: Layers },
  { title: "Haylo Library", url: "/admin/haylo", icon: BookOpen },
  { title: "Knowledge", url: "/admin/knowledge", icon: Newspaper },
  { title: "Newsroom", url: "/admin/newsroom", icon: Bot },
  { title: "Data Store", url: "/admin/data-store", icon: Database },
  { title: "Email", url: "/admin/email", icon: Mail },
  { title: "Admin Users", url: "/admin/settings/admins", icon: Users },
]

// MT-4.13: Persona Wizard nav entry, conditionally rendered for Conductor
// sessions only. Placed at the bottom of the nav since it's a low-frequency
// staff-only operation, not part of the daily workflow.
const conductorNavItems = [
  { title: "Personas", url: "/admin/personas", icon: UserPlus },
]

const socialPlatforms = [
  { title: "Twitter", slug: "twitter", icon: Twitter },
  { title: "LinkedIn", slug: "linkedin", icon: Linkedin },
  { title: "YouTube", slug: "youtube", icon: Youtube },
  { title: "TikTok", slug: "tiktok", icon: Film },
  { title: "Meta", slug: "meta", icon: Facebook },
]

interface AdminUser {
  id: string
  username: string
  displayName: string | null
  isConductor?: boolean
}

function AdminShellInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === "/admin/login"
  const isSocialMedia = pathname.startsWith("/admin/social-media")
  const [socialOpen, setSocialOpen] = useState(isSocialMedia)

  useEffect(() => {
    if (isSocialMedia) setSocialOpen(true)
  }, [isSocialMedia])

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
      // MT-4.3: nuke ALL cached query data on logout so the next user signing
      // in on this browser does not see the previous tenant's data flash on
      // screen before the refetch lands. Pair of /admin/login/page.tsx onSuccess.
      queryClient.clear()
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

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
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
                  data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.title}
                </Button>
              </Link>
            )
          })}

          {user.isConductor && conductorNavItems.map((item) => {
            const isActive = pathname.startsWith(item.url)
            return (
              <Link key={item.title} href={item.url}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.title}
                </Button>
              </Link>
            )
          })}

          <Collapsible open={socialOpen} onOpenChange={setSocialOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant={isSocialMedia ? "secondary" : "ghost"}
                className="w-full justify-start"
                data-testid="link-nav-social-media"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Social Media
                <ChevronRight
                  className={`ml-auto h-4 w-4 transition-transform duration-200 ${socialOpen ? "rotate-90" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-4 mt-1 flex flex-col gap-1 border-l pl-2">
                {socialPlatforms.map((p) => {
                  const isSubActive = pathname === `/admin/social-media/${p.slug}`
                  return (
                    <Link key={p.slug} href={`/admin/social-media/${p.slug}`}>
                      <Button
                        variant={isSubActive ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start text-sm"
                        data-testid={`link-nav-social-${p.slug}`}
                      >
                        <p.icon className="mr-2 h-3.5 w-3.5" />
                        {p.title}
                      </Button>
                    </Link>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </nav>

        <div className="border-t p-3">
          <Link href="/" target="_blank">
            <Button
              variant="ghost"
              className="w-full justify-start mb-1"
              data-testid="link-home-page"
            >
              <Home className="mr-2 h-4 w-4" />
              Home Page
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

export default function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <AdminShellInner>{children}</AdminShellInner>
    </QueryProvider>
  )
}

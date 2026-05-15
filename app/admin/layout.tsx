import type { Metadata } from "next"
import AdminShell from "./admin-shell"

// SEO note: every route under /admin is a private, authenticated surface
// (admin dashboard, newsroom orchestration, persona wizard, login). We
// declare an explicit `noindex, nofollow` so search engines never index
// these URLs even if they're discovered via internal links — and so
// Lighthouse audits report the noindex as INTENTIONAL rather than
// flagging "missing meta description" on a client-component page.
export const metadata: Metadata = {
  title: "Admin · Investor Ensights",
  description:
    "Investor Ensights administration. Authenticated users only — content management, newsroom orchestration, and tenant configuration.",
  robots: { index: false, follow: false },
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminShell>{children}</AdminShell>
}

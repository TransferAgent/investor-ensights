import { NextRequest, NextResponse } from "next/server"

// MT-6: tag every admin request with `x-ie-admin-context: 1` so the storage
// session-tenant proxy only consumes the admin_session cookie on admin paths.
// Without this, a logged-in admin visiting a PUBLIC route would have their
// tenant's schema swapped in for what should be public-content reads.
const ADMIN_HEADER = "x-ie-admin-context"

export function middleware(request: NextRequest) {
  const url = request.nextUrl
  const host = request.headers.get("host")?.split(":")[0] || ""

  if (host === "www.investorensights.com") {
    const redirectUrl = `https://investorensights.com${url.pathname}${url.search}`
    return NextResponse.redirect(redirectUrl, 301)
  }

  const isAdmin =
    url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/admin")

  const headers = new Headers(request.headers)
  if (isAdmin) headers.set(ADMIN_HEADER, "1")
  // Defence-in-depth: explicitly clear any client-supplied value on non-admin
  // paths so a malicious request can't spoof the tag.
  else headers.delete(ADMIN_HEADER)

  return NextResponse.next({ request: { headers } })
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
}

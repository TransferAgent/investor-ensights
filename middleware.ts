import { NextRequest, NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0] || ""

  if (host === "www.investorensights.com") {
    const url = new URL(request.url)
    const redirectUrl = `https://investorensights.com${url.pathname}${url.search}`
    return NextResponse.redirect(redirectUrl, 301)
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
}

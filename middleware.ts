import { NextRequest, NextResponse } from "next/server"

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") || ""

  if (host === "tableicity.com") {
    const url = new URL(request.url)
    url.host = "www.tableicity.com"
    url.protocol = "https:"
    return NextResponse.redirect(url.toString(), 301)
  }

  return NextResponse.next()
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
}

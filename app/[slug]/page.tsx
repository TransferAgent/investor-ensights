import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { storage } from "@/lib/storage"
import { SlideRenderer } from "@/components/slides/slide-renderer"
import Link from "next/link"
import { Lock } from "lucide-react"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://yourcompany.com"

const RESERVED_SLUGS = ["admin", "api", "locations", "_next", "favicon.ico"]

export const dynamicParams = true

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  if (RESERVED_SLUGS.includes(slug)) return {}

  const page = await storage.getPageBySlug(slug)
  if (!page || !page.isPublished) return {}

  return {
    title: page.metaTitle || page.pageTitle,
    description: page.metaDescription || `${page.pageTitle} - YourCompany`,
    alternates: {
      canonical: `${BASE_URL}/${page.slug}`,
    },
    openGraph: {
      title: page.metaTitle || page.pageTitle,
      description: page.metaDescription || `${page.pageTitle} - YourCompany`,
      url: `${BASE_URL}/${page.slug}`,
      ...(page.ogImageUrl ? { images: [{ url: page.ogImageUrl }] } : {}),
    },
  }
}

export async function generateStaticParams() {
  const pages = await storage.getPages()
  return pages
    .filter((p) => p.isPublished)
    .map((p) => ({ slug: p.slug }))
}

export default async function CustomPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  if (RESERVED_SLUGS.includes(slug)) {
    notFound()
  }

  const page = await storage.getPageBySlug(slug)
  if (!page || !page.isPublished) {
    notFound()
  }

  const slides = await storage.getSlidesByPageId(page.id)

  return (
    <div className="min-h-screen bg-background" data-testid={`page-${page.slug}`}>
      {slides.map((slide) => (
        <SlideRenderer key={slide.id} slide={slide} />
      ))}

      {slides.length === 0 && (
        <div className="py-20 text-center text-muted-foreground">
          <p>This page has no content yet.</p>
        </div>
      )}

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} YourCompany. All rights reserved.
          </p>
          <Link
            href="/admin/login"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <Lock className="h-3 w-3" />
            Admin
          </Link>
        </div>
      </footer>
    </div>
  )
}

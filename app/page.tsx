import type { Metadata } from "next"
import { storage } from "@/lib/storage"
import { SlideRenderer } from "@/components/slides/slide-renderer"
import HeroHome from "@/components/homepage/hero-home"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://yourcompany.com"

export async function generateMetadata(): Promise<Metadata> {
  const homePage = await storage.getPageBySlug("home")
  if (homePage?.isPublished) {
    return {
      title: homePage.metaTitle || homePage.pageTitle || "Tableicity - Equity Management for Startups",
      description: homePage.metaDescription || "Privacy-first cap table management solution. Manage equity, stakeholders, and compliance with enterprise-grade security.",
      alternates: { canonical: BASE_URL },
      openGraph: {
        title: homePage.metaTitle || homePage.pageTitle,
        description: homePage.metaDescription || "Privacy-first cap table management solution.",
        url: BASE_URL,
        ...(homePage.ogImageUrl ? { images: [{ url: homePage.ogImageUrl }] } : {}),
      },
    }
  }

  return {
    title: "Tableicity - Equity Management for Startups",
    description: "Privacy-first cap table management solution. Manage equity, stakeholders, and compliance with enterprise-grade security.",
    alternates: { canonical: BASE_URL },
  }
}

export default async function HomePage() {
  const homePage = await storage.getPageBySlug("home")

  const usePageBuilder = homePage?.isPublished
  let slides: any[] = []
  if (usePageBuilder) {
    slides = await storage.getSlidesByPageId(homePage.id)
  }

  if (usePageBuilder && slides.length > 0) {
    return (
      <div className="min-h-screen bg-background">
        {slides.map((slide) => (
          <SlideRenderer key={slide.id} slide={slide} />
        ))}
      </div>
    )
  }

  return <HeroHome />
}

import type { Metadata } from "next"
import { storage } from "@/lib/storage"
import { SlideRenderer } from "@/components/slides/slide-renderer"
import HeroHome from "@/components/homepage/hero-home"
import HomeInternalLinks from "@/components/homepage/home-internal-links"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"

const DEFAULT_TITLE = "Investor Ensights | Ground-Truth Data on Local Company Formation & Equity Activity"
const DEFAULT_DESCRIPTION = "Investor Ensights publishes ground-truth data on local company formation and equity activity for institutional and retail investors."

export async function generateMetadata(): Promise<Metadata> {
  const homePage = await storage.getPageBySlug("home")
  if (homePage?.isPublished) {
    return {
      title: homePage.metaTitle || homePage.pageTitle || DEFAULT_TITLE,
      description: homePage.metaDescription || DEFAULT_DESCRIPTION,
      alternates: { canonical: BASE_URL },
      openGraph: {
        title: homePage.metaTitle || homePage.pageTitle,
        description: homePage.metaDescription || DEFAULT_DESCRIPTION,
        url: BASE_URL,
        ...(homePage.ogImageUrl ? { images: [{ url: homePage.ogImageUrl }] } : {}),
      },
    }
  }

  return {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    alternates: { canonical: BASE_URL },
  }
}

export default async function HomePage() {
  // Fetch in parallel: home page builder, slides (if any), and SEO link inventory.
  // The link section below the hero exists to break the "orphan pages" indexing
  // signal flagged in John/Google_Index_Root_Cause.md — Google needs internal
  // <a href> equity flowing to every article and city, not just sitemap entries.
  const [homePage, articles, cities] = await Promise.all([
    storage.getPageBySlug("home"),
    storage.getKnowledgeArticles("published").catch(() => []),
    storage.getCities().catch(() => []),
  ])

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
        <HomeInternalLinks articles={articles} cities={cities} />
      </div>
    )
  }

  return (
    <>
      <HeroHome />
      <HomeInternalLinks articles={articles} cities={cities} />
    </>
  )
}

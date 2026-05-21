import type { Metadata } from "next"
import { storage } from "@/lib/storage"
import { SlideRenderer } from "@/components/slides/slide-renderer"
import HeroHome from "@/components/homepage/hero-home"
import PersonaCards from "@/components/homepage/persona-cards"
import { getPersonaCardData } from "@/lib/tenant/public-tenants"

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
  // Fetch in parallel: home page builder + per-persona card data.
  // Persona cards are the SEO-critical section — they break the orphan-page
  // signal flagged in John/Google_Index_Root_Cause.md by giving Google a
  // structured per-persona view of every city + recent insight on the site.
  const [homePage, personaCards] = await Promise.all([
    storage.getPageBySlug("home"),
    getPersonaCardData().catch(() => []),
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
        <PersonaCards cards={personaCards} />
      </div>
    )
  }

  return (
    <>
      <HeroHome />
      <PersonaCards cards={personaCards} />
    </>
  )
}

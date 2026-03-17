import type { Metadata } from "next"
import { storage } from "@/lib/storage"
import { SlideRenderer } from "@/components/slides/slide-renderer"
import HeroHome from "@/components/homepage/hero-home"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://yourcompany.com"

export async function generateMetadata(): Promise<Metadata> {
  const homePage = await storage.getPageBySlug("home")
  if (homePage?.isPublished) {
    return {
      title: homePage.metaTitle || homePage.pageTitle || "Tableicity | Cap Table Management Solutions",
      description: homePage.metaDescription || "Tableicity empowers founders with a privacy-first cap table management solution. Leveraging zero-knowledge proofs and encrypted hashes, we ensure your equity ownership remains pseudonymous, borderless, and fully GDPR-compliant. Say goodbye to leaky cap tables and embrace a new era of secure, verifiable equity management.",
      alternates: { canonical: BASE_URL },
      openGraph: {
        title: homePage.metaTitle || homePage.pageTitle,
        description: homePage.metaDescription || "Tableicity empowers founders with a privacy-first cap table management solution. Leveraging zero-knowledge proofs and encrypted hashes, we ensure your equity ownership remains pseudonymous, borderless, and fully GDPR-compliant.",
        url: BASE_URL,
        ...(homePage.ogImageUrl ? { images: [{ url: homePage.ogImageUrl }] } : {}),
      },
    }
  }

  return {
    title: "Tableicity | Cap Table Management Solutions",
    description: "Tableicity empowers founders with a privacy-first cap table management solution. Leveraging zero-knowledge proofs and encrypted hashes, we ensure your equity ownership remains pseudonymous, borderless, and fully GDPR-compliant. Say goodbye to leaky cap tables and embrace a new era of secure, verifiable equity management.",
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

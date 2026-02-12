import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

interface HeroContent {
  headline: string
  subheadline?: string
  cta_text?: string
  cta_url?: string
  background_image?: string
}

export function HeroSlide({ content }: { content: HeroContent }) {
  return (
    <div className="relative overflow-visible bg-primary py-20 md:py-28 -mx-4 px-4 rounded-md">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-md" />
      {content.background_image && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center rounded-md"
            style={{ backgroundImage: `url(${content.background_image})` }}
          />
          <div className="absolute inset-0 bg-black/50 rounded-md" />
        </>
      )}
      <div className="relative text-center max-w-4xl mx-auto">
        <h1
          className="mb-4 text-4xl font-bold tracking-tight text-primary-foreground md:text-5xl lg:text-6xl"
          data-testid="text-hero-headline"
        >
          {content.headline}
        </h1>
        {content.subheadline && (
          <p className="mx-auto mb-8 max-w-2xl text-lg text-primary-foreground/80 md:text-xl">
            {content.subheadline}
          </p>
        )}
        {content.cta_text && (
          <a href={content.cta_url || "#"}>
            <Button variant="secondary" size="lg" data-testid="button-hero-cta">
              {content.cta_text}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>
        )}
      </div>
    </div>
  )
}

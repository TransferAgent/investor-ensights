import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

interface CTAContent {
  headline: string
  subheadline?: string
  cta_text: string
  cta_url: string
}

export function CTASlide({ content }: { content: CTAContent }) {
  return (
    <div className="rounded-md bg-primary p-8 text-center md:p-12" data-testid="section-cta-slide">
      <h2 className="mb-3 text-2xl font-bold text-primary-foreground md:text-3xl">
        {content.headline}
      </h2>
      {content.subheadline && (
        <p className="mb-6 text-primary-foreground/80 max-w-2xl mx-auto">
          {content.subheadline}
        </p>
      )}
      <a href={content.cta_url}>
        <Button variant="secondary" size="lg" data-testid="button-cta-slide">
          {content.cta_text}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </a>
    </div>
  )
}

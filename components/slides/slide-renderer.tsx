import { HeroSlide } from "./hero-slide"
import { FeaturesSlide } from "./features-slide"
import { PricingSlide } from "./pricing-slide"
import { TextSlide } from "./text-slide"
import { ImageTextSlide } from "./image-text-slide"
import { CTASlide } from "./cta-slide"
import { HTMLSlide } from "./html-slide"

interface SlideData {
  id: string
  slideType: string
  contentJson: any
  contentHtml: string | null
  backgroundColor: string | null
  paddingClass: string | null
  containerWidth: string | null
}

export function SlideRenderer({ slide }: { slide: SlideData }) {
  const bg = slide.backgroundColor || ""
  const padding = slide.paddingClass || "py-16"
  const container = slide.containerWidth || "max-w-6xl"
  const content = slide.contentJson as any

  const wrapperClasses = `${bg} ${padding}`.trim()
  const containerClasses = `mx-auto px-4 ${container}`.trim()

  const isPrimaryBg = bg === "bg-primary"

  function renderSlide() {
    switch (slide.slideType) {
      case "hero":
        return <HeroSlide content={content} />
      case "features":
        return <FeaturesSlide content={content} />
      case "pricing":
        return <PricingSlide content={content} />
      case "text":
        return <TextSlide content={content} primaryBg={isPrimaryBg} />
      case "image_text":
        return <ImageTextSlide content={content} />
      case "cta":
        return <CTASlide content={content} />
      case "html":
        return <HTMLSlide content={content} rawHtml={slide.contentHtml} />
      default:
        return <div className="text-center text-muted-foreground">Unknown slide type: {slide.slideType}</div>
    }
  }

  return (
    <section className={wrapperClasses} data-testid={`slide-${slide.id}`}>
      <div className={containerClasses}>
        {renderSlide()}
      </div>
    </section>
  )
}

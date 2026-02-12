import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Check } from "lucide-react"

interface PricingTier {
  name: string
  price: string
  popular?: boolean
  features: string[]
  cta_text: string
  cta_url: string
}

interface PricingContent {
  headline?: string
  tiers: PricingTier[]
}

export function PricingSlide({ content }: { content: PricingContent }) {
  return (
    <div>
      {content.headline && (
        <h2 className="text-3xl font-bold text-center mb-10" data-testid="text-pricing-headline">
          {content.headline}
        </h2>
      )}
      <div className={`grid gap-6 ${content.tiers.length <= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2 xl:grid-cols-4"} max-w-5xl mx-auto`}>
        {content.tiers.map((tier, i) => (
          <Card
            key={i}
            className={`p-6 flex flex-col ${tier.popular ? "border-primary border-2 relative" : ""}`}
            data-testid={`card-pricing-${i}`}
          >
            {tier.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
            )}
            <div className="text-center mb-6">
              <h3 className="text-lg font-semibold mb-2">{tier.name}</h3>
              <div className="text-3xl font-bold">{tier.price}</div>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {tier.features.map((feature, j) => (
                <li key={j} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <a href={tier.cta_url}>
              <Button
                className="w-full"
                variant={tier.popular ? "default" : "outline"}
                data-testid={`button-pricing-cta-${i}`}
              >
                {tier.cta_text}
              </Button>
            </a>
          </Card>
        ))}
      </div>
    </div>
  )
}

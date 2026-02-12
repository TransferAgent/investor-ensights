import { Card } from "@/components/ui/card"
import {
  BarChart3,
  Users,
  Zap,
  Globe,
  Shield,
  Target,
  TrendingUp,
  Lightbulb,
  Settings,
  Heart,
  Star,
  Award,
} from "lucide-react"

const ICON_MAP: Record<string, any> = {
  BarChart3, Users, Zap, Globe, Shield, Target,
  TrendingUp, Lightbulb, Settings, Heart, Star, Award,
  ChartBarIcon: BarChart3,
  UsersIcon: Users,
  LightningBoltIcon: Zap,
  GlobeIcon: Globe,
  ShieldIcon: Shield,
}

interface Feature {
  icon?: string
  title: string
  description: string
}

interface FeaturesContent {
  layout?: "3-column" | "4-column"
  headline?: string
  features: Feature[]
}

export function FeaturesSlide({ content }: { content: FeaturesContent }) {
  const cols = content.layout === "4-column" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3"

  return (
    <div>
      {content.headline && (
        <h2 className="text-3xl font-bold text-center mb-10" data-testid="text-features-headline">
          {content.headline}
        </h2>
      )}
      <div className={`grid gap-6 ${cols}`}>
        {content.features.map((feature, i) => {
          const IconComponent = ICON_MAP[feature.icon || ""] || Star
          return (
            <Card key={i} className="p-6 text-center" data-testid={`card-feature-${i}`}>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-primary/10">
                <IconComponent className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

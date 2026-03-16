import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  MapPin,
  Phone,
  Mail,
  ArrowLeft,
  Navigation,
  Building2,
  ArrowRight,
  Lock,
} from "lucide-react"
import { storage } from "@/lib/storage"
import {
  replacePlaceholders,
  type CityData,
} from "@/lib/placeholder-replacer"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://yourcompany.com"

export async function generateStaticParams() {
  const cities = await storage.getCities(true)
  return cities.map((city) => ({
    slug: city.slug,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const city = await storage.getCityBySlug(slug)

  if (!city) {
    return { title: "Location Not Found" }
  }

  const assignment = await storage.getAssignmentByCityId(city.id)
  const template = assignment?.templateId
    ? await storage.getTemplateById(assignment.templateId)
    : null

  const landmarks = (city.localLandmarks as string[]) || []
  const landmarkSnippet = landmarks.length > 0
    ? ` Find our local team near ${landmarks.slice(0, 3).join(", ")}.`
    : ""

  const metaCityData: CityData = {
    cityName: city.cityName,
    stateCode: city.stateCode,
    stateName: city.stateName || undefined,
    slug: city.slug,
    streetAddress: city.streetAddress || undefined,
    localLandmarks: landmarks,
    nearbyCities: (city.nearbyCities as string[]) || [],
    phoneNumber: city.phoneNumber || undefined,
    email: city.email || undefined,
  }

  const title =
    city.metaTitle ||
    (template?.metaTitlePattern
      ? replacePlaceholders(template.metaTitlePattern, metaCityData)
      : null) ||
    `Tableicity - Equity Management Services in ${city.cityName}, ${city.stateCode}`
  const description =
    city.metaDescription ||
    (template?.metaDescriptionPattern
      ? replacePlaceholders(template.metaDescriptionPattern, metaCityData)
      : null) ||
    `Privacy-first cap table management in ${city.cityName}, ${city.stateName || city.stateCode}. Manage equity, stakeholders, and compliance with enterprise-grade security.${landmarkSnippet}`

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/locations/${city.slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/locations/${city.slug}`,
      siteName: "Tableicity",
      type: "website",
    },
  }
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const city = await storage.getCityBySlug(slug)

  if (!city) {
    notFound()
  }

  const assignment = await storage.getAssignmentByCityId(city.id)
  const template = assignment?.templateId
    ? await storage.getTemplateById(assignment.templateId)
    : null

  const landmarks = (city.localLandmarks as string[]) || []
  const nearbyCities = (city.nearbyCities as string[]) || []

  const cityData: CityData = {
    cityName: city.cityName,
    stateCode: city.stateCode,
    stateName: city.stateName || undefined,
    slug: city.slug,
    streetAddress: city.streetAddress || undefined,
    localLandmarks: landmarks,
    nearbyCities: nearbyCities,
    phoneNumber: city.phoneNumber || undefined,
    email: city.email || undefined,
  }

  const h1 =
    assignment?.customH1 ||
    replacePlaceholders(template?.h1HeaderPattern || "", cityData) ||
    `Welcome to Our ${city.cityName} Office`

  const h2 =
    replacePlaceholders(template?.h2SubheaderPattern || "", cityData) ||
    `Professional Services in ${city.cityName}, ${city.stateCode}`

  const body =
    assignment?.customBody ||
    replacePlaceholders(template?.bodyContentPattern || "", cityData) ||
    `We're proud to serve the ${city.cityName} community with top-tier sales and marketing solutions. Our local team understands the unique needs of businesses in ${city.stateName || city.stateCode} and is ready to help you grow.`

  const ctaText = template?.ctaText || "Contact Us Today"

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: `Tableicity - ${city.cityName}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: city.streetAddress,
      addressLocality: city.cityName,
      addressRegion: city.stateCode,
      postalCode: city.zipCode,
      addressCountry: "US",
    },
    ...(city.latitude &&
      city.longitude && {
        geo: {
          "@type": "GeoCoordinates",
          latitude: Number(city.latitude),
          longitude: Number(city.longitude),
        },
      }),
    ...(city.phoneNumber && { telephone: city.phoneNumber }),
    url: `${BASE_URL}/locations/${city.slug}`,
    openingHours: "Mo-Fr 09:00-18:00",
  }

  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-visible bg-primary py-16 md:py-20">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80" />
        <div className="relative mx-auto max-w-4xl px-4">
          <Link
            href="/locations"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            data-testid="link-back-locations"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to All Locations
          </Link>
          <h1
            className="mb-3 text-3xl font-bold text-primary-foreground md:text-4xl lg:text-5xl"
            data-testid="text-city-h1"
          >
            {h1}
          </h1>
          <p
            className="text-lg text-primary-foreground/80 md:text-xl"
            data-testid="text-city-h2"
          >
            {h2}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-10 flex flex-col gap-6 md:flex-row">
          <div className="flex-1">
            <div
              className="prose prose-lg max-w-none dark:prose-invert"
              data-testid="text-city-body"
            >
              {body.split("\n").map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="w-full md:w-72 shrink-0 space-y-4">
            {(city.streetAddress || city.phoneNumber || city.email) && (
              <Card className="p-5" data-testid="card-contact-info">
                <h3 className="mb-3 font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Contact Info
                </h3>
                <div className="space-y-3 text-sm">
                  {city.streetAddress && (
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span>
                        {city.streetAddress}
                        {city.zipCode && (
                          <>
                            <br />
                            {city.cityName}, {city.stateCode} {city.zipCode}
                          </>
                        )}
                      </span>
                    </div>
                  )}
                  {city.phoneNumber && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <a
                        href={`tel:${city.phoneNumber}`}
                        className="text-primary hover:underline"
                        data-testid="link-phone"
                      >
                        {city.phoneNumber}
                      </a>
                    </div>
                  )}
                  {city.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <a
                        href={`mailto:${city.email}`}
                        className="text-primary hover:underline"
                        data-testid="link-email"
                      >
                        {city.email}
                      </a>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>

        {landmarks.length > 0 && (
          <section className="mb-10">
            <h3
              className="mb-4 text-xl font-semibold"
              data-testid="text-landmarks-title"
            >
              Near Our {city.cityName} Office
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {landmarks.map((landmark, i) => (
                <Card
                  key={i}
                  className="flex items-center gap-3 p-4"
                  data-testid={`card-landmark-${i}`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Navigation className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm">{landmark}</span>
                </Card>
              ))}
            </div>
          </section>
        )}

        {(() => {
          let mapSrc = city.mapEmbedUrl || null
          if (!mapSrc && city.streetAddress) {
            const parts = [city.streetAddress, city.cityName, city.stateCode]
            if (city.zipCode) parts.push(city.zipCode)
            mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(parts.join(", "))}&output=embed`
          }
          if (!mapSrc && city.latitude && city.longitude) {
            mapSrc = `https://www.google.com/maps?q=${city.latitude},${city.longitude}&output=embed`
          }
          if (!mapSrc) return null
          return (
            <section className="mb-10" data-testid="section-map">
              <h3 className="mb-4 text-xl font-semibold">Find Us</h3>
              <div className="overflow-hidden rounded-md border">
                <iframe
                  src={mapSrc}
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Map of ${city.cityName} office`}
                  data-testid="iframe-map"
                />
              </div>
            </section>
          )
        })()}

        {nearbyCities.length > 0 && (
          <section className="mb-10" data-testid="section-nearby-cities">
            <h3 className="mb-4 text-xl font-semibold">We Also Serve</h3>
            <div className="flex flex-wrap gap-2">
              {nearbyCities.map((nc, i) => (
                <Badge key={i} variant="secondary" data-testid={`badge-nearby-${i}`}>
                  {nc}
                </Badge>
              ))}
            </div>
          </section>
        )}

        <section
          className="rounded-md bg-primary p-8 text-center md:p-12"
          data-testid="section-cta"
        >
          <h3 className="mb-3 text-2xl font-bold text-primary-foreground">
            Ready to Get Started?
          </h3>
          <p className="mb-6 text-primary-foreground/80">
            Contact our {city.cityName} team today and discover how we can help
            grow your business.
          </p>
          <Button variant="secondary" size="lg" data-testid="button-cta">
            {ctaText}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </section>
      </div>

      <footer className="border-t mt-10">
        <div className="mx-auto max-w-4xl px-4 py-6 flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Tableicity. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-home"
            >
              Home
            </Link>
            <Link
              href="/locations"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-locations"
            >
              Locations
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="link-admin-login"
            >
              <Lock className="h-3.5 w-3.5" />
              Admin
            </Link>
          </div>
        </div>
      </footer>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}

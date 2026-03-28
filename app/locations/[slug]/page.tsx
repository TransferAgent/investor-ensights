import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { storage } from "@/lib/storage"
import {
  replacePlaceholders,
  type CityData,
} from "@/lib/placeholder-replacer"
import CityMarketingPanel from "@/components/homepage/city-marketing-panel"
import LoginPanel from "@/components/homepage/login-panel"

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
    `Tableicity - Cap Table Management Services in ${city.cityName}, ${city.stateCode}`
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

  const cityArticles = await storage.getPublishedArticlesByCitySlug(city.slug)

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
    `We're proud to serve the ${city.cityName} community with top-tier cap table management solutions. Our platform helps startups in ${city.stateName || city.stateCode} manage equity, stakeholders, and compliance with enterprise-grade security.`

  let mapSrc = (city as any).mapEmbedUrl || null
  if (!mapSrc && city.streetAddress) {
    const parts = [city.streetAddress, city.cityName, city.stateCode]
    if (city.zipCode) parts.push(city.zipCode)
    mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(parts.join(", "))}&output=embed`
  }
  if (!mapSrc && city.latitude && city.longitude) {
    mapSrc = `https://www.google.com/maps?q=${city.latitude},${city.longitude}&output=embed`
  }

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
    <>
      <div className="min-h-screen flex">
        <CityMarketingPanel
          h1={h1}
          h2={h2}
          body={body}
          cityName={city.cityName}
          stateCode={city.stateCode}
          streetAddress={city.streetAddress}
          zipCode={city.zipCode}
          phoneNumber={city.phoneNumber}
          email={city.email}
          landmarks={landmarks}
          nearbyCities={nearbyCities}
          mapSrc={mapSrc}
          articles={cityArticles.map(a => ({
            slug: a.slug,
            headline: a.headline,
            metaDescription: a.metaDescription,
            datePublished: a.datePublished?.toISOString() || null,
            ogImageUrl: a.ogImageUrl,
          }))}
        />
        <LoginPanel />
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  )
}

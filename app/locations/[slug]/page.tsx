import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { storage } from "@/lib/storage"
import { withTenantAsync } from "@/lib/tenant/context"
import { resolveTenantFromCitySlug } from "@/lib/tenant/resolve-from-slug"
import { getPublicTenants } from "@/lib/tenant/public-tenants"
import {
  replacePlaceholders,
  type CityData,
} from "@/lib/placeholder-replacer"
import CityMarketingPanel from "@/components/homepage/city-marketing-panel"
import LoginPanel from "@/components/homepage/login-panel"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"

export async function generateStaticParams() {
  // Multi-tenant: pre-render all Publish+Index cities across every public
  // tenant. Without the loop, only the default tenant's cities get static
  // params and any non-default tenant's cities render dynamically on first
  // hit (still 200, just slower TTFB on cold cache).
  const tenants = await getPublicTenants()
  const all = await Promise.all(
    tenants.map((t) =>
      withTenantAsync(t.slug, () => storage.getCities(true)).catch(() => []),
    ),
  )
  const seen = new Set<string>()
  const params: Array<{ slug: string }> = []
  for (const cities of all) {
    for (const city of cities) {
      if (city.allowIndexing === false) continue
      if (seen.has(city.slug)) continue
      seen.add(city.slug)
      params.push({ slug: city.slug })
    }
  }
  return params
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  // MT-latent-bug-fix: resolve which tenant owns this city slug via the
  // public.city_slug_registry, then run all storage calls inside that
  // tenant's context. Without this wrap, storage looked in the default
  // tenant's schema only — so the moment a second persona ships a city,
  // its detail page would return 404 even though the row exists.
  const tenantSlug = await resolveTenantFromCitySlug(slug)
  const city = await withTenantAsync(tenantSlug, () => storage.getCityBySlug(slug))

  if (!city) {
    return { title: "Location Not Found" }
  }

  const [assignment] = await withTenantAsync(tenantSlug, () =>
    Promise.all([storage.getAssignmentByCityId(city.id)]),
  )
  const template = assignment?.templateId
    ? await withTenantAsync(tenantSlug, () => storage.getTemplateById(assignment.templateId as string))
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
    `Investor Ensights — Local Company Formation & Equity Activity in ${city.cityName}, ${city.stateCode}`
  const description =
    city.metaDescription ||
    (template?.metaDescriptionPattern
      ? replacePlaceholders(template.metaDescriptionPattern, metaCityData)
      : null) ||
    `Ground-truth data on local company formation and equity activity in ${city.cityName}, ${city.stateName || city.stateCode} for institutional and retail investors.${landmarkSnippet}`

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/locations/${city.slug}`,
    },
    robots: {
      index: city.allowIndexing,
      follow: true,
      "max-snippet": -1 as any,
      "max-image-preview": "large" as any,
      "max-video-preview": -1 as any,
    },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/locations/${city.slug}`,
      siteName: "Investor Ensights",
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
  const tenantSlug = await resolveTenantFromCitySlug(slug)

  const { city, assignment, template, cityArticles } = await withTenantAsync(
    tenantSlug,
    async () => {
      const c = await storage.getCityBySlug(slug)
      if (!c) return { city: null, assignment: null, template: null, cityArticles: [] as Awaited<ReturnType<typeof storage.getPublishedArticlesByCitySlug>> }
      const [a, articles] = await Promise.all([
        storage.getAssignmentByCityId(c.id),
        storage.getPublishedArticlesByCitySlug(c.slug),
      ])
      const t = a?.templateId ? await storage.getTemplateById(a.templateId) : null
      return { city: c, assignment: a, template: t, cityArticles: articles }
    },
  )

  if (!city) {
    notFound()
  }

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
    `Investor Ensights publishes ground-truth data on local company formation and equity activity in ${city.cityName}, ${city.stateName || city.stateCode} for institutional and retail investors.`

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
    name: `Investor Ensights — ${city.cityName}`,
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
          citySlug={city.slug}
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

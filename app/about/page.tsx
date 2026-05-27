import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { Facebook } from "lucide-react"
import { PLATFORM_AUTHOR } from "@/lib/author-config"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://investorensights.com"
const PUBLISHER_NAME = PLATFORM_AUTHOR.publisherName
const COMPANY_LEGAL = "Investor Ensights Inc."
const COMPANY_ADDRESS = "9121 Haven Ave., Rancho Cucamonga, CA 91730"
const CONTACT_EMAIL = PLATFORM_AUTHOR.email
const CONTACT_PHONE = PLATFORM_AUTHOR.phone

export const metadata: Metadata = {
  title: "About & Editorial Team | Investor Ensights",
  description:
    "About Investor Ensights and its editorial team. Meet Brian Reynolds, Senior Financial Analyst, and learn how we publish daily financial insights on U.S. company formation and equity activity.",
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: "About & Editorial Team | Investor Ensights",
    description:
      "About Investor Ensights and its editorial team — Brian Reynolds, Senior Financial Analyst, and how we cover U.S. company formation and equity activity.",
    url: `${BASE_URL}/about`,
    type: "website",
    images: [{ url: `${BASE_URL}${PLATFORM_AUTHOR.avatarPath}` }],
  },
  robots: { index: true, follow: true },
}

export default function AboutPage() {
  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: PLATFORM_AUTHOR.name,
    jobTitle: PLATFORM_AUTHOR.title,
    image: `${BASE_URL}${PLATFORM_AUTHOR.avatarPath}`,
    email: `mailto:${PLATFORM_AUTHOR.email}`,
    telephone: PLATFORM_AUTHOR.phone,
    sameAs: [PLATFORM_AUTHOR.facebookUrl],
    worksFor: {
      "@type": "Organization",
      name: PUBLISHER_NAME,
      url: BASE_URL,
    },
    url: `${BASE_URL}/about`,
  }

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: PUBLISHER_NAME,
    legalName: COMPANY_LEGAL,
    url: BASE_URL,
    logo: `${BASE_URL}/investor-ensights-logo.png`,
    email: CONTACT_EMAIL,
    telephone: CONTACT_PHONE,
    address: {
      "@type": "PostalAddress",
      streetAddress: "9121 Haven Ave.",
      addressLocality: "Rancho Cucamonga",
      addressRegion: "CA",
      postalCode: "91730",
      addressCountry: "US",
    },
    sameAs: [PLATFORM_AUTHOR.facebookUrl],
    founder: {
      "@type": "Person",
      name: PLATFORM_AUTHOR.name,
    },
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <header className="mb-10">
          <Link
            href="/"
            className="text-[13px] text-neutral-500 hover:text-neutral-900"
            data-testid="link-back-home"
          >
            ← Back to home
          </Link>
          <h1
            className="mt-4 text-[32px] font-semibold tracking-tight sm:text-[40px]"
            data-testid="text-page-title"
          >
            About &amp; Editorial Team
          </h1>
          <p className="mt-2 text-[14px] text-neutral-500">
            Investor Ensights — publisher and editorial masthead.
          </p>
        </header>

        {/* Section 1: About the publisher */}
        <section className="mb-14" data-testid="section-about-publisher">
          <h2 className="mb-4 text-[22px] font-semibold tracking-tight">
            About Investor Ensights
          </h2>
          <div className="prose prose-neutral max-w-none text-[15px] leading-relaxed">
            <p>
              Investor Ensights is a financial-publishing platform covering U.S. company
              formation, equity activity, and the local conditions that shape small-business
              capital markets. We publish daily insights for institutional and retail investors,
              founders, and analysts who need to see where new companies are forming, how
              founder equity is moving, and what those signals mean at the city level — not
              just the national one.
            </p>
            <p>
              Our editorial program runs across a network of sister publications, each focused
              on a different slice of the formation-and-equity landscape: Tableicity, Veltroy,
              Haylo, Texitie, and Payrol. All of them publish through the Investor Ensights
              masthead under a single editorial standard: every article cites its underlying
              public data source, names the jurisdiction it covers, and explains what the
              numbers mean for the reader.
            </p>
            <p>
              Investor Ensights is operated by {COMPANY_LEGAL}, headquartered at{" "}
              {COMPANY_ADDRESS}. We do not provide investment advice — see our{" "}
              <Link href="/terms" className="font-medium text-neutral-900 underline">
                Terms of Service
              </Link>{" "}
              for the full editorial disclaimer.
            </p>
          </div>
        </section>

        {/* Section 2: Editorial Team */}
        <section className="mb-14" data-testid="section-editorial-team">
          <h2 className="mb-6 text-[22px] font-semibold tracking-tight">
            Our Editorial Team
          </h2>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex-shrink-0">
              <Image
                src={PLATFORM_AUTHOR.avatarPath}
                alt={`Headshot of ${PLATFORM_AUTHOR.name}`}
                width={140}
                height={140}
                className="rounded-full border border-neutral-200 object-cover"
                data-testid="img-author-headshot"
                priority
              />
            </div>

            <div className="flex-1">
              <h3
                className="text-[20px] font-semibold tracking-tight"
                data-testid="text-author-name"
              >
                {PLATFORM_AUTHOR.name}
              </h3>
              <p
                className="mt-1 text-[14px] text-neutral-600"
                data-testid="text-author-title"
              >
                {PLATFORM_AUTHOR.title}, {PUBLISHER_NAME}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-neutral-600">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="hover:text-neutral-900 hover:underline"
                  data-testid="link-author-email"
                >
                  {CONTACT_EMAIL}
                </a>
                <span className="text-neutral-300">·</span>
                <a
                  href={`tel:${CONTACT_PHONE.replace(/[^0-9+]/g, "")}`}
                  className="hover:text-neutral-900 hover:underline"
                  data-testid="link-author-phone"
                >
                  {CONTACT_PHONE}
                </a>
                <span className="text-neutral-300">·</span>
                <a
                  href={PLATFORM_AUTHOR.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-neutral-900 hover:underline"
                  data-testid="link-author-facebook"
                  aria-label={`${PLATFORM_AUTHOR.name} on Facebook`}
                >
                  <Facebook className="h-3.5 w-3.5" aria-hidden="true" />
                  Facebook
                </a>
              </div>
            </div>
          </div>

          <div className="prose prose-neutral mt-8 max-w-none text-[15px] leading-relaxed">
            <p>
              Brian Reynolds is the Senior Financial Analyst at Investor Ensights, where he
              leads editorial coverage of U.S. company formation, equity activity, and
              small-business capital markets. With more than ten years of experience
              translating institutional-grade datasets into clear, decision-ready insights,
              Brian focuses on the local detail behind national trends — the city-by-city pace
              of new LLC filings, the founder-equity patterns that shape early-stage company
              health, and the operating conditions that move small businesses from formation
              to funding.
            </p>
            <p>
              Before joining Investor Ensights, Brian spent eight years on the analyst desk at
              a regional research firm covering Sun Belt market formation, where he built the
              quantitative methodology that still anchors much of his published work. He holds
              a B.A. in Economics and writes daily across Investor Ensights and its sister
              publications — Tableicity, Veltroy, Haylo, Texitie, and Payrol — each focused on
              a different slice of the formation-and-equity landscape.
            </p>
            <p>
              His editorial standard is simple: every published article must cite the
              underlying public data source, name the city or jurisdiction it covers, and
              explain what it means for the founder or investor reading it. Brian reviews and
              signs off on every piece that carries his byline. Reach the editorial team at{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-medium text-neutral-900 underline"
                data-testid="link-contact-email-inline"
              >
                {CONTACT_EMAIL}
              </a>{" "}
              or {CONTACT_PHONE}.
            </p>
          </div>
        </section>

        <footer className="mt-12 border-t border-neutral-200 pt-6 text-[13px] text-neutral-500">
          <Link href="/terms" className="hover:text-neutral-900" data-testid="link-terms">
            Terms of Service
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="hover:text-neutral-900" data-testid="link-privacy">
            Privacy Policy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/site-map" className="hover:text-neutral-900" data-testid="link-sitemap">
            Sitemap
          </Link>
          <span className="mx-2">·</span>
          <Link href="/" className="hover:text-neutral-900" data-testid="link-home">
            Home
          </Link>
        </footer>
      </div>
    </div>
  )
}

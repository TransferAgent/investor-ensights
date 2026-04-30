"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import {
  Building2,
  Zap,
  CheckCircle2,
  MapPin,
  Phone,
  Mail,
  Navigation,
  ArrowLeft,
} from "lucide-react"

const SLIDES = [
  "/gallery/1_G-A_Normal_Cap.png",
  "/gallery/2_G-B_SAFE_Agreement.png",
  "/gallery/3_G-C_ESOP.png",
  "/gallery/4_G-01_Hash_Wall.png",
  "/gallery/5_G-03_D_Encrypted.png",
  "/gallery/6_G-04_E_DATA_Store.png",
  "/gallery/7_G-05_Core_Value_Desk.png",
]

const SLIDE_ALT_TEMPLATES = [
  "Investor Ensights Cap Table Dashboard for {{city}}, {{state}} founders — stakeholder equity distribution, share classes, and ownership breakdown in a privacy-first capitalization table.",
  "Investor Ensights SAFE Agreement Management for {{city}}, {{state}} startups — tracking Simple Agreements for Future Equity with valuation caps, discount rates, and conversion terms.",
  "Investor Ensights ESOP Management for {{city}}, {{state}} companies — Employee Stock Option Pool hierarchy with vesting schedules, grant tracking, and exercise status.",
  "Investor Ensights Encrypted Hash Wall for {{city}}, {{state}} — SHA-256 hashed stakeholder identities protecting equity ownership data from leaks.",
  "Investor Ensights Encrypted Data View for {{city}}, {{state}} founders — privacy-first cap table with pseudonymous identifiers and consent-based auditor reveal.",
  "Investor Ensights Data Store for {{city}}, {{state}} companies — encrypted document vault for cap table records, stakeholder agreements, and compliance artifacts.",
  "Investor Ensights Core Value Desk — founder workspace showcasing the privacy-first equity management philosophy for {{city}}, {{state}} startups.",
]

const SLIDE_OBJECT_POSITION = [
  "left center",
  "left center",
  "left center",
  "center",
  "center",
  "center",
  "center",
]

interface CityArticle {
  slug: string
  headline: string
  metaDescription: string | null
  datePublished: string | null
  ogImageUrl: string | null
}

interface CityMarketingPanelProps {
  h1: string
  h2: string
  body: string
  cityName: string
  stateCode: string
  citySlug?: string
  streetAddress?: string | null
  zipCode?: string | null
  phoneNumber?: string | null
  email?: string | null
  landmarks: string[]
  nearbyCities: string[]
  mapSrc?: string | null
  articles?: CityArticle[]
}

export default function CityMarketingPanel({
  h1,
  h2,
  body,
  cityName,
  stateCode,
  citySlug,
  streetAddress,
  zipCode,
  phoneNumber,
  email,
  landmarks,
  nearbyCities,
  mapSrc,
  articles = [],
}: CityMarketingPanelProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const SLIDE_DURATIONS = [14400, 9000, 14400, 7200, 14400, 14400, 14400]
  const SLIDE_END_SCALE: Record<number, number> = { 0: 1.62, 1: 1.31, 2: 1.62, 3: 1.08, 4: 1.62, 5: 1.62, 6: 1.62 }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length)
    }, SLIDE_DURATIONS[currentSlide])
    return () => clearTimeout(timeout)
  }, [currentSlide])

  const isHtml = body.includes("<") && body.includes(">")

  return (
    <div
      className="hidden lg:flex lg:w-[45%] flex-col overflow-hidden"
      style={{ backgroundColor: "#0f1b2d" }}
    >
      <div className="p-10 xl:p-12 flex flex-col h-full overflow-y-auto">
        <header className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 className="h-[18px] w-[18px] text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              Investor Ensights
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-yellow-400" />
              <span className="text-xs text-blue-200/60">Under 5 min setup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs text-blue-200/60">No credit card</span>
            </div>
          </div>
        </header>

        <h1
          className="text-2xl xl:text-[1.75rem] font-bold leading-tight text-white mb-1 line-clamp-2"
          data-testid="text-city-h1"
          title={h1}
        >
          {h1}
        </h1>
        <h2
          className="text-sm leading-relaxed mb-4 text-blue-200/80 font-normal"
          data-testid="text-city-h2"
        >
          {h2}
        </h2>

        <div className="mb-6 w-full">
          <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16/10" }}>
            <AnimatePresence mode="popLayout">
              <motion.img
                key={currentSlide}
                src={SLIDES[currentSlide]}
                alt={SLIDE_ALT_TEMPLATES[currentSlide].replace(/\{\{city\}\}/g, cityName).replace(/\{\{state\}\}/g, stateCode)}
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: SLIDE_OBJECT_POSITION[currentSlide] }}
                initial={{ opacity: 0, scale: 1.0 }}
                animate={{ opacity: 1, scale: SLIDE_END_SCALE[currentSlide] || 1.08 }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: { duration: 1, ease: "easeInOut" },
                  scale: { duration: SLIDE_DURATIONS[currentSlide] / 1000, ease: "linear" },
                }}
              />
            </AnimatePresence>

            <div
              className="absolute inset-0 pointer-events-none z-10"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)",
              }}
            />

          </div>
        </div>

        <div className="border-t border-white/10 pt-4 mb-4">
          {isHtml ? (
            <div
              className="text-sm leading-relaxed text-blue-200/80 city-body-html"
              data-testid="text-city-body"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          ) : (
            <h3 className="text-sm leading-relaxed text-blue-200/80 font-normal" data-testid="text-city-body">
              {body.split("\n").map((paragraph, i) => (
                <span key={i} className={i > 0 ? "mt-2 block" : "block"}>{paragraph}</span>
              ))}
            </h3>
          )}
        </div>

        {(streetAddress || phoneNumber || email || mapSrc) && (
          <div className="border-t border-white/10 pt-4 mb-4">
            <h3 className="text-[10px] uppercase tracking-wider text-blue-200/50 mb-3 font-normal" data-testid="text-contact-h3">
              Contact Info
            </h3>
            <div className="grid grid-cols-2 gap-4 items-start">
              <div className="space-y-2.5">
                {streetAddress && (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <h4 className="text-xs text-blue-200/70 font-normal" data-testid="text-address-h4">
                      {streetAddress}
                      {zipCode && (
                        <>
                          <br />
                          {cityName}, {stateCode} {zipCode}
                        </>
                      )}
                    </h4>
                  </div>
                )}
                {phoneNumber && (
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <a
                      href={`tel:${phoneNumber}`}
                      className="text-xs text-blue-200/70 hover:text-blue-200/90 transition-colors"
                      data-testid="link-phone"
                    >
                      {phoneNumber}
                    </a>
                  </div>
                )}
                {email && (
                  <div className="flex items-center gap-2.5">
                    <Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                    <a
                      href={`mailto:${email}`}
                      className="text-xs text-blue-200/70 hover:text-blue-200/90 transition-colors"
                      data-testid="link-email"
                    >
                      {email}
                    </a>
                  </div>
                )}
              </div>
              {mapSrc && (
                <div className="overflow-hidden rounded-lg h-[85px]" data-testid="section-map">
                  <iframe
                    src={mapSrc}
                    width="100%"
                    height="85"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={`Map of ${cityName} office`}
                    data-testid="iframe-map"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {landmarks.length > 0 && (
          <div className="border-t border-white/10 pt-4 mb-4">
            <h3 className="text-[10px] uppercase tracking-wider text-blue-200/50 mb-3 font-normal" data-testid="text-landmarks-h3">
              Near Our {cityName} Office
            </h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {landmarks.map((landmark, i) => (
                <div key={i} className="flex items-center gap-1.5" data-testid={`card-landmark-${i}`}>
                  <Navigation className="h-3 w-3 text-green-400 shrink-0" />
                  <h4 className="text-xs text-blue-200/70 font-normal">{landmark}</h4>
                </div>
              ))}
            </div>
          </div>
        )}

        {articles.length > 0 && (
          <div className="border-t border-white/10 pt-4 mb-4" data-testid="section-press-releases">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] uppercase tracking-wider text-blue-200/50 font-normal">
                Press Releases
              </h3>
              {articles.length > 2 && citySlug && (
                <Link
                  href={"/locations/" + citySlug + "/press-releases"}
                  className="text-[10px] uppercase tracking-wider text-blue-400 hover:text-blue-300 transition-colors font-normal"
                  data-testid="link-see-more-press-releases"
                >
                  See More
                </Link>
              )}
            </div>
            <div className="space-y-2">
              {articles.slice(0, 2).map((article) => (
                <Link
                  key={article.slug}
                  href={"/discovery/knowledge/" + article.slug}
                  className="block p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5 hover:border-white/10"
                  data-testid={"link-article-" + article.slug}
                >
                  <h4 className="text-sm font-medium text-white/90 leading-tight">
                    {article.headline.replace(/<[^>]*>/g, "")}
                  </h4>
                  {article.metaDescription && (
                    <p className="text-xs text-blue-200/60 mt-1 line-clamp-2">
                      {article.metaDescription}
                    </p>
                  )}
                  {article.datePublished && (
                    <p className="text-xs text-blue-200/40 mt-1.5">
                      {new Date(article.datePublished).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {nearbyCities.length > 0 && (
          <div className="border-t border-white/10 pt-4 mb-4">
            <h3 className="text-[10px] uppercase tracking-wider text-blue-200/50 mb-3 font-normal" data-testid="text-nearby-h3">
              We Also Serve
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {nearbyCities.map((nc, i) => (
                <h4
                  key={i}
                  className="text-xs text-blue-200/70 bg-white/5 rounded px-2 py-0.5 font-normal"
                  data-testid={`badge-nearby-${i}`}
                >
                  {nc}
                </h4>
              ))}
            </div>
          </div>
        )}

        <nav className="border-t border-white/10 pt-3 mt-auto">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5"
              data-testid="link-home"
            >
              <span className="text-xs text-blue-200/50 hover:text-blue-200/90 transition-colors">
                Home
              </span>
            </Link>
            <Link
              href="/locations"
              className="flex items-center gap-1.5"
              data-testid="link-locations"
            >
              <MapPin className="h-3 w-3 text-blue-400 shrink-0" />
              <span className="text-xs text-blue-200/50 hover:text-blue-200/90 transition-colors">
                Locations
              </span>
            </Link>
            <Link
              href="/locations"
              className="flex items-center gap-1.5"
              data-testid="link-back-locations"
            >
              <ArrowLeft className="h-3 w-3 text-blue-400 shrink-0" />
              <span className="text-xs text-blue-200/50 hover:text-blue-200/90 transition-colors">
                Back to All Locations
              </span>
            </Link>
          </div>
        </nav>
      </div>
    </div>
  )
}

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
  "/beast-01-hash-wall.png",
  "/beast-02-code-vault.png",
  "/beast-03-masked-table.png",
  "/beast-04-reveal-mode.png",
  "/beast-05-zk-network.png",
  "/beast-06-lock-shield.png",
]

const SLIDE_ALT_TEMPLATES = [
  "Tableicity Encrypted Hash: Privacy-first cap table platform using SHA-256 encryption for equity ownership protection in {{city}}, {{state}} — a secure alternative to Carta.",
  "Tableicity secure cap table code architecture featuring SHA-256 hashing, GDPR compliance, and Zero-Knowledge Proof stakeholder verification for {{city}}, {{state}} startups.",
  "Tableicity Cap Table Dashboard showing encrypted stakeholder identities with pseudonymous hash labels for {{city}}, {{state}} founders — ownership data stays private by default.",
  "Tableicity Cap Table Dashboard after auditor reveal showing real stakeholder names for {{city}}, {{state}} compliance — consent-based 30-minute identity access.",
  "Tableicity Cap Table Dashboard showing SHA-256 hashed stakeholder identities, ZK-Proof verification network, and 30-minute auditor reveal access control for {{city}}, {{state}}.",
  "Privacy-first capitalization table management software in {{city}}, {{state}} featuring encrypted stakeholder names and time-boxed auditor access to prevent data leaks.",
]

interface CityMarketingPanelProps {
  h1: string
  h2: string
  body: string
  cityName: string
  stateCode: string
  streetAddress?: string | null
  zipCode?: string | null
  phoneNumber?: string | null
  email?: string | null
  landmarks: string[]
  nearbyCities: string[]
  mapSrc?: string | null
}

export default function CityMarketingPanel({
  h1,
  h2,
  body,
  cityName,
  stateCode,
  streetAddress,
  zipCode,
  phoneNumber,
  email,
  landmarks,
  nearbyCities,
  mapSrc,
}: CityMarketingPanelProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const SLIDE_DURATIONS = [7200, 7200, 14400, 14400, 7200, 7200]
  const SLIDE_END_SCALE: Record<number, number> = { 2: 1.62, 3: 1.62 }

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
              Tableicity
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
          className="text-2xl xl:text-[1.75rem] font-bold leading-tight text-white mb-1"
          data-testid="text-city-h1"
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

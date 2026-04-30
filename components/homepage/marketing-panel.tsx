"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Link from "next/link"
import {
  Building2,
  Zap,
  CheckCircle2,
  KeyRound,
  Shield,
  Lock,
  FileCheck,
  MapPin,
  Mail,
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

const SLIDE_ALTS = [
  "Investor Ensights Cap Table Dashboard — normal view showing stakeholder equity distribution, share classes, and ownership breakdown in a privacy-first capitalization table.",
  "Investor Ensights SAFE Agreement Management — tracking Simple Agreements for Future Equity with valuation caps, discount rates, and conversion terms.",
  "Investor Ensights ESOP Management — Employee Stock Option Pool hierarchy with vesting schedules, grant tracking, and exercise status.",
  "Investor Ensights Encrypted Hash Wall — SHA-256 hashed stakeholder identities protecting equity ownership data from leaks.",
  "Investor Ensights Encrypted Data View — privacy-first cap table with pseudonymous identifiers and consent-based auditor reveal.",
  "Investor Ensights Data Store — encrypted document vault for cap table records, stakeholder agreements, and compliance artifacts.",
  "Investor Ensights Core Value Desk — founder workspace showcasing the privacy-first equity management philosophy behind Investor Ensights.",
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

const FEATURES = [
  "Full ESOP Hierarchy",
  "5 Equity Instruments",
  "SAFE Management",
  "Stakeholder Tracking",
  "Encrypted Data Room",
  "Share Class Definitions",
  "Dashboard & Metrics",
  "PDF Generation - Certificates",
  "Email MFA Security",
  "Role-Based Access (4 Roles)",
  "Audit Logging",
  "Test Drive System",
  "Multi-Tenant Isolation",
  "Platform Admin Panel",
  "401A Validations",
  "Migrations",
  "AI Powered Simulations",
  "Parent - Child Apps",
]

const SECURITY = [
  {
    icon: KeyRound,
    label: "Authentication:",
    text: "Multi-Factor Authentication (TOTP), httpOnly Cookies, Custom JWT with Tenant Claims",
  },
  {
    icon: Shield,
    label: "Access Control:",
    text: "Role-Based Access Control (RBAC) with 4 tiers, Tenant Isolation Middleware",
  },
  {
    icon: Lock,
    label: "Encryption:",
    text: "TLS 1.3 (Transit), pgcrypto for PII (Rest), AWS Parameter Store (Secrets)",
  },
  {
    icon: FileCheck,
    label: "Compliance:",
    text: "Immutable Audit Logs, Webhook Signature Verification, CORS/CSRF Protection",
  },
]

export default function MarketingPanel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const SLIDE_DURATIONS = [14400, 9000, 14400, 7200, 14400, 14400, 14400]
  const SLIDE_END_SCALE: Record<number, number> = { 0: 1.62, 1: 1.31, 2: 1.62, 3: 1.08, 4: 1.62, 5: 1.62, 6: 1.62 }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length)
    }, SLIDE_DURATIONS[currentSlide])
    return () => clearTimeout(timeout)
  }, [currentSlide])

  return (
    <div
      className="marketing-scroll hidden lg:flex lg:w-[45%] flex-col justify-between overflow-y-auto max-h-screen"
      style={{ backgroundColor: "#0f1b2d" }}
    >
      <div className="p-10 xl:p-12 flex flex-col justify-between h-full">
        <header className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 className="h-[18px] w-[18px] text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white" data-testid="text-brand-h1">
              Investor Ensights
            </h1>
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

        <h3 className="text-sm leading-relaxed mb-4 text-blue-200/80 font-normal" data-testid="text-pitch-h3">
          Forget the hassle of booking a demo from Cake or Carta—experience an immediate, user-friendly test drive. With just three clicks, you&apos;re inside a live, seeded cap table featuring founders, employees, investors, and vesting schedules. Model funding rounds, simulate exits, and explore features via a guided checklist, all in minutes.
        </h3>

        <div className="mb-8 w-full">
          <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16/10" }}>
            <AnimatePresence mode="popLayout">
              <motion.img
                key={currentSlide}
                src={SLIDES[currentSlide]}
                alt={SLIDE_ALTS[currentSlide]}
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

        <p className="text-sm leading-relaxed mb-6 text-blue-200/80 font-normal" data-testid="text-gallery-caption">
          Once ready, create your private, isolated cap table. Powered by SHA-256 encryption, Investor Ensights ensures privacy-first protection for your equity data. Experience the fastest, most intuitive way to bring your cap table to life. No spreadsheets, no waiting—just results. Investor Ensights: your cap table, when you&apos;re ready.{" "}
          <span className="font-semibold tracking-wide text-sky-300" data-testid="text-patent-pending">
            PATENT PENDING
          </span>
        </p>

        <div className="border-t border-white/10 pt-5">
          <h2 className="text-xs uppercase tracking-wider text-blue-200/50 mb-3 font-normal" data-testid="text-features-h2">
            Everything you need — built in
          </h2>
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                <h3 className="text-xs text-blue-200/70 font-normal">{f}</h3>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-5 mt-5">
          <h2 className="text-[10px] uppercase tracking-wider text-blue-200/50 mb-3 font-normal" data-testid="text-security-h2">
            Enterprise-Grade Security
          </h2>
          <div className="space-y-2.5">
            {SECURITY.map((item) => (
              <div key={item.label} className="flex items-start gap-2.5">
                <item.icon className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                <h3 className="text-xs text-blue-200/70 font-normal">
                  <span className="text-blue-200/90 font-medium">
                    {item.label}
                  </span>{" "}
                  {item.text}
                </h3>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/10">
            <Link
              href="/locations"
              className="flex items-center gap-2"
              data-testid="link-locations"
            >
              <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="text-xs text-blue-200/70 hover:text-blue-200/90 transition-colors">
                Locations
              </span>
            </Link>
            <a
              href="mailto:info@investorensights.com"
              className="flex items-center gap-2"
              data-testid="link-email-contact"
            >
              <Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="text-xs text-blue-200/70 hover:text-blue-200/90 transition-colors">
                info@investorensights.com
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

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
  "/beast-01-hash-wall.png",
  "/beast-02-code-vault.png",
  "/beast-03-masked-table.png",
  "/beast-04-reveal-mode.png",
  "/beast-05-zk-network.png",
  "/beast-06-lock-shield.png",
]

const SLIDE_ALTS = [
  "Tableicity Encrypted Hash: Privacy-first cap table platform using SHA-256 encryption for equity ownership protection — a secure alternative to Carta.",
  "Tableicity secure cap table code architecture featuring SHA-256 hashing, GDPR compliance, and Zero-Knowledge Proof stakeholder verification.",
  "Tableicity Cap Table Dashboard showing encrypted stakeholder identities with pseudonymous hash labels like UQSQ-UHA5 and W375-EX65 — ownership data stays private by default.",
  "Tableicity Cap Table Dashboard after auditor reveal showing real stakeholder names like Sarah Mitchell and James Carter — consent-based 30-minute identity access for compliance.",
  "Tableicity Cap Table Dashboard showing SHA-256 hashed stakeholder identities, ZK-Proof verification network, and 30-minute auditor reveal access control.",
  "Privacy-first capitalization table management software featuring encrypted stakeholder names and time-boxed auditor access to prevent data leaks.",
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
  const SLIDE_DURATIONS = [7200, 7200, 14400, 14400, 7200, 7200]
  const SLIDE_END_SCALE: Record<number, number> = { 2: 1.62, 3: 1.62 }

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length)
    }, SLIDE_DURATIONS[currentSlide])
    return () => clearTimeout(timeout)
  }, [currentSlide])

  return (
    <div
      className="hidden lg:flex lg:w-[45%] flex-col justify-between overflow-hidden"
      style={{ backgroundColor: "#0f1b2d" }}
    >
      <div className="p-10 xl:p-12 flex flex-col justify-between h-full">
        <header className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 className="h-[18px] w-[18px] text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-white" data-testid="text-brand-h1">
              Tableicity
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

        <h2 className="text-sm leading-relaxed mb-4 text-blue-200/80 font-normal" data-testid="text-pitch-h2">
          Equity Management for Startups
        </h2>

        <h3 className="text-sm leading-relaxed mb-4 text-blue-200/80 font-normal" data-testid="text-pitch-h3">
          One leaked or hacked screenshot of your Cap Table can cost millions in a lost deal or trigger a regulatory nightmare. Mitigate this risk by ensuring your equity ownership remains pseudonymous through SHA-256 Encryption with on-demand auditor reveal. Built for Founders who refuse to treat their ownership data as public property.
        </h3>

        <div className="mb-8 w-full">
          <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16/10" }}>
            <AnimatePresence mode="popLayout">
              <motion.img
                key={currentSlide}
                src={SLIDES[currentSlide]}
                alt={SLIDE_ALTS[currentSlide]}
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
              href="mailto:info@tableicity.com"
              className="flex items-center gap-2"
              data-testid="link-email-contact"
            >
              <Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" />
              <span className="text-xs text-blue-200/70 hover:text-blue-200/90 transition-colors">
                info@tableicity.com
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

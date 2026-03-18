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
} from "lucide-react"

const SLIDES = [
  "/slideshow-f2.png",
  "/slideshow-g.png",
  "/slideshow-a.png",
  "/slideshow-b.png",
  "/slideshow-c.png",
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

function Typewriter() {
  const word = "Privately."
  const [displayed, setDisplayed] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    if (!isDeleting) {
      if (displayed.length < word.length) {
        timeout = setTimeout(() => {
          setDisplayed(word.slice(0, displayed.length + 1))
        }, 120)
      } else {
        timeout = setTimeout(() => setIsDeleting(true), 2000)
      }
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => {
          setDisplayed(word.slice(0, displayed.length - 1))
        }, 80)
      } else {
        timeout = setTimeout(() => setIsDeleting(false), 500)
      }
    }

    return () => clearTimeout(timeout)
  }, [displayed, isDeleting])

  return (
    <span className="italic">
      {displayed}
      <span className="inline-block w-[2px] h-[1.1em] bg-white ml-[1px] align-middle animate-pulse" />
    </span>
  )
}

export default function MarketingPanel() {
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length)
    }, 7200)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="hidden lg:flex lg:w-[45%] flex-col justify-between overflow-hidden"
      style={{ backgroundColor: "#0f1b2d" }}
    >
      <div className="p-10 xl:p-12 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between mb-5">
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
        </div>

        <p className="text-sm leading-relaxed mb-4 text-blue-200/80">
          One leaked or hacked screenshot of your Cap Table can cost millions in a lost deal or trigger a tax event. The risk is mitigated by ensuring your equity ownership remains pseudonymous with on-demand auditor reveal.
        </p>

        <div className="mb-8 w-full">
          <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16/10" }}>
            <AnimatePresence mode="popLayout">
              <motion.img
                key={currentSlide}
                src={SLIDES[currentSlide]}
                alt="Tableicity platform"
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ opacity: 0, scale: 1.0 }}
                animate={{ opacity: 1, scale: 1.08 }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: { duration: 1, ease: "easeInOut" },
                  scale: { duration: 7.2, ease: "linear" },
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

            <div className="absolute z-20 top-[25%] left-0 right-0 text-center">
              <div className="text-2xl xl:text-[2rem] font-bold leading-tight text-white">
                Own Your Equity,
              </div>
              <div className="text-2xl xl:text-[2rem] font-bold leading-tight text-white">
                <Typewriter />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-5">
          <p className="text-xs uppercase tracking-wider text-blue-200/50 mb-3">
            Everything you need — built in
          </p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-2">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
                <span className="text-xs text-blue-200/70">{f}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 pt-5 mt-5">
          <p className="text-[10px] uppercase tracking-wider text-blue-200/50 mb-3">
            Enterprise-Grade Security
          </p>
          <div className="space-y-2.5">
            {SECURITY.map((item) => (
              <div key={item.label} className="flex items-start gap-2.5">
                <item.icon className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200/70">
                  <span className="text-blue-200/90 font-medium">
                    {item.label}
                  </span>{" "}
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/locations"
            className="flex items-center gap-2 mt-3 pt-3 border-t border-white/10"
            data-testid="link-locations"
          >
            <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="text-xs text-blue-200/70 hover:text-blue-200/90 transition-colors">
              Locations
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}

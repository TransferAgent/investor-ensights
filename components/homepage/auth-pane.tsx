"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ChevronDown, Mail, Apple, Check } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { FaLinkedin } from "react-icons/fa"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type Tenant = {
  slug: string
  personaDisplayName: string
  companyName: string | null
}

const PLATFORM_LABEL = "Investor Ensights"

export default function AuthPane() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/public/tenants")
      .then((r) => (r.ok ? r.json() : { tenants: [] }))
      .then((d) => {
        const list: Tenant[] = Array.isArray(d?.tenants) ? d.tenants : []
        setTenants(list)
      })
      .catch(() => setTenants([]))
  }, [])

  const selected = tenants.find((t) => t.slug === selectedSlug) || null
  const currentLabel =
    selected?.companyName || selected?.personaDisplayName || PLATFORM_LABEL

  return (
    <div className="relative flex flex-1 flex-col bg-white text-neutral-900 min-h-screen">
      <div className="absolute top-6 left-6 flex items-center gap-1.5">
        <span
          className="text-[22px] font-bold leading-none tracking-tight"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
          data-testid="text-brand-mark"
        >
          iE
        </span>
      </div>

      <div className="absolute top-6 left-1/2 -translate-x-1/2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
              data-testid="button-app-context"
            >
              <span className="text-neutral-500">You are signing into</span>
              <span className="flex items-center gap-1 font-semibold text-neutral-900">
                <span className="inline-block h-3.5 w-3.5 rounded-full bg-neutral-900" />
                {currentLabel}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="min-w-[220px]">
            <DropdownMenuLabel className="text-xs text-neutral-500">
              Sign into…
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setSelectedSlug(null)}
              data-testid="option-tenant-platform"
            >
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded-full bg-neutral-900" />
                {PLATFORM_LABEL}
              </span>
              {selectedSlug === null && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuItem>
            {tenants.length > 0 && <DropdownMenuSeparator />}
            {tenants.map((t) => {
              const label = t.companyName || t.personaDisplayName
              return (
                <DropdownMenuItem
                  key={t.slug}
                  onClick={() => setSelectedSlug(t.slug)}
                  data-testid={`option-tenant-${t.slug}`}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full bg-neutral-300" />
                    {label}
                    <span className="text-xs text-neutral-400">({t.slug})</span>
                  </span>
                  {selectedSlug === t.slug && (
                    <Check className="ml-auto h-3.5 w-3.5" />
                  )}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[360px]">
          <h1
            className="mb-8 text-center text-[34px] font-semibold leading-tight tracking-tight text-neutral-900"
            data-testid="text-auth-title"
          >
            Create your account
          </h1>

          <Link
            href="/admin/login"
            prefetch={false}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 text-[14px] font-medium text-white transition-colors hover:bg-neutral-800"
            data-testid="button-signup-email-primary"
          >
            <Mail className="h-4 w-4" />
            Sign up with email
          </Link>

          <div className="my-5 h-px w-full bg-neutral-200" />

          <div className="space-y-2.5">
            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-[14px] font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
              data-testid="button-signup-apple"
              disabled
              title="Coming soon"
            >
              <Apple className="h-4 w-4 fill-current" />
              Sign up with Apple
            </button>

            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-[14px] font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
              data-testid="button-signup-google"
              disabled
              title="Coming soon"
            >
              <FcGoogle className="h-4 w-4" />
              Sign up with Google
            </button>

            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-[14px] font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
              data-testid="button-signup-linkedin"
              disabled
              title="Coming soon"
            >
              <FaLinkedin className="h-4 w-4" style={{ color: "#0A66C2" }} />
              Sign up with LinkedIn
            </button>
          </div>

          <p
            className="mt-6 text-center text-[13px] text-neutral-500"
            data-testid="text-signin-prompt"
          >
            Already have an account?{" "}
            <Link
              href="/admin/login"
              prefetch={false}
              className="font-semibold text-neutral-900 hover:underline"
              data-testid="link-signin"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="px-6 pb-6 pt-4 text-center">
        <p className="mb-2 text-[12px] text-neutral-500" data-testid="text-address">
          9121 Haven Ave., Rancho Cucamonga, CA 91730
        </p>
        <p className="text-[12px] text-neutral-500" data-testid="text-legal">
          By continuing, you agree to Investor Ensights Inc.&apos;s{" "}
          <Link
            href="/terms"
            className="font-medium text-neutral-700 underline-offset-2 hover:underline"
            data-testid="link-terms"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="font-medium text-neutral-700 underline-offset-2 hover:underline"
            data-testid="link-privacy"
          >
            Privacy Policy
          </Link>
          .
        </p>
        <p className="mt-2 text-[11px] text-neutral-400">
          <Link
            href="/about"
            className="hover:text-neutral-700 hover:underline"
            data-testid="link-about"
          >
            About
          </Link>
          <span className="mx-2">·</span>
          <Link
            href="/site-map"
            className="hover:text-neutral-700 hover:underline"
            data-testid="link-sitemap"
          >
            Sitemap
          </Link>
        </p>
      </div>
    </div>
  )
}

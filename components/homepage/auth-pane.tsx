"use client"

import Link from "next/link"
import { ChevronDown, Mail, Apple } from "lucide-react"
import { FcGoogle } from "react-icons/fc"
import { FaLinkedin } from "react-icons/fa"

export default function AuthPane() {
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
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-neutral-700 shadow-sm transition-colors hover:bg-neutral-50"
          data-testid="button-app-context"
        >
          <span className="text-neutral-500">You are signing into</span>
          <span className="flex items-center gap-1 font-semibold text-neutral-900">
            <span className="inline-block h-3.5 w-3.5 rounded-full bg-neutral-900" />
            Investor Ensights
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[360px]">
          <h1
            className="mb-8 text-center text-[34px] font-semibold leading-tight tracking-tight text-neutral-900"
            data-testid="text-auth-title"
          >
            Create your account
          </h1>

          <button
            type="button"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 text-[14px] font-medium text-white transition-colors hover:bg-neutral-800"
            data-testid="button-signup-email-primary"
          >
            <Mail className="h-4 w-4" />
            Sign up with email
          </button>

          <div className="my-5 h-px w-full bg-neutral-200" />

          <div className="space-y-2.5">
            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-[14px] font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
              data-testid="button-signup-apple"
            >
              <Apple className="h-4 w-4 fill-current" />
              Sign up with Apple
            </button>

            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-[14px] font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
              data-testid="button-signup-google"
            >
              <FcGoogle className="h-4 w-4" />
              Sign up with Google
            </button>

            <button
              type="button"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-[14px] font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
              data-testid="button-signup-linkedin"
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
            <button
              type="button"
              className="font-semibold text-neutral-900 hover:underline"
              data-testid="link-signin"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>

      <div className="px-6 pb-6 pt-4 text-center">
        <p className="mb-2 text-[12px] text-neutral-500" data-testid="text-address">
          9121 Haven Ave., Rancho Cucamonga, CA 91730
        </p>
        <p className="text-[12px] text-neutral-500" data-testid="text-legal">
          By continuing, you{" "}
          <Link
            href="/admin/login"
            prefetch={false}
            className="text-neutral-500 no-underline hover:no-underline"
            style={{ textDecoration: "none" }}
            data-testid="link-admin-entry"
          >
            agree
          </Link>{" "}
          to Investor Ensights Inc.&apos;s{" "}
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

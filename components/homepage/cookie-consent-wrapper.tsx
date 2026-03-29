"use client"

import dynamic from "next/dynamic"

const CookieConsent = dynamic(() => import("./cookie-consent"), { ssr: false })

export default function CookieConsentWrapper() {
  return <CookieConsent />
}

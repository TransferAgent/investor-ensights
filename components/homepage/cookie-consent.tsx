"use client"

import { useState, useEffect } from "react"
import { X, Cookie } from "lucide-react"

const REDIRECT_URL = "https://app.tableicity.com/login"

export default function CookieConsent() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const consent = localStorage.getItem("cookie-consent-accepted")
      const dismissed = localStorage.getItem("cookie-consent-dismissed")
      if (!consent && dismissed !== "true") {
        setVisible(true)
      }
    } catch (e) {}
  }, [])

  if (!mounted || !visible) return null

  const handleAccept = () => {
    try { localStorage.setItem("cookie-consent-accepted", "true") } catch (e) {}
    setVisible(false)
    window.location.href = REDIRECT_URL
  }

  const handleReject = () => {
    try { localStorage.setItem("cookie-consent-accepted", "rejected") } catch (e) {}
    setVisible(false)
    window.location.href = REDIRECT_URL
  }

  const handleDismiss = () => {
    try { localStorage.setItem("cookie-consent-dismissed", "true") } catch (e) {}
    setVisible(false)
  }

  return (
    <div
      className="absolute left-4 right-4 z-[10]"
      style={{ top: "120px" }}
      data-testid="cookie-consent-card"
    >
      <div
        style={{
          background: "rgba(13, 20, 35, 0.97)",
          border: "1px solid rgba(99, 179, 237, 0.3)",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
        }}
      >
        <div style={{ height: "4px", background: "#2B6CB0" }} />

        <div style={{ padding: "16px", position: "relative" }}>
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors"
            style={{ background: "transparent", border: "none", cursor: "pointer" }}
            data-testid="button-cookie-dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-6">
            <div
              className="shrink-0 mt-0.5 flex items-center justify-center"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(99, 179, 237, 0.15)",
                border: "1px solid rgba(99, 179, 237, 0.25)",
              }}
            >
              <Cookie className="h-4 w-4" style={{ color: "#63B3ED" }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white" style={{ margin: "0 0 4px 0" }}>
                We value your privacy
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "#A0AEC0", margin: 0 }}>
                We use cookies to enhance your browsing experience and analyse our traffic. By clicking &ldquo;Accept&rdquo;, you consent to our use of cookies.
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 mt-3.5">
            <button
              onClick={handleReject}
              className="flex-1 py-2 rounded-lg text-[13px] font-medium transition-colors"
              style={{
                border: "1px solid rgba(99, 179, 237, 0.2)",
                background: "transparent",
                color: "#A0AEC0",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(99, 179, 237, 0.4)"; e.currentTarget.style.color = "#E2E8F0" }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(99, 179, 237, 0.2)"; e.currentTarget.style.color = "#A0AEC0" }}
              data-testid="button-cookie-reject"
            >
              Reject All
            </button>
            <button
              onClick={handleAccept}
              className="flex-1 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{
                border: "none",
                background: "#2B6CB0",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#2C5282" }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#2B6CB0" }}
              data-testid="button-cookie-accept"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

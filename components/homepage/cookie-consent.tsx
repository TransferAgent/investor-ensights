"use client"

import { useState, useEffect } from "react"

const REDIRECT_URL = "https://app.tableicity.com/login"

export default function CookieConsent() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  function doAccept() {
    window.location.href = REDIRECT_URL
  }

  function doReject() {
    window.location.href = REDIRECT_URL
  }

  return (
    <div
      className="absolute z-[10]"
      style={{ top: "150px", left: "50%", transform: "translateX(-50%)", width: "87%" }}
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

        <div style={{ padding: "16px" }}>
          <div className="flex items-start gap-3">
            <div
              className="shrink-0 mt-0.5 flex items-center justify-center"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(99, 179, 237, 0.15)",
                border: "1px solid rgba(99, 179, 237, 0.25)",
                fontSize: "16px",
              }}
            >
              {"🍪"}
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white" style={{ margin: "0 0 4px 0" }}>
                We value your privacy
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "#A0AEC0", margin: 0 }}>
                {"We use cookies to enhance your browsing experience and analyse our traffic. By clicking \"Accept\", you consent to our use of cookies."}
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 mt-3.5">
            <button
              onClick={doReject}
              className="flex-1 py-2 rounded-lg text-[13px] font-medium transition-colors"
              style={{
                border: "1px solid rgba(99, 179, 237, 0.2)",
                background: "transparent",
                color: "#A0AEC0",
                cursor: "pointer",
              }}
              data-testid="button-cookie-reject"
            >
              Reject All
            </button>
            <button
              onClick={doAccept}
              className="flex-1 py-2 rounded-lg text-[13px] font-medium text-white transition-colors"
              style={{
                border: "none",
                background: "#2B6CB0",
                cursor: "pointer",
              }}
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

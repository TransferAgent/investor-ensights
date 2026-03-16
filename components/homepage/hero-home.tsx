"use client"

import MarketingPanel from "./marketing-panel"
import LoginPanel from "./login-panel"

export default function HeroHome() {
  return (
    <div className="min-h-screen flex">
      <MarketingPanel />
      <LoginPanel />
    </div>
  )
}

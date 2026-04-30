"use client"

import AuthPane from "./auth-pane"
import ImagePane from "./image-pane"

export default function HeroHome() {
  return (
    <div className="min-h-screen flex">
      <AuthPane />
      <ImagePane />
    </div>
  )
}

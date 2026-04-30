"use client"

export default function ImagePane() {
  return (
    <div
      className="relative hidden flex-1 lg:block"
      style={{ backgroundColor: "#000" }}
      data-testid="pane-image"
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/auth-hero.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0) 100%)",
        }}
      />

      <div className="relative z-[1] flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center">
          <span
            className="select-none leading-none tracking-tight"
            style={{
              fontFamily: "ui-serif, Georgia, 'Times New Roman', serif",
              fontWeight: 700,
              fontSize: "clamp(180px, 22vw, 320px)",
              color: "rgba(255,255,255,0.78)",
              textShadow:
                "0 0 60px rgba(255,255,255,0.18), 0 0 120px rgba(140,180,220,0.12)",
            }}
            data-testid="text-hero-mark"
          >
            iE
          </span>
          <span
            className="mt-6 select-none uppercase"
            style={{
              fontFamily:
                "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
              fontWeight: 500,
              fontSize: "clamp(13px, 1.1vw, 16px)",
              letterSpacing: "0.42em",
              color: "rgba(255,255,255,0.55)",
            }}
            data-testid="text-hero-wordmark"
          >
            Investor Ensights
          </span>
        </div>
      </div>
    </div>
  )
}

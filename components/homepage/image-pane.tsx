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
            "linear-gradient(90deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,0) 100%)",
        }}
      />
    </div>
  )
}

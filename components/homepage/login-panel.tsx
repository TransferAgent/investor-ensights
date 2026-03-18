"use client"

import { Building2 } from "lucide-react"

export default function LoginPanel() {
  return (
    <div className="flex-1 relative" style={{ backgroundColor: "#0a1628" }}>
      <div
        className="absolute inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage: "url(/peek2.png)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0% center",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none z-[2]"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.90)",
        }}
      />

      <div className="lg:hidden absolute top-6 left-6 flex items-center gap-2 z-[3]">
        <div className="h-8 w-8 rounded-md bg-blue-600 flex items-center justify-center">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold text-white">Tableicity</span>
      </div>

      <div className="absolute inset-0 overflow-y-auto flex items-center justify-center p-6 z-[3]">
        <div
          className="w-full max-w-[420px] rounded-2xl p-8 cursor-pointer transition-transform hover:scale-[1.02]"
          style={{
            border: "1px solid rgba(99,179,237,0.2)",
            boxShadow:
              "0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,179,237,0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            background: "rgba(13, 20, 35, 0.92)",
          }}
          onMouseEnter={() => {
            window.location.href = "https://equity-manager-pro.replit.app"
          }}
        >
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div
                className="h-12 w-12 rounded-[10px] flex items-center justify-center"
                style={{
                  background: "rgba(99,179,237,0.15)",
                  border: "1px solid rgba(99,179,237,0.3)",
                }}
              >
                <Building2 className="h-6 w-6" style={{ color: "#63B3ED" }} />
              </div>
              <span
                className="text-[11px] font-bold tracking-wide"
                style={{
                  color: "#FACC15",
                  border: "1px solid rgba(250,204,21,0.4)",
                  borderRadius: "6px",
                  padding: "2px 8px",
                }}
              >
                Beta 1.01
              </span>
            </div>
            <h1 className="text-[22px] font-bold text-white mb-1">TABLEICITY</h1>
            <p className="text-[13px]" style={{ color: "#718096" }}>
              Equity Management for Startups
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              window.location.href = "https://www.tableicity.com"
            }}
          >
            <div>
              <label
                className="block text-[0.8rem] font-medium mb-1.5"
                style={{ color: "#A0AEC0" }}
              >
                Email
              </label>
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(99,179,237,0.2)",
                  color: "#E2E8F0",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#63B3ED"
                  e.currentTarget.style.boxShadow =
                    "0 0 0 2px rgba(99,179,237,0.2)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(99,179,237,0.2)"
                  e.currentTarget.style.boxShadow = "none"
                }}
                data-testid="input-email"
              />
            </div>

            <div>
              <label
                className="block text-[0.8rem] font-medium mb-1.5"
                style={{ color: "#A0AEC0" }}
              >
                Password
              </label>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(99,179,237,0.2)",
                  color: "#E2E8F0",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#63B3ED"
                  e.currentTarget.style.boxShadow =
                    "0 0 0 2px rgba(99,179,237,0.2)"
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(99,179,237,0.2)"
                  e.currentTarget.style.boxShadow = "none"
                }}
                data-testid="input-password"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg font-semibold text-white transition-colors"
              style={{ backgroundColor: "#2B6CB0" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#2C5282")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#2B6CB0")
              }
              data-testid="button-sign-in"
            >
              Sign In
            </button>
          </form>

          <div className="text-center pt-4 space-y-2">
            <p className="text-sm" style={{ color: "#718096" }}>
              Don&apos;t have an account?{" "}
              <a
                href="https://www.tableicity.com/register"
                className="font-medium hover:underline"
                style={{ color: "#63B3ED" }}
                data-testid="link-create-account"
              >
                Create one
              </a>
            </p>
            <p className="text-sm" style={{ color: "#718096" }}>
              Or{" "}
              <a
                href="https://www.tableicity.com/launch"
                className="font-medium hover:underline"
                style={{ color: "#48BB78" }}
                data-testid="link-free-trial"
              >
                Start a Free Trial
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

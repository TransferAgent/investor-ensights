"use client"
import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { QueryProvider } from "@/components/query-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { apiRequest, queryClient } from "@/lib/queryClient"
import { Loader2 } from "lucide-react"

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/login", { email, password })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] })
      router.push("/admin")
    },
    onError: (error: Error) => {
      toast({
        title: "Sign in failed",
        description: error.message.includes("401") ? "Invalid email or password" : "Something went wrong",
        variant: "destructive",
      })
    },
  })

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* LEFT — white form panel */}
      <div className="flex items-center justify-center bg-white px-6 py-12 lg:px-16">
        <div className="w-full max-w-sm space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900" data-testid="text-login-title">
              Sign in
            </h1>
            <p className="text-sm text-gray-500">
              Enter your email and password to access your tenant.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              loginMutation.mutate()
            }}
            className="space-y-5"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-gray-700">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                data-testid="input-email"
                className="bg-white border-gray-300"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-gray-700">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                data-testid="input-password"
                className="bg-white border-gray-300"
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-black hover:bg-gray-900 text-white"
              disabled={loginMutation.isPending || !email || !password}
              data-testid="button-login"
            >
              {loginMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign in
            </Button>
          </form>

          <p className="text-xs text-gray-400">
            Need an account? Ask your administrator to add you.
          </p>
        </div>
      </div>

      {/* RIGHT — black brand panel */}
      <div className="hidden lg:flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-4">
          <div
            className="text-[10rem] font-bold leading-none tracking-tight select-none"
            data-testid="text-brand-mark"
          >
            iE
          </div>
          <div className="text-sm uppercase tracking-[0.3em] text-gray-400">
            Investor Ensights
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <QueryProvider>
      <LoginForm />
    </QueryProvider>
  )
}

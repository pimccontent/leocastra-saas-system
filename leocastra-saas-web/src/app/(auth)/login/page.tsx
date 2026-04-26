"use client"

import { Button } from "@/components/ui/button"
import { setAuthToken } from "@/lib/auth"
import { api } from "@/lib/api"
import { useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type LoginPayload = {
  email: string
  password: string
}

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState<LoginPayload>({ email: "", password: "" })
  const [touched, setTouched] = useState<Record<keyof LoginPayload, boolean>>({
    email: false,
    password: false,
  })

  useEffect(() => {
    if (localStorage.getItem("leocastra_saas_token")) {
      router.replace("/")
    }
  }, [router])

  const errors = useMemo(() => {
    const next: Partial<Record<keyof LoginPayload, string>> = {}
    if (!form.email.trim()) next.email = "Email is required"
    else if (!/^\S+@\S+\.\S+$/.test(form.email))
      next.email = "Enter a valid email"

    if (!form.password) next.password = "Password is required"
    else if (form.password.length < 8)
      next.password = "Password must be at least 8 characters"
    return next
  }, [form])

  const loginMutation = useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const response = await api.post<{ accessToken: string }>(
        "/auth/login",
        payload,
      )
      return response.data
    },
    onSuccess: (data) => {
      setAuthToken(data.accessToken)
      router.replace("/")
    },
  })

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTouched({ email: true, password: true })
    if (Object.keys(errors).length > 0) return
    loginMutation.mutate(form)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">Login</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Access your LeoCastra SaaS dashboard.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, email: e.target.value }))
              }
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
            />
            {touched.email && errors.email && (
              <p className="mt-1 text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Password</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, password: e.target.value }))
              }
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="********"
            />
            {touched.password && errors.password && (
              <p className="mt-1 text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          {loginMutation.isError && (
            <p className="text-sm text-destructive">
              Login failed. Check your credentials and try again.
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}

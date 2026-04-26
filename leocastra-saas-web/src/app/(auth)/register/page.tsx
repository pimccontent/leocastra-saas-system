"use client"

import { Button } from "@/components/ui/button"
import { setAuthToken } from "@/lib/auth"
import { api } from "@/lib/api"
import { useMutation } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"

type RegisterPayload = {
  firstName: string
  lastName: string
  email: string
  organizationName: string
  password: string
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState<RegisterPayload>({
    firstName: "",
    lastName: "",
    email: "",
    organizationName: "",
    password: "",
  })
  const [touched, setTouched] = useState<
    Record<keyof RegisterPayload, boolean>
  >({
    firstName: false,
    lastName: false,
    email: false,
    organizationName: false,
    password: false,
  })

  useEffect(() => {
    if (localStorage.getItem("leocastra_saas_token")) {
      router.replace("/")
    }
  }, [router])

  const errors = useMemo(() => {
    const next: Partial<Record<keyof RegisterPayload, string>> = {}
    if (!form.firstName.trim()) next.firstName = "First name is required"
    if (!form.lastName.trim()) next.lastName = "Last name is required"
    if (!form.organizationName.trim())
      next.organizationName = "Organization name is required"
    if (!form.email.trim()) next.email = "Email is required"
    else if (!/^\S+@\S+\.\S+$/.test(form.email))
      next.email = "Enter a valid email"
    if (!form.password) next.password = "Password is required"
    else if (form.password.length < 8)
      next.password = "Password must be at least 8 characters"
    return next
  }, [form])

  const registerMutation = useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const response = await api.post<{ accessToken: string }>(
        "/auth/register",
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
    setTouched({
      firstName: true,
      lastName: true,
      email: true,
      organizationName: true,
      password: true,
    })
    if (Object.keys(errors).length > 0) return
    registerMutation.mutate(form)
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border bg-card p-6">
        <h1 className="text-2xl font-semibold">Register</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your LeoCastra SaaS account.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">First name</label>
              <input
                value={form.firstName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, firstName: e.target.value }))
                }
                onBlur={() =>
                  setTouched((prev) => ({ ...prev, firstName: true }))
                }
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {touched.firstName && errors.firstName && (
                <p className="mt-1 text-xs text-destructive">{errors.firstName}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Last name</label>
              <input
                value={form.lastName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, lastName: e.target.value }))
                }
                onBlur={() => setTouched((prev) => ({ ...prev, lastName: true }))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              {touched.lastName && errors.lastName && (
                <p className="mt-1 text-xs text-destructive">{errors.lastName}</p>
              )}
            </div>
          </div>

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
            <label className="mb-1 block text-sm font-medium">Organization</label>
            <input
              value={form.organizationName}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, organizationName: e.target.value }))
              }
              onBlur={() =>
                setTouched((prev) => ({ ...prev, organizationName: true }))
              }
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="Acme Media"
            />
            {touched.organizationName && errors.organizationName && (
              <p className="mt-1 text-xs text-destructive">
                {errors.organizationName}
              </p>
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
              placeholder="At least 8 characters"
            />
            {touched.password && errors.password && (
              <p className="mt-1 text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          {registerMutation.isError && (
            <p className="text-sm text-destructive">
              Registration failed. Please try again.
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="mt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}

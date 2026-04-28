"use client"

import { Button } from "@/components/ui/button"
import { AUTH_TOKEN_KEY } from "@/lib/auth"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo } from "react"

export default function PaymentCallbackPage() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const token = typeof window === "undefined" ? null : localStorage.getItem(AUTH_TOKEN_KEY)
    if (!token) router.replace("/login")
  }, [router])

  const trxref = params.get("trxref")
  const reference = params.get("reference")

  const ref = useMemo(() => reference ?? trxref ?? "", [reference, trxref])

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-6">
      <div className="ui-surface space-y-2 p-4">
        <h1 className="text-xl font-semibold tracking-tight">Payment received</h1>
        <p className="text-sm text-muted-foreground">
          Paystack has redirected you back. Your payment will be confirmed once the Paystack webhook reaches the server.
        </p>
        {ref ? (
          <p className="text-xs text-muted-foreground">
            Reference: <span className="font-mono">{ref}</span>
          </p>
        ) : null}
      </div>

      <div className="flex gap-3">
        <Button onClick={() => router.push("/billing")}>View billing</Button>
        <Button variant="outline" onClick={() => router.push("/licenses")}>
          View licenses
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        If you don’t see the transaction update after a minute, confirm your Paystack webhook is configured to call
        <span className="font-mono"> /api/payments/webhook/paystack</span>.
      </p>
    </div>
  )
}


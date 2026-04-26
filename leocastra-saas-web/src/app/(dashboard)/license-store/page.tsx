"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useMe } from "@/lib/me"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type CatalogFeature = {
  key: string
  name: string
  priceCents: number
  unit: "per_stream" | "flat"
}

type Duration = "monthly" | "yearly"
type Quote = {
  totalCents: number
  currency: string
}

export default function LicenseStorePage() {
  const me = useMe()
  const orgId = me.data?.organizationId ?? ""
  const [duration, setDuration] = useState<Duration>("monthly")
  const [perStreamQty, setPerStreamQty] = useState<Record<string, number>>({})
  const [flatOn, setFlatOn] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const featuresQuery = useQuery({
    queryKey: ["features"],
    queryFn: async () => {
      const response = await api.get<CatalogFeature[]>("/features")
      return response.data
    },
  })

  const displayFeatures = useMemo(() => {
    const priority = ["rtmp_streams", "srt_streams"]
    const features = [...(featuresQuery.data ?? [])]
    return features.sort((a, b) => {
      const ai = priority.indexOf(a.key)
      const bi = priority.indexOf(b.key)
      const aPinned = ai !== -1
      const bPinned = bi !== -1
      if (aPinned && bPinned) return ai - bi
      if (aPinned) return -1
      if (bPinned) return 1
      return a.name.localeCompare(b.name)
    })
  }, [featuresQuery.data])

  const itemsPayload = useMemo(() => {
    const features = featuresQuery.data ?? []
    const items: Array<{ featureKey: string; quantity: number }> = []
    for (const f of features) {
      if (f.unit === "per_stream") {
        const q = Math.max(0, Math.floor(perStreamQty[f.key] ?? 0))
        if (q > 0) items.push({ featureKey: f.key, quantity: q })
      } else if (flatOn[f.key]) {
        items.push({ featureKey: f.key, quantity: 1 })
      }
    }
    return items
  }, [featuresQuery.data, perStreamQty, flatOn])

  const quoteQuery = useQuery({
    queryKey: ["license-quote", orgId, duration, itemsPayload],
    enabled: !!orgId && itemsPayload.length > 0,
    queryFn: async () => {
      const response = await api.post<Quote & { items: unknown[] }>("/licenses/build", {
        organizationId: orgId,
        items: itemsPayload,
        duration,
        currency: "GHS",
      })
      return response.data
    },
  })

  const payMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post<{
        authorizationUrl: string
        transactionId: string
      }>("/payments/initialize-license", {
        organizationId: orgId,
        items: itemsPayload,
        duration,
        currency: "GHS",
        provider: "paystack",
      })
      return response.data
    },
    onSuccess: (data) => {
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl
      }
    },
    onError: () => {
      setError("Payment initialization failed.")
    },
  })

  if (!me.isLoading && !orgId) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Your account is not linked to an organization yet. Register or join an organization, then return here to
        purchase a license bundle.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Buy License</h1>
        <p className="text-sm text-muted-foreground">
          Create your license, you only pay for what you need. NB: All Plans Are Billed Monthly.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="ui-surface ui-surface-hover space-y-3 p-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">Modules</Label>
            <span className="rounded-full border bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              Pick what you need
            </span>
          </div>
          <div className="hidden items-center justify-between px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:flex">
            <div className="grid w-full grid-cols-[24px_minmax(0,1fr)_128px_96px] items-center gap-3">
              <span className="text-center"> </span>
              <span>Module</span>
              <span className="text-left">Price</span>
              <span className="text-left">Qty</span>
            </div>
          </div>
          <div className="space-y-2">
            {displayFeatures.map((f) =>
              f.unit === "per_stream" ? (
                <div
                  key={f.key}
                  className="grid grid-cols-[24px_minmax(0,1fr)_128px_96px] items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background hover:shadow-md"
                >
                  <input
                    type="checkbox"
                    checked={(perStreamQty[f.key] ?? 0) > 0}
                    onChange={(e) =>
                      setPerStreamQty((prev) => ({
                        ...prev,
                        [f.key]: e.target.checked ? Math.max(1, prev[f.key] ?? 1) : 0,
                      }))
                    }
                    className="size-4 accent-primary"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{f.name}</p>
                  </div>
                  <div className="flex justify-center">
                    <span className="inline-flex min-w-[92px] justify-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground whitespace-nowrap">
                      GHS {(f.priceCents / 100).toFixed(2)}
                    </span>
                  </div>
                  <Input
                    className="h-9 w-24 justify-self-end text-right shadow-inner"
                    type="number"
                    min={0}
                    value={perStreamQty[f.key] ?? 0}
                    onChange={(e) =>
                      setPerStreamQty((prev) => ({
                        ...prev,
                        [f.key]: Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                      }))
                    }
                  />
                </div>
              ) : (
                <label
                  key={f.key}
                  className="grid cursor-pointer grid-cols-[24px_minmax(0,1fr)_128px_96px] items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-background hover:shadow-md"
                >
                  <input
                    type="checkbox"
                    checked={!!flatOn[f.key]}
                    onChange={(e) =>
                      setFlatOn((prev) => ({ ...prev, [f.key]: e.target.checked }))
                    }
                    className="size-4 accent-primary"
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{f.name}</p>
                  </div>
                  <div className="flex justify-center">
                    <span className="inline-flex min-w-[92px] justify-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground whitespace-nowrap">
                      GHS {(f.priceCents / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-end">
                    {flatOn[f.key] ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        Added
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>
                </label>
              ),
            )}
          </div>
        </div>

        <div className="space-y-4 md:sticky md:top-24 md:self-start">
          <div className="ui-surface space-y-2 p-4">
            <Label>License duration</Label>
            <select
              className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-inner"
              value={duration}
              onChange={(e) => setDuration(e.target.value as Duration)}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div className="ui-surface ui-glow p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-3xl font-bold tracking-tight text-primary">
              {quoteQuery.isLoading
                ? "Calculating..."
                : `${quoteQuery.data?.currency ?? "GHS"} ${(
                    (quoteQuery.data?.totalCents ?? 0) / 100
                  ).toFixed(2)}`}
            </p>
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={payMutation.isPending || !orgId || itemsPayload.length === 0}
            onClick={() => payMutation.mutate()}
          >
            {payMutation.isPending ? "Processing..." : "Pay Now"}
          </Button>
        </div>
      </div>

      {!featuresQuery.isLoading && itemsPayload.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Select at least one module to continue.
        </p>
      )}

      {featuresQuery.isError && (
        <p className="text-sm text-destructive">Could not load module catalog.</p>
      )}
      {quoteQuery.isError && (
        <p className="text-sm text-destructive">
          Could not calculate total in GHS. Check your exchange-rate settings.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

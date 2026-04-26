"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { api } from "@/lib/api"
import { useMe } from "@/lib/me"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

type CatalogFeature = {
  key: string
  name: string
  priceCents: number
  unit: "per_stream" | "flat"
  active: boolean
}

const LEGACY_REMOVED_FEATURE_KEYS = new Set(["abr", "abr_hls", "signed_hls", "webrtc", "sign_hls"])

function centsToDollars(cents: number) {
  return (cents / 100).toFixed(2)
}

function dollarsToCents(raw: string) {
  const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ""))
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100)
}

export default function ModulesPricingPage() {
  const me = useMe()
  const queryClient = useQueryClient()
  const isOwner = me.data?.platformRole === "OWNER"
  const [prices, setPrices] = useState<Record<string, string>>({})
  const [names, setNames] = useState<Record<string, string>>({})

  const featuresQuery = useQuery({
    queryKey: ["admin-features"],
    enabled: isOwner === true,
    queryFn: async () => {
      const response = await api.get<CatalogFeature[]>("/admin/features")
      return response.data.filter((feature) => !LEGACY_REMOVED_FEATURE_KEYS.has(feature.key))
    },
  })

  const patchMutation = useMutation({
    mutationFn: async (args: { key: string; body: Partial<CatalogFeature> }) => {
      const response = await api.patch(`/admin/features/${encodeURIComponent(args.key)}`, args.body)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-features"] })
      await queryClient.invalidateQueries({ queryKey: ["features"] })
    },
  })

  if (!me.isLoading && !isOwner) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Only the platform owner can edit module catalog pricing.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Module pricing</h1>
        <p className="text-sm text-muted-foreground">
          Set per-stream and flat module prices (USD cents internally). These keys must match LeoCastra Studio
          license validation (for example <code className="rounded bg-muted px-1">rtmp_streams</code>,{" "}
          <code className="rounded bg-muted px-1">ott_stream</code>,{" "}
          <code className="rounded bg-muted px-1">recording</code>).
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Price (USD)</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Save</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {featuresQuery.data?.map((f) => {
              const priceField =
                prices[f.key] !== undefined ? prices[f.key] : centsToDollars(f.priceCents)
              const nameField = names[f.key] !== undefined ? names[f.key] : f.name
              return (
                <TableRow key={f.key}>
                  <TableCell className="font-mono text-xs">{f.key}</TableCell>
                  <TableCell>
                    <Input
                      className="h-8 max-w-[200px]"
                      value={nameField}
                      onChange={(e) =>
                        setNames((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                    />
                  </TableCell>
                  <TableCell className="text-sm">{f.unit}</TableCell>
                  <TableCell>
                    <div className="flex max-w-[120px] items-center gap-1">
                      <span className="text-xs text-muted-foreground">$</span>
                      <Input
                        className="h-8"
                        inputMode="decimal"
                        value={priceField}
                        onChange={(e) =>
                          setPrices((prev) => ({ ...prev, [f.key]: e.target.value }))
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={f.active}
                      onChange={(e) => {
                        patchMutation.mutate({
                          key: f.key,
                          body: { active: e.target.checked },
                        })
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={patchMutation.isPending}
                      onClick={() => {
                        const name = (names[f.key] ?? f.name).trim()
                        const priceCents = dollarsToCents(
                          prices[f.key] ?? centsToDollars(f.priceCents),
                        )
                        patchMutation.mutate({
                          key: f.key,
                          body: {
                            name: name || f.name,
                            priceCents,
                          },
                        })
                      }}
                    >
                      Save row
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {featuresQuery.isError && (
        <p className="text-sm text-destructive">Could not load features. Sign in as platform owner.</p>
      )}
    </div>
  )
}

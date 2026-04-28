"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useMe } from "@/lib/me"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type KeysResponse = { count: number; keys: string[] }
type LicensesResponse = {
  count: number
  licenses: Array<{
    id: string
    key: string
    status: string
    organizationId: string
    expiresAt: string | null
    activatedAt?: string | null
  }>
}

type CatalogFeature = {
  key: string
  name: string
  priceCents: number
  unit: "per_stream" | "flat"
}

type CustomerOrg = {
  id: string
  name: string
  slug: string
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function LicenseGeneratorPage() {
  const me = useMe()
  const isOwner = me.data?.platformRole === "OWNER"
  const [tab, setTab] = useState<"keys" | "licenses">("keys")
  const [count, setCount] = useState(10)
  const [note, setNote] = useState("")

  // Fully-formed license inputs (same selection model as Buy License)
  const [organizationId, setOrganizationId] = useState("")
  const [duration, setDuration] = useState<"monthly" | "yearly">("monthly")
  const [seats, setSeats] = useState(1)
  const [perStreamQty, setPerStreamQty] = useState<Record<string, number>>({})
  const [flatOn, setFlatOn] = useState<Record<string, boolean>>({})

  const customersQuery = useQuery({
    queryKey: ["admin-customers"],
    enabled: isOwner === true,
    queryFn: async () => {
      const res = await api.get<Array<{ id: string; name: string; slug: string }>>("/admin/customers")
      return res.data
    },
  })

  const featuresQuery = useQuery({
    queryKey: ["features"],
    enabled: isOwner === true,
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

  const genKeys = useMutation({
    mutationFn: async () => {
      const res = await api.post<KeysResponse>("/admin/licenses/generate-keys", {
        count,
        note: note.trim() || undefined,
      })
      return res.data
    },
    onSuccess: (data) => {
      downloadCsv(`license-keys-${Date.now()}.csv`, [["key"], ...data.keys.map((k) => [k])])
    },
  })

  const genLicenses = useMutation({
    mutationFn: async () => {
      if (!organizationId.trim()) throw new Error("Organization is required")
      if (itemsPayload.length === 0) throw new Error("Pick at least one module")
      const res = await api.post<LicensesResponse>("/admin/licenses/generate", {
        count,
        note: note.trim() || undefined,
        organizationId: organizationId.trim(),
        duration,
        seats,
        items: itemsPayload,
        currency: "GHS",
      })
      return res.data
    },
    onSuccess: (data) => {
      downloadCsv(`licenses-${Date.now()}.csv`, [
        ["id", "key", "status", "organizationId", "expiresAt", "activatedAt"],
        ...data.licenses.map((l) => [
          l.id,
          l.key,
          l.status,
          l.organizationId,
          l.expiresAt ?? "",
          l.activatedAt ?? "",
        ]),
      ])
    },
  })

  if (!me.isLoading && !isOwner) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Only the platform owner can generate licenses.
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">License generator</h1>
        <p className="text-sm text-muted-foreground">Generate license keys in bulk or create fully-formed licenses.</p>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === "keys" ? "default" : "outline"} onClick={() => setTab("keys")}>
          Keys only
        </Button>
        <Button variant={tab === "licenses" ? "default" : "outline"} onClick={() => setTab("licenses")}>
          Fully-formed
        </Button>
      </div>

      <div className="space-y-4 rounded-lg border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Count</Label>
            <Input
              type="number"
              min={1}
              max={tab === "keys" ? 500 : 200}
              value={count}
              onChange={(e) => setCount(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
            />
          </div>
          <div className="space-y-1">
            <Label>Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / batch label" />
          </div>
        </div>

        {tab === "licenses" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Customer organization</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              >
                <option value="">Select organization…</option>
                {(customersQuery.data ?? []).map((org: CustomerOrg) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Duration</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value as "monthly" | "yearly")}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Seats</Label>
                <Input
                  type="number"
                  min={1}
                  value={seats}
                  onChange={(e) => setSeats(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                />
              </div>
            </div>
            <div className="ui-surface ui-surface-hover space-y-3 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Modules</Label>
                <span className="rounded-full border bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  Pick what they need
                </span>
              </div>
              <div className="space-y-2">
                {displayFeatures.map((f) =>
                  f.unit === "per_stream" ? (
                    <div
                      key={f.key}
                      className="grid grid-cols-[24px_minmax(0,1fr)_128px_96px] items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 shadow-sm"
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
                        className="h-9 w-24 justify-self-end text-right"
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
                      className="grid cursor-pointer grid-cols-[24px_minmax(0,1fr)_128px_96px] items-center gap-3 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm shadow-sm"
                    >
                      <input
                        type="checkbox"
                        checked={!!flatOn[f.key]}
                        onChange={(e) => setFlatOn((prev) => ({ ...prev, [f.key]: e.target.checked }))}
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
              {!featuresQuery.isLoading && itemsPayload.length === 0 ? (
                <p className="text-xs text-muted-foreground">Select at least one module.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          {tab === "keys" ? (
            <Button onClick={() => genKeys.mutate()} disabled={genKeys.isPending}>
              {genKeys.isPending ? "Generating…" : "Generate + download CSV"}
            </Button>
          ) : (
            <Button
              onClick={() => genLicenses.mutate()}
              disabled={genLicenses.isPending || !organizationId.trim() || itemsPayload.length === 0}
            >
              {genLicenses.isPending ? "Generating…" : "Generate + download CSV"}
            </Button>
          )}
        </div>

        {(genKeys.isError || genLicenses.isError) && (
          <p className="text-sm text-destructive">Request failed. Check you are logged in as platform owner.</p>
        )}
      </div>
    </div>
  )
}


"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useMe } from "@/lib/me"
import { useMutation } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type KeysResponse = { count: number; keys: string[] }
type LicensesResponse = {
  count: number
  licenses: Array<{ id: string; key: string; status: string; organizationId: string; expiresAt: string | null }>
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

  // Fully-formed license inputs
  const [organizationId, setOrganizationId] = useState("")
  const [duration, setDuration] = useState<"monthly" | "yearly">("monthly")
  const [seats, setSeats] = useState(1)
  const [itemsJson, setItemsJson] = useState('[{"featureKey":"rtmp_streams","quantity":1}]')

  const parsedItems = useMemo(() => {
    try {
      const v = JSON.parse(itemsJson) as Array<{ featureKey: string; quantity: number }>
      return Array.isArray(v) ? v : null
    } catch {
      return null
    }
  }, [itemsJson])

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
      if (!parsedItems) throw new Error("Invalid items JSON")
      const res = await api.post<LicensesResponse>("/admin/licenses/generate", {
        count,
        note: note.trim() || undefined,
        organizationId: organizationId.trim(),
        duration,
        seats,
        items: parsedItems,
        currency: "GHS",
      })
      return res.data
    },
    onSuccess: (data) => {
      downloadCsv(`licenses-${Date.now()}.csv`, [
        ["id", "key", "status", "organizationId", "expiresAt"],
        ...data.licenses.map((l) => [l.id, l.key, l.status, l.organizationId, l.expiresAt ?? ""]),
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
              <Label>Organization ID</Label>
              <Input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} placeholder="UUID" />
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
            <div className="space-y-1">
              <Label>Items JSON</Label>
              <textarea
                className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                value={itemsJson}
                onChange={(e) => setItemsJson(e.target.value)}
              />
              {!parsedItems ? (
                <p className="text-sm text-destructive">Invalid items JSON</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Format:{" "}
                  <code className="rounded bg-muted px-1">
                    {"[{\"featureKey\":\"rtmp_streams\",\"quantity\":1}]"}
                  </code>
                </p>
              )}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          {tab === "keys" ? (
            <Button onClick={() => genKeys.mutate()} disabled={genKeys.isPending}>
              {genKeys.isPending ? "Generating…" : "Generate + download CSV"}
            </Button>
          ) : (
            <Button onClick={() => genLicenses.mutate()} disabled={genLicenses.isPending || !parsedItems}>
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


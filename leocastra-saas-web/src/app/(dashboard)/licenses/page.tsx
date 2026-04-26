"use client"

import { Button } from "@/components/ui/button"
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
import { useMemo } from "react"
import { useRouter } from "next/navigation"

type LicenseItemRow = {
  featureKey: string
  quantity: number
  name: string
  unit: "per_stream" | "flat"
}

type License = {
  id: string
  key: string
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED"
  seats: number
  expiresAt: string | null
  organization?: { id: string; name: string; slug: string }
  items: LicenseItemRow[]
}

export default function LicensesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const meQuery = useMe()
  const isPlatformOwner = meQuery.data?.platformRole === "OWNER"

  const licensesQuery = useQuery({
    queryKey: ["licenses"],
    queryFn: async () => {
      const response = await api.get<License[]>("/licenses")
      return response.data
    },
  })

  const statusMutation = useMutation({
    mutationFn: async (args: { key: string; status: License["status"] }) => {
      const response = await api.patch(`/licenses/${encodeURIComponent(args.key)}`, {
        status: args.status,
      })
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["licenses"] })
    },
  })

  const featureSummary = useMemo(() => {
    return (items: LicenseItemRow[]) =>
      items
        .map((i) =>
          i.unit === "per_stream" ? `${i.name}×${i.quantity}` : i.name,
        )
        .join(", ")
  }, [])

  const loading = licensesQuery.isLoading || meQuery.isLoading

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Licenses</h1>
          <p className="text-sm text-muted-foreground">
            Issue feature bundles per organization. Keys are validated by the LeoCastra backend via{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">/api/license/validate</code>.
          </p>
        </div>
        <Button onClick={() => router.push("/license-store")} disabled={loading}>
          Buy license
        </Button>
      </div>

      <div className="ui-surface ui-surface-hover overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>License key</TableHead>
              {isPlatformOwner && <TableHead>Organization</TableHead>}
              <TableHead>Features</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {licensesQuery.data?.map((license) => (
              <TableRow key={license.id} className="transition-colors hover:bg-muted/35">
                <TableCell className="max-w-[200px] font-mono text-xs">{license.key}</TableCell>
                {isPlatformOwner && (
                  <TableCell className="text-sm">
                    {license.organization?.name ?? "—"}
                  </TableCell>
                )}
                <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                  {featureSummary(license.items) || "—"}
                </TableCell>
                <TableCell>
                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      license.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-700"
                        : license.status === "SUSPENDED"
                          ? "bg-amber-100 text-amber-700"
                          : license.status === "REVOKED"
                            ? "bg-red-100 text-red-800"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {license.status}
                  </span>
                </TableCell>
                <TableCell className="text-sm">
                  {license.expiresAt
                    ? new Date(license.expiresAt).toLocaleDateString()
                    : "No expiry"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-wrap justify-end gap-1">
                    {license.status !== "ACTIVE" && license.status !== "REVOKED" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({ key: license.key, status: "ACTIVE" })
                        }
                      >
                        Activate
                      </Button>
                    )}
                    {license.status === "ACTIVE" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({ key: license.key, status: "SUSPENDED" })
                        }
                      >
                        Suspend
                      </Button>
                    )}
                    {license.status !== "REVOKED" && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={statusMutation.isPending}
                        onClick={() =>
                          statusMutation.mutate({ key: license.key, status: "REVOKED" })
                        }
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {!licensesQuery.isLoading && licensesQuery.data?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={isPlatformOwner ? 6 : 5}
                  className="text-center text-muted-foreground"
                >
                  No licenses found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {licensesQuery.isError && (
        <p className="text-sm text-destructive">
          Failed to load license data. Make sure the API is running and you are signed in.
        </p>
      )}
    </div>
  )
}

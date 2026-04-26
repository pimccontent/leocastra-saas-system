"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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

type Transaction = {
  id: string
  provider: string
  amountCents: number
  currency: string
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "CANCELLED"
  createdAt: string
  plan?: {
    name?: string
    code?: string
  }
}

type TransactionStatus = Transaction["status"]
const statusOptions: TransactionStatus[] = [
  "PENDING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
]

function statusBadgeClass(status: Transaction["status"]) {
  switch (status) {
    case "SUCCEEDED":
      return "bg-emerald-100 text-emerald-700"
    case "PENDING":
      return "bg-amber-100 text-amber-700"
    case "FAILED":
    case "CANCELLED":
      return "bg-red-100 text-red-700"
    case "REFUNDED":
      return "bg-blue-100 text-blue-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export default function BillingPage() {
  const meQuery = useMe()
  const queryClient = useQueryClient()
  const isOwner = meQuery.data?.platformRole === "OWNER"
  const [editedStatus, setEditedStatus] = useState<Record<string, TransactionStatus>>({})
  const transactionsQuery = useQuery({
    queryKey: ["transactions", isOwner ? "owner" : "org"],
    queryFn: async () => {
      const response = await api.get<Transaction[]>(
        isOwner ? "/admin/transactions" : "/transactions",
      )
      return response.data
    },
  })

  const transactions = transactionsQuery.data ?? []

  const updateTxMutation = useMutation({
    mutationFn: async (args: { id: string; status: TransactionStatus }) => {
      const response = await api.patch(`/admin/transactions/${args.id}`, {
        status: args.status,
      })
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions", "owner"] })
    },
  })

  const deleteTxMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete(`/admin/transactions/${id}`)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transactions", "owner"] })
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isOwner ? "Payments" : "Billing"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Manage platform payments and transaction records."
            : "Organization payment history and transaction status."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isOwner ? "Payments CRUD" : "Payment History"}</CardTitle>
          <CardDescription>
            {isOwner
              ? "Update status or remove invalid transaction records."
              : "All recent billing transactions."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                {isOwner && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{tx.plan?.name ?? tx.plan?.code ?? "-"}</TableCell>
                  <TableCell className="uppercase">{tx.provider}</TableCell>
                  <TableCell>
                    {tx.currency} {(tx.amountCents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {isOwner ? (
                      <select
                        value={editedStatus[tx.id] ?? tx.status}
                        onChange={(e) =>
                          setEditedStatus((prev) => ({
                            ...prev,
                            [tx.id]: e.target.value as TransactionStatus,
                          }))
                        }
                        className="rounded-md border bg-background px-2 py-1 text-xs"
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${statusBadgeClass(
                          tx.status,
                        )}`}
                      >
                        {tx.status}
                      </span>
                    )}
                  </TableCell>
                  {isOwner && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={updateTxMutation.isPending}
                          onClick={() =>
                            updateTxMutation.mutate({
                              id: tx.id,
                              status: editedStatus[tx.id] ?? tx.status,
                            })
                          }
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={deleteTxMutation.isPending}
                          onClick={() => {
                            const ok = window.confirm(
                              `Delete transaction ${tx.id}? This cannot be undone.`,
                            )
                            if (ok) {
                              deleteTxMutation.mutate(tx.id)
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}

              {!transactionsQuery.isLoading && transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isOwner ? 6 : 5} className="text-center text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {transactionsQuery.isError && (
            <p className="mt-3 text-sm text-destructive">
              Failed to load transactions. Make sure backend is running and authenticated.
            </p>
          )}
          {updateTxMutation.isError && (
            <p className="mt-2 text-sm text-destructive">Could not update transaction.</p>
          )}
          {deleteTxMutation.isError && (
            <p className="mt-2 text-sm text-destructive">Could not delete transaction.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

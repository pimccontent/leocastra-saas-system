"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { api } from "@/lib/api"
import { useMe } from "@/lib/me"
import { useQueries } from "@tanstack/react-query"

type License = {
  id: string
  key: string
  status: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "REVOKED"
  createdAt: string
}

type Transaction = {
  id: string
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "CANCELLED"
  provider: string
  amountCents: number
  currency: string
  createdAt: string
}

type AdminOverview = {
  totalCustomers: number
  totalOrganizations: number
  totalLicenses: number
  activeLicenses: number
  totalTransactions: number
  revenueCents: number
}

type Customer = {
  id: string
  name: string
  owner: { email: string }
  memberships: Array<{ id: string }>
}

export default function Home() {
  const meQuery = useMe()
  const isOwner = meQuery.data?.platformRole === "OWNER"
  const [licensesQuery, transactionsQuery, ownerOverviewQuery, ownerCustomersQuery] = useQueries({
    queries: [
      {
        queryKey: ["licenses"],
        queryFn: async () => {
          const response = await api.get<License[]>("/licenses")
          return response.data
        },
      },
      {
        queryKey: ["transactions"],
        queryFn: async () => {
          const response = await api.get<Transaction[]>("/transactions")
          return response.data
        },
      },
      {
        queryKey: ["admin-overview"],
        queryFn: async () => {
          const response = await api.get<AdminOverview>("/admin/overview")
          return response.data
        },
        enabled: isOwner,
      },
      {
        queryKey: ["admin-customers"],
        queryFn: async () => {
          const response = await api.get<Customer[]>("/admin/customers")
          return response.data
        },
        enabled: isOwner,
      },
    ],
  })

  const licenses = licensesQuery.data ?? []
  const transactions = transactionsQuery.data ?? []
  const totalLicenses = isOwner
    ? (ownerOverviewQuery.data?.totalLicenses ?? 0)
    : licenses.length
  const activeLicenses = isOwner
    ? (ownerOverviewQuery.data?.activeLicenses ?? 0)
    : licenses.filter((item) => item.status === "ACTIVE").length
  const totalTransactions = isOwner
    ? (ownerOverviewQuery.data?.totalTransactions ?? 0)
    : transactions.length

  const recentActivity = [
    ...licenses.map((license) => ({
      id: `license-${license.id}`,
      timestamp: new Date(license.createdAt).getTime(),
      label: `License created: ${license.key}`,
      meta: license.status,
    })),
    ...transactions.map((tx) => ({
      id: `tx-${tx.id}`,
      timestamp: new Date(tx.createdAt).getTime(),
      label: `Transaction ${tx.status.toLowerCase()} via ${tx.provider}`,
      meta: `${(tx.amountCents / 100).toFixed(2)} ${tx.currency}`,
    })),
  ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8)

  const isLoading =
    licensesQuery.isLoading ||
    transactionsQuery.isLoading ||
    ownerOverviewQuery.isLoading ||
    ownerCustomersQuery.isLoading
  const isError =
    licensesQuery.isError ||
    transactionsQuery.isError ||
    ownerOverviewQuery.isError ||
    ownerCustomersQuery.isError

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-muted-foreground">
        {isOwner
          ? "Owner business overview: customers, billing, and platform data."
          : "Organization overview of licenses and transaction activity."}
      </p>

      {isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Could not load dashboard data. Confirm backend is running and you are logged in.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="ui-surface ui-surface-hover">
          <CardHeader>
            <CardDescription>{isOwner ? "Total Customers" : "Total Licenses"}</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading
                ? "-"
                : isOwner
                  ? (ownerOverviewQuery.data?.totalCustomers ?? 0)
                  : totalLicenses}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="ui-surface ui-surface-hover">
          <CardHeader>
            <CardDescription>Active Licenses</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? "-" : activeLicenses}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="ui-surface ui-surface-hover">
          <CardHeader>
            <CardDescription>Total Transactions</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? "-" : totalTransactions}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {isOwner && (
        <Card className="ui-surface ui-surface-hover">
          <CardHeader>
            <CardTitle>Customer Accounts</CardTitle>
            <CardDescription>Recent organizations on the platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(ownerCustomersQuery.data ?? []).slice(0, 8).map((customer) => (
              <div
                key={customer.id}
                className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <p className="text-sm">{customer.name}</p>
                <p className="text-xs text-muted-foreground">
                  {customer.owner.email} · {customer.memberships.length} members
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="ui-surface ui-surface-hover">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest license and payment events</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!isLoading && recentActivity.length === 0 && (
            <p className="text-sm text-muted-foreground">No recent activity yet.</p>
          )}

          {recentActivity.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-border/70 bg-background/60 px-3 py-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <p className="text-sm">{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.meta}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

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
import { useQuery } from "@tanstack/react-query"

type OrganizationMember = {
  id: string
  role: "OWNER" | "ADMIN" | "MEMBER"
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
}

type Organization = {
  id: string
  name: string
  slug: string
  memberships: OrganizationMember[]
}

type Customer = {
  id: string
  name: string
  slug: string
  owner: {
    email: string
    firstName: string | null
    lastName: string | null
  }
  memberships: Array<{ id: string }>
  licenses: Array<{ id: string; status: string }>
}

function roleBadgeClass(role: OrganizationMember["role"]) {
  switch (role) {
    case "OWNER":
      return "bg-purple-100 text-purple-700"
    case "ADMIN":
      return "bg-blue-100 text-blue-700"
    default:
      return "bg-muted text-muted-foreground"
  }
}

export default function OrganizationsPage() {
  const meQuery = useMe()
  const isOwner = meQuery.data?.platformRole === "OWNER"
  const organizationsQuery = useQuery({
    queryKey: ["organizations", isOwner ? "owner" : "org"],
    queryFn: async () => {
      const response = await api.get<Organization[] | Customer[]>(
        isOwner ? "/admin/customers" : "/organizations",
      )
      return response.data
    },
  })

  const organizations = organizationsQuery.data ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Owner customer directory and business account details."
            : "Read-only view of your organization members and roles."}
        </p>
      </div>

      {isOwner
        ? (organizations as Customer[]).map((customer) => (
            <Card key={customer.id}>
              <CardHeader>
                <CardTitle>{customer.name}</CardTitle>
                <CardDescription>{customer.slug}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm md:grid-cols-3">
                  <p>
                    <span className="text-muted-foreground">Owner: </span>
                    {customer.owner.email}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Members: </span>
                    {customer.memberships.length}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Licenses: </span>
                    {customer.licenses.length}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        : (organizations as Organization[]).map((org) => (
        <Card key={org.id}>
          <CardHeader>
            <CardTitle>{org.name}</CardTitle>
            <CardDescription>{org.slug}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {org.memberships.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      {(member.user.firstName ?? "").trim() ||
                        (member.user.lastName ?? "").trim()
                        ? `${member.user.firstName ?? ""} ${member.user.lastName ?? ""}`.trim()
                        : "Unknown"}
                    </TableCell>
                    <TableCell>{member.user.email}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${roleBadgeClass(member.role)}`}
                      >
                        {member.role}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {org.memberships.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No members found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {!organizationsQuery.isLoading && organizations.length === 0 && (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            No organizations found.
          </CardContent>
        </Card>
      )}

      {organizationsQuery.isError && (
        <p className="text-sm text-destructive">
          Failed to load organizations. Make sure backend is running and authenticated.
        </p>
      )}
    </div>
  )
}

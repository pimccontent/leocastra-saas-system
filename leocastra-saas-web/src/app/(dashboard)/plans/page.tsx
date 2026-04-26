"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/lib/api"
import { useMe } from "@/lib/me"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"

type Plan = {
  id: string
  code: string
  name: string
  price: number
  currency: string
  maxStreams: number
  features: Record<string, unknown>
}

type PlanFormState = {
  name: string
  price: string
  currency: string
  maxStreams: string
  features: string
}

const emptyForm: PlanFormState = {
  name: "",
  price: "",
  currency: "USD",
  maxStreams: "1",
  features: '{\n  "ott_stream": true,\n  "restreaming": true,\n  "cameraBridge": false\n}',
}

export default function PlansPage() {
  const queryClient = useQueryClient()
  const meQuery = useMe()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [form, setForm] = useState<PlanFormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)

  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const response = await api.get<Plan[]>("/plans")
      return response.data
    },
  })

  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await api.post("/plans", payload)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["plans"] })
      setCreateOpen(false)
      resetForm()
    },
  })

  const editMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string
      payload: Record<string, unknown>
    }) => {
      const response = await api.patch(`/plans/${id}`, payload)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["plans"] })
      setEditOpen(false)
      setCurrentPlan(null)
      resetForm()
    },
  })

  const busy = createMutation.isPending || editMutation.isPending
  const canManagePlans = meQuery.data?.platformRole === "OWNER"

  const submitLabel = useMemo(() => {
    if (createMutation.isPending) return "Saving..."
    if (editMutation.isPending) return "Updating..."
    return "Save"
  }, [createMutation.isPending, editMutation.isPending])

  function resetForm() {
    setForm(emptyForm)
    setFormError(null)
  }

  function openCreate() {
    resetForm()
    setCreateOpen(true)
  }

  function openEdit(plan: Plan) {
    setCurrentPlan(plan)
    setForm({
      name: plan.name,
      price: String(plan.price),
      currency: plan.currency,
      maxStreams: String(plan.maxStreams),
      features: JSON.stringify(plan.features, null, 2),
    })
    setFormError(null)
    setEditOpen(true)
  }

  function buildPayload() {
    const name = form.name.trim()
    const price = Number(form.price)
    const maxStreams = Number(form.maxStreams)
    const currency = form.currency.trim().toUpperCase()

    if (!name) throw new Error("Name is required")
    if (!Number.isFinite(price) || price < 0)
      throw new Error("Price must be a valid non-negative number")
    if (!Number.isInteger(maxStreams) || maxStreams < 1)
      throw new Error("Max streams must be an integer >= 1")
    if (!currency) throw new Error("Currency is required")

    let features: Record<string, unknown>
    try {
      const parsed = JSON.parse(form.features)
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        throw new Error("Features must be a JSON object")
      }
      features = parsed as Record<string, unknown>
    } catch {
      throw new Error("Features must be valid JSON")
    }

    return { name, price, currency, maxStreams, features }
  }

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    try {
      const payload = buildPayload()
      createMutation.mutate(payload)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invalid form")
    }
  }

  function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!currentPlan) return
    setFormError(null)
    try {
      const payload = buildPayload()
      editMutation.mutate({ id: currentPlan.id, payload })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Invalid form")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Manage pricing, limits, and plan feature flags.
          </p>
        </div>
        {canManagePlans && <Button onClick={openCreate}>Create plan</Button>}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Max Streams</TableHead>
              <TableHead>Features</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plansQuery.data?.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>{plan.code}</TableCell>
                <TableCell>
                  {plan.currency} {(plan.price / 100).toFixed(2)}
                </TableCell>
                <TableCell>{plan.maxStreams}</TableCell>
                <TableCell className="max-w-xs">
                  <pre className="max-h-28 overflow-auto rounded-md bg-muted p-2 text-xs">
                    {JSON.stringify(plan.features, null, 2)}
                  </pre>
                </TableCell>
                <TableCell className="text-right">
                  {canManagePlans ? (
                    <Button variant="outline" size="sm" onClick={() => openEdit(plan)}>
                      Edit
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">View only</span>
                  )}
                </TableCell>
              </TableRow>
            ))}

            {!plansQuery.isLoading && plansQuery.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No plans found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {plansQuery.isError && (
        <p className="text-sm text-destructive">
          Failed to load plans. Make sure backend is running and authenticated.
        </p>
      )}

      {canManagePlans && (
        <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create plan</DialogTitle>
            <DialogDescription>
              Add a new billing plan with limits and feature flags.
            </DialogDescription>
          </DialogHeader>
          <PlanForm
            form={form}
            setForm={setForm}
            formError={formError}
            busy={busy}
            submitLabel={submitLabel}
            onSubmit={handleCreateSubmit}
          />
        </DialogContent>
        </Dialog>
      )}

      {canManagePlans && (
        <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setCurrentPlan(null)
            resetForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit plan</DialogTitle>
            <DialogDescription>
              Update plan details and JSON features.
            </DialogDescription>
          </DialogHeader>
          <PlanForm
            form={form}
            setForm={setForm}
            formError={formError}
            busy={busy}
            submitLabel={submitLabel}
            onSubmit={handleEditSubmit}
          />
        </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function PlanForm({
  form,
  setForm,
  formError,
  busy,
  submitLabel,
  onSubmit,
}: {
  form: PlanFormState
  setForm: React.Dispatch<React.SetStateAction<PlanFormState>>
  formError: string | null
  busy: boolean
  submitLabel: string
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            value={form.currency}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="price">Price (minor units)</Label>
          <Input
            id="price"
            type="number"
            min={0}
            value={form.price}
            onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="maxStreams">Max Streams</Label>
          <Input
            id="maxStreams"
            type="number"
            min={1}
            value={form.maxStreams}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, maxStreams: e.target.value }))
            }
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="features">Features JSON</Label>
        <Textarea
          id="features"
          rows={10}
          value={form.features}
          onChange={(e) => setForm((prev) => ({ ...prev, features: e.target.value }))}
        />
      </div>

      {formError && <p className="text-sm text-destructive">{formError}</p>}

      <Button type="submit" disabled={busy} className="w-full">
        {submitLabel}
      </Button>
    </form>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useMe } from "@/lib/me"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

type PlatformSettingsResponse = {
  billing: {
    baseCurrency: string
    exchangeRates: Record<string, number>
  }
  paystack: {
    publicKey: string | null
    secretKeyConfigured: boolean
    webhookSecretConfigured: boolean
  }
  binancePay: {
    apiKey: string | null
    merchantId: string | null
    secretKeyConfigured: boolean
    webhookSecretConfigured: boolean
  }
}

type FormState = {
  billingBaseCurrency: string
  exchangeRatesJson: string
  paystackPublicKey: string
  paystackSecretKey: string
  paystackWebhookSecret: string
  binancePayApiKey: string
  binancePaySecretKey: string
  binancePayMerchantId: string
  binancePayWebhookSecret: string
}

const emptyForm: FormState = {
  billingBaseCurrency: "USD",
  exchangeRatesJson: "{\n  \"USD\": 1,\n  \"GHS\": 15\n}",
  paystackPublicKey: "",
  paystackSecretKey: "",
  paystackWebhookSecret: "",
  binancePayApiKey: "",
  binancePaySecretKey: "",
  binancePayMerchantId: "",
  binancePayWebhookSecret: "",
}

export default function PaymentsConfigPage() {
  const me = useMe()
  const queryClient = useQueryClient()
  const isOwner = me.data?.platformRole === "OWNER"
  const [form, setForm] = useState<FormState>(emptyForm)
  const [message, setMessage] = useState<string | null>(null)

  const settingsQuery = useQuery({
    queryKey: ["platform-settings"],
    enabled: isOwner === true,
    queryFn: async () => {
      const response = await api.get<PlatformSettingsResponse>("/admin/platform-settings")
      return response.data
    },
  })

  useEffect(() => {
    const d = settingsQuery.data
    if (!d) return
    setForm((prev) => ({
      ...prev,
      billingBaseCurrency: d.billing.baseCurrency ?? "USD",
      exchangeRatesJson: JSON.stringify(d.billing.exchangeRates ?? { USD: 1 }, null, 2),
      paystackPublicKey: d.paystack.publicKey ?? "",
      binancePayApiKey: d.binancePay.apiKey ?? "",
      binancePayMerchantId: d.binancePay.merchantId ?? "",
    }))
  }, [settingsQuery.data])

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const response = await api.patch("/admin/platform-settings", payload)
      return response.data
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["platform-settings"] })
      setMessage("Saved.")
      setForm((f) => ({
        ...f,
        paystackSecretKey: "",
        paystackWebhookSecret: "",
        binancePaySecretKey: "",
        binancePayWebhookSecret: "",
      }))
    },
  })

  if (!me.isLoading && !isOwner) {
    return (
      <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        Only the platform owner can configure payment gateways.
      </div>
    )
  }

  const ps = settingsQuery.data?.paystack
  const bp = settingsQuery.data?.binancePay

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payment gateways</h1>
        <p className="text-sm text-muted-foreground">
          Store Paystack and Binance Pay credentials for live checkout. Leave a secret field empty to keep the
          current value; use a single space and save to clear (optional). Webhook URLs point to{" "}
          <code className="rounded bg-muted px-1 text-xs">POST /api/payments/webhook/paystack</code> or{" "}
          <code className="rounded bg-muted px-1 text-xs">binancepay</code>.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">Billing currency and exchange rates</h2>
        <p className="text-xs text-muted-foreground">
          All module prices are monthly in your base currency. Yearly checkout always applies 12x monthly amount
          before conversion. Exchange rates map means: <code className="rounded bg-muted px-1">1 base = rate target</code>.
        </p>
        <div className="space-y-1">
          <Label htmlFor="baseCurrency">Base currency</Label>
          <Input
            id="baseCurrency"
            value={form.billingBaseCurrency}
            onChange={(e) =>
              setForm((p) => ({ ...p, billingBaseCurrency: e.target.value.toUpperCase() }))
            }
            placeholder="USD"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ratesJson">Exchange rates JSON</Label>
          <textarea
            id="ratesJson"
            className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            value={form.exchangeRatesJson}
            onChange={(e) => setForm((p) => ({ ...p, exchangeRatesJson: e.target.value }))}
          />
        </div>
      </div>

      {message && <p className="text-sm text-emerald-600">{message}</p>}

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          setMessage(null)
          let parsedRates: Record<string, number> | null = null
          try {
            parsedRates = JSON.parse(form.exchangeRatesJson) as Record<string, number>
          } catch {
            setMessage("Invalid exchange rates JSON.")
            return
          }
          const payload: Record<string, unknown> = {
            billingBaseCurrency: form.billingBaseCurrency.trim().toUpperCase() || "USD",
            exchangeRates: parsedRates,
          }
          if (form.paystackPublicKey.trim()) payload.paystackPublicKey = form.paystackPublicKey.trim()
          if (form.paystackSecretKey.trim()) payload.paystackSecretKey = form.paystackSecretKey.trim()
          if (form.paystackWebhookSecret.trim())
            payload.paystackWebhookSecret = form.paystackWebhookSecret.trim()
          if (form.binancePayApiKey.trim()) payload.binancePayApiKey = form.binancePayApiKey.trim()
          if (form.binancePaySecretKey.trim())
            payload.binancePaySecretKey = form.binancePaySecretKey.trim()
          if (form.binancePayMerchantId.trim())
            payload.binancePayMerchantId = form.binancePayMerchantId.trim()
          if (form.binancePayWebhookSecret.trim())
            payload.binancePayWebhookSecret = form.binancePayWebhookSecret.trim()
          saveMutation.mutate(payload)
        }}
      >
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-medium">Paystack</h2>
          <p className="text-xs text-muted-foreground">
            With a secret key set, checkout uses{" "}
            <code className="rounded bg-muted px-1">api.paystack.co</code>. Also set{" "}
            <code className="rounded bg-muted px-1">PAYSTACK_SECRET_KEY</code> in server env as fallback.
            {ps?.secretKeyConfigured ? " Secret key is on file." : " Secret key not set."}
            {ps?.webhookSecretConfigured ? " Webhook HMAC secret is on file." : ""}
          </p>
          <div className="space-y-1">
            <Label htmlFor="pk">Public key</Label>
            <Input
              id="pk"
              value={form.paystackPublicKey}
              onChange={(e) => setForm((p) => ({ ...p, paystackPublicKey: e.target.value }))}
              placeholder="pk_live_..."
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="psk">Secret key (write-only)</Label>
            <Input
              id="psk"
              type="password"
              value={form.paystackSecretKey}
              onChange={(e) => setForm((p) => ({ ...p, paystackSecretKey: e.target.value }))}
              placeholder={ps?.secretKeyConfigured ? "•••••••• (enter to rotate)" : "sk_live_..."}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pwh">Webhook secret (optional)</Label>
            <Input
              id="pwh"
              type="password"
              value={form.paystackWebhookSecret}
              onChange={(e) => setForm((p) => ({ ...p, paystackWebhookSecret: e.target.value }))}
              placeholder="HMAC verification"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-medium">Binance Pay</h2>
          <p className="text-xs text-muted-foreground">
            Merchant credentials are stored for upcoming native order creation; checkout still returns a stub URL
            unless integrated. Webhook HMAC uses the secret below or{" "}
            <code className="rounded bg-muted px-1">BINANCEPAY_WEBHOOK_SECRET</code> env.
            {bp?.secretKeyConfigured ? " API secret is on file." : ""}
          </p>
          <div className="space-y-1">
            <Label htmlFor="bmid">Merchant ID</Label>
            <Input
              id="bmid"
              value={form.binancePayMerchantId}
              onChange={(e) => setForm((p) => ({ ...p, binancePayMerchantId: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bak">API key</Label>
            <Input
              id="bak"
              value={form.binancePayApiKey}
              onChange={(e) => setForm((p) => ({ ...p, binancePayApiKey: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bsk">API secret (write-only)</Label>
            <Input
              id="bsk"
              type="password"
              value={form.binancePaySecretKey}
              onChange={(e) => setForm((p) => ({ ...p, binancePaySecretKey: e.target.value }))}
              placeholder={bp?.secretKeyConfigured ? "•••••••• (enter to rotate)" : ""}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bwh">Webhook secret (optional)</Label>
            <Input
              id="bwh"
              type="password"
              value={form.binancePayWebhookSecret}
              onChange={(e) => setForm((p) => ({ ...p, binancePayWebhookSecret: e.target.value }))}
              autoComplete="new-password"
            />
          </div>
        </div>

        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Save gateway settings"}
        </Button>
        {saveMutation.isError && (
          <p className="text-sm text-destructive">Save failed. Check you are signed in as platform owner.</p>
        )}
      </form>
    </div>
  )
}

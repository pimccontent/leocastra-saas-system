"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api"
import { useMe } from "@/lib/me"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

type MeResponse = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}

type FormState = {
  email: string
  currentPassword: string
  newPassword: string
}

type PlatformSettingsResponse = {
  site: {
    title: string | null
    description: string | null
    logoUrl: string | null
    faviconUrl: string | null
  }
  seo: {
    metaTitle: string | null
    metaDescription: string | null
    keywords: string[]
  }
}

type SiteSettingsForm = {
  title: string
  description: string
  logoUrl: string
  faviconUrl: string
  metaTitle: string
  metaDescription: string
  keywords: string
}

export default function SettingsPage() {
  const me = useMe()
  const [form, setForm] = useState<FormState>({
    email: "",
    currentPassword: "",
    newPassword: "",
  })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [siteMessage, setSiteMessage] = useState<string | null>(null)
  const [siteError, setSiteError] = useState<string | null>(null)
  const [siteForm, setSiteForm] = useState<SiteSettingsForm>({
    title: "",
    description: "",
    logoUrl: "",
    faviconUrl: "",
    metaTitle: "",
    metaDescription: "",
    keywords: "",
  })

  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const response = await api.get<MeResponse>("/auth/me")
      return response.data
    },
  })

  const isOwner = me.data?.platformRole === "OWNER"

  const platformSettingsQuery = useQuery({
    queryKey: ["platform-settings"],
    enabled: isOwner === true,
    queryFn: async () => {
      const response = await api.get<PlatformSettingsResponse>("/admin/platform-settings")
      return response.data
    },
  })

  const updateSiteSettingsMutation = useMutation({
    mutationFn: async (payload: {
      siteTitle: string
      siteDescription: string
      siteLogoUrl: string
      siteFaviconUrl: string
      seoMetaTitle: string
      seoMetaDescription: string
      seoKeywords: string[]
    }) => {
      const response = await api.patch("/admin/platform-settings", payload)
      return response.data
    },
    onSuccess: () => {
      setSiteMessage("Site settings saved.")
      setSiteError(null)
    },
    onError: () => {
      setSiteError("Could not save site settings.")
      setSiteMessage(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      currentPassword: string
      email?: string
      newPassword?: string
    }) => {
      const response = await api.patch("/auth/credentials", payload)
      return response.data
    },
    onSuccess: () => {
      setMessage("Credentials updated successfully.")
      setError(null)
      setForm((prev) => ({ ...prev, currentPassword: "", newPassword: "" }))
    },
    onError: () => {
      setError("Could not update credentials. Check current password and try again.")
      setMessage(null)
    },
  })

  const initialEmail = meQuery.data?.email ?? ""
  const emailValue = form.email || initialEmail

  const canSubmit = useMemo(() => {
    if (!form.currentPassword || form.currentPassword.length < 8) return false
    if (!emailValue.trim()) return false
    if (form.newPassword && form.newPassword.length < 8) return false
    return true
  }, [emailValue, form.currentPassword, form.newPassword])

  const canSaveSite = useMemo(() => isOwner, [isOwner])

  const loadedSite = platformSettingsQuery.data

  useEffect(() => {
    if (!loadedSite) return
    setSiteForm((prev) => ({
      ...prev,
      title: loadedSite.site.title ?? "",
      description: loadedSite.site.description ?? "",
      logoUrl: loadedSite.site.logoUrl ?? "",
      faviconUrl: loadedSite.site.faviconUrl ?? "",
      metaTitle: loadedSite.seo.metaTitle ?? "",
      metaDescription: loadedSite.seo.metaDescription ?? "",
      keywords: (loadedSite.seo.keywords ?? []).join(", "),
    }))
  }, [loadedSite])

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    setError(null)
    if (!canSubmit) return

    const payload: {
      currentPassword: string
      email?: string
      newPassword?: string
    } = {
      currentPassword: form.currentPassword,
    }

    if (emailValue.trim() !== initialEmail) {
      payload.email = emailValue.trim()
    }
    if (form.newPassword.trim()) {
      payload.newPassword = form.newPassword.trim()
    }

    updateMutation.mutate(payload)
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Update your profile login email and password.
        </p>
      </div>

      <div className="space-y-4">
        <form className="space-y-4 rounded-lg border bg-card p-4" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={emailValue}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="superadmin@leocastra.local"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              value={form.currentPassword}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, currentPassword: e.target.value }))
              }
              placeholder="Required to confirm changes"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="newPassword">New password (optional)</Label>
            <Input
              id="newPassword"
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
              placeholder="Leave empty to keep current password"
            />
          </div>

          {message && <p className="text-sm text-emerald-600">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {meQuery.isError && (
            <p className="text-sm text-destructive">
              Could not load your profile. Please re-login and try again.
            </p>
          )}

          <Button type="submit" disabled={!canSubmit || updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save credentials"}
          </Button>
        </form>
        {isOwner && (
          <form
            className="space-y-4 rounded-lg border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault()
              setSiteMessage(null)
              setSiteError(null)
              updateSiteSettingsMutation.mutate({
                siteTitle: siteForm.title.trim(),
                siteDescription: siteForm.description.trim(),
                siteLogoUrl: siteForm.logoUrl.trim(),
                siteFaviconUrl: siteForm.faviconUrl.trim(),
                seoMetaTitle: siteForm.metaTitle.trim(),
                seoMetaDescription: siteForm.metaDescription.trim(),
                seoKeywords: siteForm.keywords
                  .split(",")
                  .map((keyword) => keyword.trim())
                  .filter(Boolean),
              })
            }}
          >
            <h2 className="text-sm font-medium">Site settings</h2>
            <p className="text-sm text-muted-foreground">
              Configure storefront branding and SEO defaults.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="site-title">Title</Label>
                <Input
                  id="site-title"
                  value={siteForm.title}
                  onChange={(e) => setSiteForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="LeoCastra SaaS"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="site-description">Description</Label>
                <Input
                  id="site-description"
                  value={siteForm.description}
                  onChange={(e) =>
                    setSiteForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Short site description"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="site-logo">Logo URL</Label>
                <Input
                  id="site-logo"
                  value={siteForm.logoUrl}
                  onChange={(e) => setSiteForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="site-favicon">Favicon URL</Label>
                <Input
                  id="site-favicon"
                  value={siteForm.faviconUrl}
                  onChange={(e) =>
                    setSiteForm((prev) => ({ ...prev, faviconUrl: e.target.value }))
                  }
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="seo-meta-title">SEO title</Label>
                <Input
                  id="seo-meta-title"
                  value={siteForm.metaTitle}
                  onChange={(e) =>
                    setSiteForm((prev) => ({ ...prev, metaTitle: e.target.value }))
                  }
                  placeholder="Meta title for search"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="seo-meta-description">SEO description</Label>
                <Input
                  id="seo-meta-description"
                  value={siteForm.metaDescription}
                  onChange={(e) =>
                    setSiteForm((prev) => ({ ...prev, metaDescription: e.target.value }))
                  }
                  placeholder="Meta description"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="seo-keywords">SEO keywords (comma separated)</Label>
                <Input
                  id="seo-keywords"
                  value={siteForm.keywords}
                  onChange={(e) =>
                    setSiteForm((prev) => ({ ...prev, keywords: e.target.value }))
                  }
                  placeholder="licensing, streaming, saas"
                />
              </div>
            </div>

            {siteMessage && <p className="text-sm text-emerald-600">{siteMessage}</p>}
            {siteError && <p className="text-sm text-destructive">{siteError}</p>}
            {platformSettingsQuery.isError && (
              <p className="text-sm text-destructive">Could not load current site settings.</p>
            )}

            <Button type="submit" disabled={!canSaveSite || updateSiteSettingsMutation.isPending}>
              {updateSiteSettingsMutation.isPending ? "Saving..." : "Save site settings"}
            </Button>
          </form>
        )}

        {isOwner && (
          <div className="rounded-lg border bg-card p-4">
          <h2 className="text-sm font-medium">Admin control alignment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            License and plan controls remain in the dashboard pages, while broadcast runtime controls are in LeoCastra Studio Settings.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => window.location.assign("/licenses")}>
              Open Licenses
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.assign("/modules")}>
              Module pricing
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.assign("/payments-config")}>
              Payment gateways
            </Button>
            <Button type="button" variant="outline" onClick={() => window.location.assign("/license-store")}>
              License store
            </Button>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

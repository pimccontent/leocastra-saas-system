"use client"

import { Button } from "@/components/ui/button"
import { clearAuthToken } from "@/lib/auth"
import { api } from "@/lib/api"
import { useMe } from "@/lib/me"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

export function AppShell({ children }: { children: React.ReactNode }) {
  const meQuery = useMe()
  const pathname = usePathname()
  const router = useRouter()
  const isOwner = meQuery.data?.platformRole === "OWNER"
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const siteSettingsQuery = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const response = await api.get<{
        title: string
        description: string
        logoUrl: string | null
      }>("/site/settings")
      return response.data
    },
  })
  const navItems = isOwner
    ? [
        { href: "/", label: "Dashboard" },
        { href: "/organizations", label: "Customers" },
        { href: "/modules", label: "Module pricing" },
        { href: "/payments-config", label: "Payment gateways" },
        { href: "/licenses", label: "Licenses" },
        { href: "/license-generator", label: "License generator" },
        { href: "/license-store", label: "Buy License" },
        { href: "/billing", label: "Payments" },
        { href: "/settings", label: "Settings" },
      ]
    : [
        { href: "/", label: "Dashboard" },
        { href: "/organizations", label: "Organization" },
        { href: "/license-store", label: "Buy License" },
        { href: "/licenses", label: "Licenses" },
        { href: "/billing", label: "Billing" },
        { href: "/settings", label: "Settings" },
      ]

  function logout() {
    clearAuthToken()
    router.replace("/login")
  }

  useEffect(() => {
    setMenuOpen(false)
    setSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current) return
      const target = event.target as Node | null
      if (target && !menuRef.current.contains(target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="mx-auto flex max-w-[1440px]">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 z-30 bg-black/30 xl:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-40 border-r bg-sidebar/90 p-6 shadow-xl backdrop-blur-sm transition-all duration-300 xl:static xl:z-auto ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full xl:translate-x-0"
          } ${sidebarCollapsed ? "xl:w-20" : "w-64"}`}
        >
          <div className="mb-8 flex items-start justify-between gap-2">
            <div className={sidebarCollapsed ? "xl:hidden" : ""}>
              {siteSettingsQuery.data?.logoUrl ? (
                <img
                  src={siteSettingsQuery.data.logoUrl}
                  alt={siteSettingsQuery.data.title || "Site logo"}
                  className="h-9 w-auto object-contain"
                />
              ) : (
                <p className="text-lg font-semibold">
                  {siteSettingsQuery.data?.title ?? "LeoCastra SaaS"}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {isOwner ? "Owner Control Panel" : "Organization Admin"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="rounded-md border px-2 py-1 text-xs xl:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                ✕
              </button>
              <button
                type="button"
                className="hidden rounded-md border px-2 py-1 text-xs xl:inline-flex"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {sidebarCollapsed ? "»" : "«"}
              </button>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-xl px-3 py-2 text-sm transition-all duration-200 ${
                  pathname === item.href
                    ? "ui-glow bg-primary/10 font-medium text-foreground shadow-sm"
                    : "text-muted-foreground hover:-translate-y-0.5 hover:bg-accent hover:text-accent-foreground"
                } ${sidebarCollapsed ? "xl:text-center xl:px-2" : ""}`}
                title={item.label}
              >
                {sidebarCollapsed ? (
                  <span className="inline-flex size-6 items-center justify-center rounded-md border text-xs font-semibold">
                    {item.label.charAt(0)}
                  </span>
                ) : (
                  item.label
                )}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b bg-background/90 px-4 py-3 shadow-md backdrop-blur md:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-md border px-2 py-1 text-sm xl:hidden"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Open sidebar"
                >
                  ☰
                </button>
                <div>
                  <p className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text font-semibold text-transparent">
                    {siteSettingsQuery.data?.title ?? "LeoCastra SaaS Platform"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {siteSettingsQuery.data?.description?.trim()
                      ? siteSettingsQuery.data.description
                      : isOwner
                        ? "Business control and customer insights"
                        : "Manage your organization services"}
                  </p>
                </div>
              </div>
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="rounded-full border bg-card/80 px-3 py-1 text-xs text-muted-foreground shadow-sm transition hover:bg-card"
                >
                  {meQuery.data?.email ?? "loading..."}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-10 z-30 w-56 rounded-xl border bg-card p-2 shadow-xl">
                    <div className="mb-2 border-b px-2 pb-2">
                      <p className="text-xs text-muted-foreground">Signed in as</p>
                      <p className="truncate text-sm font-medium">
                        {meQuery.data?.email ?? "Account"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Link
                        href="/settings"
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        Profile settings
                      </Link>
                      {isOwner && (
                        <>
                          <Link
                            href="/billing"
                            onClick={() => setMenuOpen(false)}
                            className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            Payments
                          </Link>
                          <Link
                            href="/payments-config"
                            onClick={() => setMenuOpen(false)}
                            className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            Payment gateways
                          </Link>
                        </>
                      )}
                      <Link
                        href="/license-store"
                        onClick={() => setMenuOpen(false)}
                        className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        Buy License
                      </Link>
                    </div>
                    <div className="mt-2 border-t pt-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={logout}
                      >
                        Logout
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className="ui-fade-up flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}

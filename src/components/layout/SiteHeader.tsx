"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X, LogOut, User, LayoutDashboard, PlusCircle, Home } from "lucide-react"

import { Button } from "@/components/ui/button"
import { signOut, useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { useLogger } from "@/lib/logger"

import { SiteLogo } from "./SiteLogo"
import { ThemeToggle } from "./ThemeToggle"

const navLinks = [
  { label: "Overview", href: "/", icon: Home },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Create Project", href: "/project/create", icon: PlusCircle },
]

interface SiteHeaderProps {
  className?: string
}

export function SiteHeader({ className }: SiteHeaderProps) {
  const pathname = usePathname()
  const { data, isPending } = useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const { logError } = useLogger("SiteHeader")

  useEffect(() => {
    setMounted(true)
  }, [])

  const isAuthenticated = Boolean(data?.session)
  const userLabel = data?.user
    ? data.user.name?.trim() || data.user.email || "Account"
    : null

  const handleSignOut = async () => {
    if (isSigningOut) return

    try {
      setIsSigningOut(true)
      await signOut()
      setMobileOpen(false)
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      logError("Failed to sign out", err)
    } finally {
      setIsSigningOut(false)
    }
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname.startsWith(href)
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2 group" aria-label="Spec-Driven Home">
          <SiteLogo size="sm" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => {
            const active = isActive(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!mounted || isPending ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" aria-hidden="true" />
          ) : isAuthenticated ? (
            <div className="hidden items-center gap-2 md:flex">
              {userLabel && (
                <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground max-w-[120px] truncate">
                    {userLabel}
                  </span>
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
                {isSigningOut ? "..." : "Sign Out"}
              </Button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button size="sm" asChild className="shadow-sm">
                <Link href="/sign-up">Create Account</Link>
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="block border-t border-border/40 bg-background/95 backdrop-blur-lg md:hidden">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const active = isActive(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setMobileOpen(false)}
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                )
              })}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-4">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>

            <div className="mt-4 border-t border-border/40 pt-4">
              {!mounted || isPending ? null : isAuthenticated ? (
                <div className="space-y-3">
                  {userLabel && (
                    <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm font-medium text-foreground">{userLabel}</span>
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="w-full gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    {isSigningOut ? "Signing out..." : "Sign Out"}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button size="sm" asChild onClick={() => setMobileOpen(false)}>
                    <Link href="/sign-in">Sign In</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild onClick={() => setMobileOpen(false)}>
                    <Link href="/sign-up">Create Account</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

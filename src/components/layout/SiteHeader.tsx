"use client"

import { useState } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { signOut, useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

import { SiteLogo } from "./SiteLogo"

const navLinks = [
  { label: "Overview", href: "/" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Create Project", href: "/project/create" },
]

interface SiteHeaderProps {
  className?: string
}

export function SiteHeader({ className }: SiteHeaderProps) {
  const { data, isPending } = useSession()
  const [isSigningOut, setIsSigningOut] = useState(false)

  const isAuthenticated = Boolean(data?.session)
  const userLabel = data?.user
    ? data.user.name?.trim() || data.user.email || "Account"
    : null

  const handleSignOut = async () => {
    if (isSigningOut) return

    try {
      setIsSigningOut(true)
      await signOut()
    } catch (error) {
      console.error("Failed to sign out", error)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Spec-Driven Home">
          <SiteLogo />
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isPending ? (
            <div className="h-9 w-28 animate-pulse rounded-md bg-muted" aria-hidden="true" />
          ) : isAuthenticated ? (
            <>
              {userLabel && (
                <span className="hidden text-sm font-medium text-muted-foreground sm:inline-block">
                  {userLabel}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? "Signing out..." : "Sign Out"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
                <Link href="/sign-in">Sign In</Link>
              </Button>
              <Button size="sm" className="shadow-sm" asChild>
                <Link href="/sign-up">Create Account</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

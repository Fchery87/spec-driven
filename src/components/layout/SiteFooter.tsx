"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Home, LayoutDashboard, PlusCircle, Database, Package, Mail, Github, Twitter } from "lucide-react"

import { cn } from "@/lib/utils"

import { SiteLogo } from "./SiteLogo"

interface SiteFooterProps {
  className?: string
}

interface FooterLink {
  label: string
  href: string
  icon?: React.ComponentType<{ className?: string }>
  newTab?: boolean
}

const footerLinks: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "/", icon: Home },
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Create Project", href: "/project/create", icon: PlusCircle },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Database Setup", href: "/resources/database-setup", icon: Database, newTab: true },
      { label: "Dependencies", href: "/resources/dependencies", icon: Package, newTab: true },
      { label: "Support", href: "mailto:hello@specdriven.ai", icon: Mail, newTab: true },
    ],
  },
]

export function SiteFooter({ className }: SiteFooterProps) {
  const [year, setYear] = useState<number | null>(null)

  useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  return (
    <footer className={cn("border-t border-border/40 bg-muted/30", className)}>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.5fr,1fr,1fr,1fr]">
          <div className="space-y-4">
            <SiteLogo size="sm" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Spec-Driven synchronizes analysts, architects, and AI agents around a shared source
              of truth so your team can move from concept to code with clarity and confidence.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <Link
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/50 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </Link>
              <Link
                href="https://twitter.com"
                target="_blank"
                rel="noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 bg-background/50 text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                aria-label="Twitter"
              >
                <Twitter className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold text-foreground mb-4">{group.title}</p>
              <ul className="space-y-3">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground group"
                      target={link.newTab ? "_blank" : undefined}
                      rel={link.newTab ? "noreferrer" : undefined}
                    >
                      {link.icon && (
                        <link.icon className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                      )}
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <p className="text-sm font-semibold text-foreground mb-4">Legal</p>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/privacy"
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-border/40 pt-6 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground" suppressHydrationWarning>
            © {year ?? new Date().getFullYear()} Spec-Driven Platform. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Built with clarity and confidence.
          </p>
        </div>
      </div>
    </footer>
  )
}

import Link from "next/link"

import { cn } from "@/lib/utils"

import { SiteLogo } from "./SiteLogo"

interface SiteFooterProps {
  className?: string
}

interface FooterLink {
  label: string
  href: string
  newTab?: boolean
}

const footerLinks: Array<{ title: string; links: FooterLink[] }> = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "/" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Create Project", href: "/project/create" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Database Setup", href: "/resources/database-setup", newTab: true },
      { label: "Dependencies", href: "/resources/dependencies", newTab: true },
      { label: "Support", href: "mailto:hello@specdriven.ai", newTab: true },
    ],
  },
]

export function SiteFooter({ className }: SiteFooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className={cn("border-t border-border/60 bg-background/90", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 md:px-6">
        <div className="grid gap-8 md:grid-cols-[2fr,1fr,1fr]">
          <div>
            <SiteLogo />
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              Spec-Driven synchronizes analysts, architects, and AI agents around a shared source
              of truth so your team can move from concept to code with clarity and confidence.
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold text-foreground">{group.title}</p>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="transition-colors hover:text-foreground"
                      target={link.newTab ? "_blank" : undefined}
                      rel={link.newTab ? "noreferrer" : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 border-t border-border/60 pt-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>© {year} Spec-Driven Platform. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

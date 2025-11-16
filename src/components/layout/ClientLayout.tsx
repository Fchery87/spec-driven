"use client"

import { ReactNode } from "react"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

interface ClientLayoutProps {
  children: ReactNode
}

export function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}

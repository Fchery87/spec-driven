import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

import { ClientLayout } from '@/components/layout/ClientLayout'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Spec-Driven Platform',
  description: 'Spec-first orchestrator for production-ready projects',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={cn('min-h-screen bg-background text-foreground antialiased', inter.className)}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}

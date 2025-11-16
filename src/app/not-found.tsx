'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted px-4 py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6">
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-muted p-3">
            <div className="text-6xl font-bold text-muted-foreground">404</div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
          <p className="text-muted-foreground">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        </div>

        <Card className="w-full border border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Lost?</CardTitle>
            <CardDescription>Let&apos;s get you back on track</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button asChild className="w-full" variant="default">
                <Link href="/">Go Home</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

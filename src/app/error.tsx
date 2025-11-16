'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted px-4 py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-6">
        <div className="space-y-3 text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
          <p className="text-muted-foreground">An error occurred while processing your request. Please try again.</p>
        </div>

        <Card className="w-full border border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-lg">Error Details</CardTitle>
            <CardDescription>{error.message || 'Unknown error'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <Button onClick={() => reset()} variant="default" className="w-full">
                Try Again
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/">Go Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

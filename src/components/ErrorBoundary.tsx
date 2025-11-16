'use client'

import React, { ReactNode, Component, ErrorInfo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import { logger } from '@/lib/logger'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo
    })

    // Log using structured logger
    logger.error('Error caught by ErrorBoundary', error, {
      componentStack: errorInfo.componentStack
    })

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted px-4 py-16">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-6">
              <div className="space-y-3 text-center">
                <div className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-3">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
                <p className="text-muted-foreground">
                  We encountered an unexpected error. Please try again or return home.
                </p>
              </div>

              <Card className="w-full border border-border/70 bg-card/80">
                <CardHeader>
                  <CardTitle className="text-lg">Error Details</CardTitle>
                  <CardDescription className="break-words">
                    {this.state.error?.message || 'Unknown error'}
                  </CardDescription>
                </CardHeader>
                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <CardContent className="space-y-4">
                    <details className="cursor-pointer">
                      <summary className="text-sm font-semibold text-muted-foreground hover:text-foreground">
                        Stack Trace (Development Only)
                      </summary>
                      <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  </CardContent>
                )}
                <CardContent className="flex flex-col gap-2">
                  <Button onClick={this.handleReset} variant="default" className="w-full gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Try Again
                  </Button>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/">
                      <Home className="mr-2 h-4 w-4" />
                      Go Home
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )
      )
    }

    return this.props.children
  }
}

'use client';

/**
 * Error Boundary Component
 *
 * Catches React component errors and displays a fallback UI
 * Prevents entire app from crashing when a component errors
 */

import React, { ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { logger } from '@/lib/logger';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Log error details using structured logger
    logger.error('ErrorBoundary caught an error', error, {
      componentStack: errorInfo.componentStack
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send to error tracking service (e.g., Sentry)
    // if (process.env.NODE_ENV === 'production') {
    //   reportErrorToService(error, errorInfo);
    // }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full text-card-foreground">
            {/* Error Icon */}
            <div className="flex justify-center pt-6">
              <div className="bg-destructive/10 p-3 rounded-full">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
            </div>

            {/* Error Content */}
            <div className="p-6 text-center">
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-muted-foreground mb-4">
                We encountered an unexpected error. Please try again or contact support if the
                problem persists.
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 p-4 bg-destructive/10 rounded border border-destructive/30 text-left mb-4">
                  <summary className="cursor-pointer font-mono text-sm text-destructive font-semibold">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Message:
                      </p>
                      <p className="font-mono text-xs text-destructive">
                        {this.state.error.message}
                      </p>
                    </div>
                    {this.state.errorInfo && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground">
                          Component Stack:
                        </p>
                        <pre className="font-mono text-xs bg-muted p-2 rounded overflow-auto max-h-32 text-muted-foreground">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={this.handleReset}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg font-medium transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="w-full px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors"
                >
                  Go Home
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-muted border-t border-border text-xs text-muted-foreground rounded-b-lg">
              <p>Error ID: <code className="font-mono">{Math.random().toString(36).substring(7)}</code></p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Logging utility for both frontend and backend
 * Provides structured logging with different levels and correlation IDs
 */

import { getCorrelationId, getRequestId } from './correlation-id'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  error?: Error
  correlationId?: string
  requestId?: string
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isServer = typeof window === 'undefined'

  log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error) {
    const timestamp = new Date().toISOString()
    const correlationId = this.isServer ? undefined : getCorrelationId()
    const requestId = this.isServer ? undefined : getRequestId()

    const entry: LogEntry = {
      timestamp,
      level,
      message,
      context,
      error,
      correlationId,
      requestId
    }

    // Always log in development
    if (this.isDevelopment) {
      this.logToDev(entry)
    }

    // Log to backend in production
    if (!this.isDevelopment && !this.isServer) {
      this.logToBackend(entry)
    }

    // Server-side logging
    if (this.isServer) {
      this.logToServer(entry)
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>) {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error, context?: Record<string, unknown>) {
    this.log('error', message, context, error)
    if (error?.stack && this.isDevelopment) {
      console.error('Stack trace:', error.stack)
    }
  }

  private logToDev(entry: LogEntry) {
    const style = this.getDevStyle(entry.level)
    const prefix = `[${entry.level.toUpperCase()}] ${entry.timestamp}`

    if (entry.error) {
      console.error(`%c${prefix}`, style, entry.message, entry.error, entry.context)
    } else {
      console.log(`%c${prefix}`, style, entry.message, entry.context)
    }
  }

  private logToServer(entry: LogEntry) {
    // Server-side logging with structured format (JSON for aggregation)
    const logObject = {
      timestamp: entry.timestamp,
      level: entry.level.toUpperCase(),
      message: entry.message,
      correlationId: entry.correlationId,
      requestId: entry.requestId,
      context: entry.context,
      ...(entry.error && {
        error: {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        },
      }),
    }

    // In development, use prettier console output
    if (this.isDevelopment) {
      const prefix = `[${entry.level.toUpperCase()}]`
      const correlationInfo = entry.correlationId ? ` [${entry.correlationId}]` : ''
      const message = `${prefix}${correlationInfo} ${entry.message}`

      if (entry.level === 'error') {
        console.error(message, entry.context, entry.error)
      } else if (entry.level === 'warn') {
        console.warn(message, entry.context)
      } else {
        console.log(message, entry.context)
      }
    } else {
      // Production: structured JSON logging
      console.log(JSON.stringify(logObject))
    }
  }

  private logToBackend(entry: LogEntry) {
    // Send logs to backend for aggregation (optional)
    try {
      navigator.sendBeacon('/api/logs', JSON.stringify(entry))
    } catch {
      // Fail silently in production
    }
  }

  private getDevStyle(level: LogLevel): string {
    const styles: Record<LogLevel, string> = {
      debug: 'color: #666; font-weight: bold;',
      info: 'color: #0066cc; font-weight: bold;',
      warn: 'color: #ff9800; font-weight: bold;',
      error: 'color: #d32f2f; font-weight: bold;'
    }
    return styles[level]
  }
}

export const logger = new Logger()

/**
 * Middleware for logging API requests and responses
 */
export function withLogging(
  handler: (req: Request) => Promise<Response>
) {
  return async (req: Request) => {
    const startTime = Date.now()
    const method = req.method
    const url = new URL(req.url).pathname

    logger.debug(`${method} ${url}`)

    try {
      const response = await handler(req)
      const duration = Date.now() - startTime

      logger.info(`${method} ${url} - ${response.status}`, {
        duration: `${duration}ms`,
        status: response.status
      })

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      logger.error(
        `${method} ${url} failed`,
        error instanceof Error ? error : new Error(String(error)),
        {
          duration: `${duration}ms`
        }
      )

      throw error
    }
  }
}

/**
 * Hook for logging in React components
 */
export function useLogger(componentName: string) {
  const log = (message: string, context?: Record<string, unknown>) => {
    logger.debug(`[${componentName}] ${message}`, context)
  }

  const logError = (message: string, error: Error, context?: Record<string, unknown>) => {
    logger.error(`[${componentName}] ${message}`, error, context)
  }

  const logEvent = (eventName: string, context?: Record<string, unknown>) => {
    logger.info(`[${componentName}] Event: ${eventName}`, context)
  }

  return { log, logError, logEvent }
}

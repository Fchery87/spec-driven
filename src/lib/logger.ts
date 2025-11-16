/**
 * Logging utility for both frontend and backend
 * Provides structured logging with different levels
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, any>
  error?: Error
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isServer = typeof window === 'undefined'

  log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error) {
    const timestamp = new Date().toISOString()

    const entry: LogEntry = {
      timestamp,
      level,
      message,
      context,
      error
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

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context)
  }

  error(message: string, error?: Error, context?: Record<string, any>) {
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
    // Server-side logging with proper formatting
    const prefix = `[${entry.level.toUpperCase()}]`
    const message = `${prefix} ${entry.message}`

    if (entry.level === 'error') {
      console.error(message, entry.context, entry.error)
    } else if (entry.level === 'warn') {
      console.warn(message, entry.context)
    } else {
      console.log(message, entry.context)
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
  const log = (message: string, context?: Record<string, any>) => {
    logger.debug(`[${componentName}] ${message}`, context)
  }

  const logError = (message: string, error: Error, context?: Record<string, any>) => {
    logger.error(`[${componentName}] ${message}`, error, context)
  }

  const logEvent = (eventName: string, context?: Record<string, any>) => {
    logger.info(`[${componentName}] Event: ${eventName}`, context)
  }

  return { log, logError, logEvent }
}

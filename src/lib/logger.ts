// src/lib/logger.ts
// Structured logger with configurable log levels
//
// Log Level Configuration:
// - Set VITE_LOG_LEVEL env var to: 'debug' | 'info' | 'warn' | 'error'
// - Production defaults to 'warn' (only warn/error shown)
// - Development defaults to 'debug' (all logs shown)
//
// Usage:
//   import { logger } from '@/lib/logger'
//   logger.debug('verbose diagnostic info')
//   logger.info('general info')
//   logger.warn('recoverable issue')
//   logger.error('error requiring investigation')

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// Determine current log level from env
const getLogLevel = (): LogLevel => {
  const envLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel
  }
  // Default: 'warn' in production, 'debug' in development
  return import.meta.env.PROD ? 'warn' : 'debug'
}

const currentLevel = getLogLevel()

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

export const logger = {
  /**
   * Debug logs - development only by default
   * Use for verbose diagnostic information
   */
  debug: (...args: unknown[]): void => {
    if (shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.debug('[DEBUG]', ...args)
    }
  },

  /**
   * Info logs - development only by default
   * Use for general informational messages
   */
  info: (...args: unknown[]): void => {
    if (shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.info('[INFO]', ...args)
    }
  },

  /**
   * Warning logs - always enabled by default
   * Use for recoverable issues
   */
  warn: (...args: unknown[]): void => {
    if (shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn('[WARN]', ...args)
    }
  },

  /**
   * Error logs - always enabled
   * Use for errors that need investigation
   */
  error: (...args: unknown[]): void => {
    if (shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error('[ERROR]', ...args)
    }
  },

  /**
   * Get current log level (for diagnostics)
   */
  getLevel: (): LogLevel => currentLevel,
}

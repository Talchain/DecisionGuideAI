// src/lib/logger.ts
// Structured logger that no-ops in production for debug/info

const isProd = import.meta.env.PROD

export const logger = {
  /**
   * Debug logs - only in development
   * Use for verbose diagnostic information
   */
  debug: (...args: unknown[]): void => {
    if (!isProd) {
      console.debug(...args)
    }
  },

  /**
   * Info logs - only in development
   * Use for general informational messages
   */
  info: (...args: unknown[]): void => {
    if (!isProd) {
      console.info(...args)
    }
  },

  /**
   * Error logs - always enabled
   * Use for errors that need investigation
   */
  error: (...args: unknown[]): void => {
    console.error(...args)
  },

  /**
   * Warning logs - always enabled
   * Use for recoverable issues
   */
  warn: (...args: unknown[]): void => {
    console.warn(...args)
  },
}

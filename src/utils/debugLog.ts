/**
 * Development-Only Logging Utility
 *
 * Simple category-based logging for development builds only.
 * Logs are automatically stripped in production builds.
 *
 * WHEN TO USE:
 * - General development debugging with category prefixes
 * - Non-sensitive diagnostic information
 *
 * FOR SENSITIVE DATA (payloads, auth):
 * - Use @/lib/debug with explicit flags (VITE_DEBUG_PAYLOADS, etc.)
 *
 * FOR STRUCTURED LOGGING WITH LEVELS:
 * - Use @/lib/logger (debug/info/warn/error levels)
 *
 * Usage:
 *   import { devLog, devWarn } from '@/utils/debugLog'
 *   devLog('CEE', 'Processing review payload', { blocks: 3 })
 *   devWarn('InsightsPanel', 'Contradictory insight detected', { summary })
 */

/**
 * Debug logging is enabled in development mode only.
 * Uses Vite's import.meta.env.DEV which is true during `vite dev`
 * and false in production builds.
 */
const DEBUG_ENABLED =
  typeof import.meta !== 'undefined' &&
  (import.meta as any).env?.DEV === true

/**
 * Log a debug message with category prefix.
 * Only outputs in development builds.
 *
 * @param category - Short identifier for the component/module (e.g., 'CEE', 'DriversSignal')
 * @param message - Description of what's happening
 * @param data - Optional data to include (object, array, etc.)
 */
export function devLog(category: string, message: string, data?: unknown): void {
  if (!DEBUG_ENABLED) return
  if (data !== undefined) {
    console.log(`[${category}] ${message}`, data)
  } else {
    console.log(`[${category}] ${message}`)
  }
}

/** @deprecated Use devLog instead (renamed to avoid collision with @/lib/debug) */
export const debugLog = devLog

/**
 * Log a debug warning with category prefix.
 * Only outputs in development builds.
 * Use for unexpected but non-fatal conditions.
 *
 * @param category - Short identifier for the component/module
 * @param message - Description of the warning condition
 * @param data - Optional data to include
 */
export function devWarn(category: string, message: string, data?: unknown): void {
  if (!DEBUG_ENABLED) return
  if (data !== undefined) {
    console.warn(`[${category}] ${message}`, data)
  } else {
    console.warn(`[${category}] ${message}`)
  }
}

/** @deprecated Use devWarn instead (renamed to avoid collision with @/lib/debug) */
export const debugWarn = devWarn

/**
 * Check if dev logging is currently enabled.
 * Useful for conditional expensive debug operations.
 */
export function isDevLogEnabled(): boolean {
  return DEBUG_ENABLED
}

/** @deprecated Use isDevLogEnabled instead */
export const isDebugEnabled = isDevLogEnabled

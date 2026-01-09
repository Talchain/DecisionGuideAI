/**
 * Debug Logging Utility
 *
 * Consolidates debug logging policy across the codebase.
 * Logs only appear in development builds, preventing noise in production.
 *
 * Usage:
 *   import { debugLog, debugWarn } from '@/utils/debugLog'
 *   debugLog('CEE', 'Processing review payload', { blocks: 3 })
 *   debugWarn('InsightsPanel', 'Contradictory insight detected', { summary })
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
export function debugLog(category: string, message: string, data?: unknown): void {
  if (!DEBUG_ENABLED) return
  if (data !== undefined) {
    console.log(`[${category}] ${message}`, data)
  } else {
    console.log(`[${category}] ${message}`)
  }
}

/**
 * Log a debug warning with category prefix.
 * Only outputs in development builds.
 * Use for unexpected but non-fatal conditions.
 *
 * @param category - Short identifier for the component/module
 * @param message - Description of the warning condition
 * @param data - Optional data to include
 */
export function debugWarn(category: string, message: string, data?: unknown): void {
  if (!DEBUG_ENABLED) return
  if (data !== undefined) {
    console.warn(`[${category}] ${message}`, data)
  } else {
    console.warn(`[${category}] ${message}`)
  }
}

/**
 * Check if debug logging is currently enabled.
 * Useful for conditional expensive debug operations.
 */
export function isDebugEnabled(): boolean {
  return DEBUG_ENABLED
}

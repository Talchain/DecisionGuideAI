// src/lib/debug.ts
// Explicit debug flags for sensitive data logging
//
// SECURITY: These flags are OFF by default, even in development.
// This prevents accidental exposure during demos, screen recordings,
// and shared dev environments.
//
// To enable in development (not recommended for demos):
//   VITE_DEBUG_PAYLOADS=true  - Log API request/response payloads
//   VITE_DEBUG_AUTH=true      - Log authentication events
//   VITE_DEBUG_API=true       - Log API calls (URLs, headers)
//
// Usage:
//   import { debugLog, DEBUG_FLAGS } from '@/lib/debug'
//   debugLog('logPayloads', 'Creating decision:', payload)

/**
 * Debug flags - ALL default to false (safe for demos)
 */
export const DEBUG_FLAGS = {
  /** Log API request/response payloads - NEVER enable in prod/demos */
  logPayloads: import.meta.env.VITE_DEBUG_PAYLOADS === 'true',
  /** Log authentication events (session info, user IDs) */
  logAuth: import.meta.env.VITE_DEBUG_AUTH === 'true',
  /** Log API calls (URLs, methods, non-sensitive headers) */
  logApi: import.meta.env.VITE_DEBUG_API === 'true',
  /** Log Supabase operations */
  logSupabase: import.meta.env.VITE_DEBUG_SUPABASE === 'true',
} as const

export type DebugFlag = keyof typeof DEBUG_FLAGS

/**
 * Conditionally log debug information based on explicit flag
 * @param flag - Which debug category to check
 * @param args - Arguments to log (only if flag is enabled)
 */
export function debugLog(flag: DebugFlag, ...args: unknown[]): void {
  if (DEBUG_FLAGS[flag]) {
    // eslint-disable-next-line no-console
    console.log(`[DEBUG:${flag}]`, ...args)
  }
}

/**
 * Conditionally log debug warning based on explicit flag
 */
export function debugWarn(flag: DebugFlag, ...args: unknown[]): void {
  if (DEBUG_FLAGS[flag]) {
    // eslint-disable-next-line no-console
    console.warn(`[DEBUG:${flag}]`, ...args)
  }
}

/**
 * Check if a specific debug flag is enabled
 */
export function isDebugEnabled(flag: DebugFlag): boolean {
  return DEBUG_FLAGS[flag]
}

// src/lib/logger.ts
// Structured logger with configurable log levels
//
// =============================================================================
// LOGGING POLICY: Which logger to use
// =============================================================================
//
// 1. @/lib/logger (THIS FILE)
//    - Structured logging with levels: debug/info/warn/error
//    - Use for: Application-wide logging, errors, warnings
//    - Config: VITE_LOG_LEVEL=debug|info|warn|error
//    - Prod default: warn (only warn/error shown)
//    - Dev default: debug (all logs shown)
//
// 2. @/lib/debug
//    - Explicit opt-in flags for SENSITIVE data
//    - Use for: API payloads, auth events, API calls
//    - Config: VITE_DEBUG_PAYLOADS=true, VITE_DEBUG_AUTH=true, etc.
//    - DEFAULT: All OFF (safe for demos/screen recordings)
//
// 3. @/utils/debugLog
//    - Simple category-based DEV-only logging
//    - Use for: General component debugging, non-sensitive diagnostics
//    - Functions: devLog(category, message, data), devWarn(...)
//    - Automatically stripped in production builds
//
// AVOID: Raw console.log() - use one of the above instead
// =============================================================================
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
  const envLevel = import.meta.env?.VITE_LOG_LEVEL as LogLevel | undefined
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

// =============================================================================
// THE EMISSION SINK - and why it is not a bare `console` reference
// =============================================================================
//
// Production builds strip console CALL EXPRESSIONS twice, independently:
//
//   vite.config.ts:157  build.minify: 'terser'
//   vite.config.ts:160  build.terserOptions.compress.drop_console: true
//   vite.config.ts:193  esbuild.drop: mode === 'production'
//                         ? ['console', 'debugger'] : undefined
//
// ⚠ The two stanzas do NOT have the same reach, and reading only one of them
// gives you the wrong model. `esbuild.drop` is gated on `mode === 'production'`.
// The terser stanza is NOT gated on anything: `build` is a plain key of the
// returned config object, so `drop_console` applies to EVERY `vite build`,
// in every mode. "Dev builds are safe" is false.
//
// Both match a call whose callee is a member chain rooted at the GLOBAL
// IDENTIFIER `console`. Until 2026-08-28 every method below emitted through
// exactly that shape, so each one compiled down to its level gate and nothing
// else. This is the whole of `logger.warn` as it shipped on 18727b64:
//
//     warn: (...e) => { Hc("warn") }
//
// The gate evaluated correctly and returned true. The call it guarded was gone.
// All four methods were dead, for all 51 call sites across all six importing
// chunks, and `[WARN]`/`[ERROR]`/`[INFO]`/`[DEBUG]` appeared ZERO times in the
// 79 emitted chunks - the tag literals are arguments, so they were dropped with
// the call. A fence that fired and a fence that did not were indistinguishable.
//
// Reading the sink off `globalThis` roots the callee at `globalThis`, which
// neither stripper matches. That is not a guess about minifier internals: the
// SAME deployed bundle that carried the dead logger also carried PostHog's
// `window.console.log(...)` through both strips intact, and Supabase's
// `this.logger = console.log` reference survived for the same reason. The
// build-output guard (`scripts/ci/assert-logger-emits.mjs`) re-proves it on
// every build rather than trusting this paragraph.
//
// ⚠ THIS EXEMPTION IS DELIBERATELY NARROW AND MUST STAY THAT WAY.
// Raw `console.*` written anywhere else in application code is still stripped
// from production builds, which is the policy at the top of this file and it
// does not change. What is restored here is this module's own sink - the
// instrument - and nothing else. Do not widen it by relaxing the vite.config
// stanzas; that ships every stray `console.log` in the codebase to users.
//
// Neither of the codebase's existing sinks was a fit, checked before adding
// this one:
//   · `src/lib/telemetry.ts` is an opt-in COUNTER seam over a closed event
//     enum (`Record<TelemetryEvent, number>`), flag-gated off by default. It
//     counts; it cannot carry a message with fields, and its only output was
//     itself a DEV-only `console.debug` that this same strip removed.
//   · `src/lib/monitoring.ts` (Sentry) initialises only when `VITE_SENTRY_DSN`
//     is set, and it is not set for the staging build. Routing application
//     logs to a third party would also be logging MORE, not restoring an
//     instrument.
type LogSink = Pick<Console, 'debug' | 'info' | 'warn' | 'error' | 'log'>

const sink: LogSink | undefined = ((): LogSink | undefined => {
  try {
    return typeof globalThis !== 'undefined'
      ? (globalThis.console as LogSink | undefined)
      : undefined
  } catch {
    // A host with no reachable console must degrade to silence, never throw:
    // a logger that can crash its caller is worse than one that says nothing.
    return undefined
  }
})()

export const logger = {
  /**
   * Debug logs - development only by default
   * Use for verbose diagnostic information
   */
  debug: (...args: unknown[]): void => {
    if (shouldLog('debug')) {
      sink?.debug('[DEBUG]', ...args)
    }
  },

  /**
   * Info logs - development only by default
   * Use for general informational messages
   */
  info: (...args: unknown[]): void => {
    if (shouldLog('info')) {
      sink?.info('[INFO]', ...args)
    }
  },

  /**
   * Warning logs - always enabled by default
   * Use for recoverable issues
   */
  warn: (...args: unknown[]): void => {
    if (shouldLog('warn')) {
      sink?.warn('[WARN]', ...args)
    }
  },

  /**
   * Error logs - always enabled
   * Use for errors that need investigation
   */
  error: (...args: unknown[]): void => {
    if (shouldLog('error')) {
      sink?.error('[ERROR]', ...args)
    }
  },

  /**
   * Get current log level (for diagnostics)
   */
  getLevel: (): LogLevel => currentLevel,
}

// =============================================================================
// Boundary Logging - Structured JSON for request/response tracing
// =============================================================================

/**
 * Boundary request event payload
 */
export interface BoundaryRequestEvent {
  event: 'boundary.request'
  timestamp: string
  request_id: string
  endpoint: string
  method: string
  payload_hash: string
  client_build: string
}

/**
 * Boundary response event payload
 */
export interface BoundaryResponseEvent {
  event: 'boundary.response'
  timestamp: string
  request_id: string
  endpoint: string
  status: number
  elapsed_ms: number
  response_hash?: string
  service?: string
  service_build?: string
  error?: string
}

/**
 * Log a boundary request event (JSON format).
 * Only logs if debug level is enabled.
 *
 * @param params - Request metadata
 */
export function logBoundaryRequest(params: {
  requestId: string
  endpoint: string
  method: string
  payloadHash: string
  clientBuild: string
}): void {
  if (!shouldLog('debug')) {
    return
  }

  const event: BoundaryRequestEvent = {
    event: 'boundary.request',
    timestamp: new Date().toISOString(),
    request_id: params.requestId,
    endpoint: params.endpoint,
    method: params.method,
    payload_hash: params.payloadHash,
    client_build: params.clientBuild,
  }

  sink?.log(JSON.stringify(event))
}

/**
 * Log a boundary response event (JSON format).
 * Only logs if debug level is enabled.
 *
 * @param params - Response metadata
 */
export function logBoundaryResponse(params: {
  requestId: string
  endpoint: string
  status: number
  elapsedMs: number
  responseHash?: string
  service?: string
  serviceBuild?: string
  error?: string
}): void {
  if (!shouldLog('debug')) {
    return
  }

  const event: BoundaryResponseEvent = {
    event: 'boundary.response',
    timestamp: new Date().toISOString(),
    request_id: params.requestId,
    endpoint: params.endpoint,
    status: params.status,
    elapsed_ms: params.elapsedMs,
    ...(params.responseHash && { response_hash: params.responseHash }),
    ...(params.service && { service: params.service }),
    ...(params.serviceBuild && { service_build: params.serviceBuild }),
    ...(params.error && { error: params.error }),
  }

  sink?.log(JSON.stringify(event))
}

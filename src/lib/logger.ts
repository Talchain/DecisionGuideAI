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

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(event))
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

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(event))
}

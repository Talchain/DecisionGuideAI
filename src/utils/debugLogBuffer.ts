/**
 * Debug Log Buffer
 *
 * Singleton buffer that captures filtered console logs for debugging.
 * Intercepts console.log/warn/error and stores matching patterns.
 */

const DEBUG_LOG_PATTERNS = [
  'CEE_V2_OPTIONS_REQUEST',
  'CEE_ORCHESTRATOR',
  'V2Adapter',
  'downstream_calls',
  'boundary.request',
  'boundary.response',
  'useDebugData',
  'PayloadLab',
  '[useDebugData]',
  '[boundary]',
  '[CEE]',
  '[PLoT]',
  '[ISL]',
  'PLOT_RUN',
  'ISL_ROBUSTNESS',
]

export interface BufferedLog {
  /** Timestamp in ISO format */
  timestamp: string
  /** Log level */
  level: 'log' | 'warn' | 'error'
  /** Log message */
  message: string
  /** Additional data if provided */
  data?: unknown
}

/** Maximum number of log entries to buffer */
const MAX_BUFFER_SIZE = 200

/** The log buffer */
let logBuffer: BufferedLog[] = []

/** Whether interception is enabled */
let interceptEnabled = false

/** Original console methods */
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}

/**
 * Check if a message matches any of the debug patterns
 */
function matchesPattern(message: string): boolean {
  const upperMessage = message.toUpperCase()
  return DEBUG_LOG_PATTERNS.some((pattern) => upperMessage.includes(pattern.toUpperCase()))
}

/**
 * Add a log entry to the buffer
 */
function addToBuffer(level: 'log' | 'warn' | 'error', args: unknown[]): void {
  // Convert first argument to string message
  const message = args[0]?.toString() ?? ''

  // Check if it matches our patterns
  if (!matchesPattern(message)) {
    return
  }

  // Build log entry
  const entry: BufferedLog = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data: args.length > 1 ? args.slice(1) : undefined,
  }

  // Add to buffer
  logBuffer.push(entry)

  // Trim buffer if too large
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer = logBuffer.slice(-MAX_BUFFER_SIZE)
  }
}

/**
 * Enable log interception.
 * Safe to call multiple times - only enables once.
 */
export function enableLogInterception(): void {
  if (interceptEnabled) return

  console.log = (...args: unknown[]) => {
    addToBuffer('log', args)
    originalConsole.log(...args)
  }

  console.warn = (...args: unknown[]) => {
    addToBuffer('warn', args)
    originalConsole.warn(...args)
  }

  console.error = (...args: unknown[]) => {
    addToBuffer('error', args)
    originalConsole.error(...args)
  }

  interceptEnabled = true
}

/**
 * Disable log interception and restore original console methods.
 */
export function disableLogInterception(): void {
  if (!interceptEnabled) return

  console.log = originalConsole.log
  console.warn = originalConsole.warn
  console.error = originalConsole.error

  interceptEnabled = false
}

/**
 * Get all buffered logs.
 */
export function getBufferedLogs(): BufferedLog[] {
  return [...logBuffer]
}

/**
 * Clear the log buffer.
 */
export function clearLogBuffer(): void {
  logBuffer = []
}

/**
 * Get the current buffer size.
 */
export function getBufferSize(): number {
  return logBuffer.length
}

/**
 * Check if interception is currently enabled.
 */
export function isInterceptionEnabled(): boolean {
  return interceptEnabled
}

/**
 * Get logs filtered by level.
 */
export function getLogsByLevel(level: 'log' | 'warn' | 'error'): BufferedLog[] {
  return logBuffer.filter((entry) => entry.level === level)
}

/**
 * Get logs filtered by pattern.
 */
export function getLogsByPattern(pattern: string): BufferedLog[] {
  const upperPattern = pattern.toUpperCase()
  return logBuffer.filter((entry) => entry.message.toUpperCase().includes(upperPattern))
}

// Auto-enable interception in development mode
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  enableLogInterception()
}

/**
 * Reconnection Logic for Streaming
 *
 * Exponential backoff with jitter for SSE reconnection.
 *
 * Features:
 * - Exponential backoff: 2^n × 100ms + jitter
 * - Max delay: 5 seconds
 * - Max attempts: 3
 * - Fail → sync fallback
 * - Safari/WebKit fallback to EventSource
 * - Heartbeat awareness
 * - Idempotent completion (ignore duplicate 'done')
 *
 * Flags:
 * - VITE_PLOT_STREAM_RECONNECT=0|1 (default OFF)
 * - VITE_PLOT_STREAM_EVENTSOURCE_FALLBACK=0|1 (default OFF)
 */

export interface ReconnectionConfig {
  /** Max retry attempts */
  maxAttempts: number

  /** Base delay in milliseconds */
  baseDelay: number

  /** Max delay in milliseconds */
  maxDelay: number

  /** Jitter factor (0-1) */
  jitterFactor: number
}

export interface ReconnectionState {
  /** Current attempt number (0-indexed) */
  attempt: number

  /** Whether reconnection is enabled */
  enabled: boolean

  /** Whether reconnection is in progress */
  reconnecting: boolean

  /** Last error message */
  lastError?: string
}

const DEFAULT_CONFIG: ReconnectionConfig = {
  maxAttempts: 3,
  baseDelay: 100,
  maxDelay: 5000,
  jitterFactor: 0.3,
}

/**
 * Calculate exponential backoff delay with jitter
 * Formula: 2^n × baseDelay + random jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: ReconnectionConfig = DEFAULT_CONFIG
): number {
  const { baseDelay, maxDelay, jitterFactor } = config

  // Exponential: 2^attempt × baseDelay
  const exponential = Math.pow(2, attempt) * baseDelay

  // Add jitter: ±jitterFactor × exponential
  const jitter = exponential * jitterFactor * (Math.random() * 2 - 1)

  // Clamp to maxDelay
  const delay = Math.min(exponential + jitter, maxDelay)

  return Math.max(0, delay)
}

/**
 * Check if browser is Safari/WebKit
 */
export function isSafari(): boolean {
  if (typeof window === 'undefined' || !window.navigator) {
    return false
  }

  const ua = window.navigator.userAgent
  return (
    /Safari/.test(ua) &&
    !/Chrome/.test(ua) &&
    !/Chromium/.test(ua)
  )
}

/**
 * Check if EventSource fallback is enabled
 */
export function isEventSourceFallbackEnabled(): boolean {
  return String(import.meta.env.VITE_PLOT_STREAM_EVENTSOURCE_FALLBACK) === '1'
}

/**
 * Check if reconnection is enabled
 */
export function isReconnectionEnabled(): boolean {
  return String(import.meta.env.VITE_PLOT_STREAM_RECONNECT) === '1'
}

/**
 * Reconnection Manager
 *
 * Handles retry logic with exponential backoff
 */
export class ReconnectionManager {
  private config: ReconnectionConfig
  private state: ReconnectionState
  private timeoutId: number | null = null
  private completedOnce = false

  constructor(config: Partial<ReconnectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.state = {
      attempt: 0,
      enabled: isReconnectionEnabled(),
      reconnecting: false,
    }
  }

  /**
   * Get current state
   */
  getState(): Readonly<ReconnectionState> {
    return { ...this.state }
  }

  /**
   * Check if should retry
   */
  shouldRetry(): boolean {
    return (
      this.state.enabled &&
      this.state.attempt < this.config.maxAttempts
    )
  }

  /**
   * Schedule retry with exponential backoff
   * @returns Promise that resolves when retry should be attempted
   */
  scheduleRetry(): Promise<void> {
    if (!this.shouldRetry()) {
      return Promise.reject(new Error('Max retry attempts exceeded'))
    }

    const delay = calculateBackoffDelay(this.state.attempt, this.config)

    console.log(
      `[Reconnection] Scheduling retry ${this.state.attempt + 1}/${this.config.maxAttempts} in ${delay}ms`
    )

    this.state.reconnecting = true

    return new Promise((resolve, reject) => {
      this.timeoutId = window.setTimeout(() => {
        this.state.attempt++
        this.state.reconnecting = false
        resolve()
      }, delay)
    })
  }

  /**
   * Reset retry state (called on successful connection)
   */
  reset() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    this.state.attempt = 0
    this.state.reconnecting = false
    this.state.lastError = undefined
    this.completedOnce = false
  }

  /**
   * Record error
   */
  recordError(error: string) {
    this.state.lastError = error
    console.error('[Reconnection] Error:', error)
  }

  /**
   * Mark as completed (idempotent)
   * @returns true if this is the first completion, false if duplicate
   */
  markCompleted(): boolean {
    if (this.completedOnce) {
      console.warn('[Reconnection] Ignoring duplicate completion event')
      return false
    }

    this.completedOnce = true
    return true
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}

/**
 * Heartbeat Monitor
 *
 * Tracks SSE heartbeats to detect stalled connections
 */
export class HeartbeatMonitor {
  private lastHeartbeat: number = Date.now()
  private timeoutId: number | null = null
  private onTimeout: (() => void) | null = null

  constructor(
    private timeoutMs: number = 30000, // 30 seconds default
    onTimeout?: () => void
  ) {
    this.onTimeout = onTimeout || null
    this.start()
  }

  /**
   * Record a heartbeat (called when any data received)
   */
  beat() {
    this.lastHeartbeat = Date.now()
    this.resetTimer()
  }

  /**
   * Start monitoring
   */
  private start() {
    this.resetTimer()
  }

  /**
   * Reset timeout timer
   */
  private resetTimer() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId)
    }

    this.timeoutId = window.setTimeout(() => {
      const elapsed = Date.now() - this.lastHeartbeat
      console.warn(`[Heartbeat] Timeout after ${elapsed}ms`)
      this.onTimeout?.()
    }, this.timeoutMs)
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId)
      this.timeoutId = null
    }
  }
}

/**
 * Create retry wrapper for SSE connection
 */
export async function withReconnection<T>(
  connectFn: () => Promise<T>,
  config?: Partial<ReconnectionConfig>
): Promise<T> {
  const manager = new ReconnectionManager(config)

  while (true) {
    try {
      const result = await connectFn()
      manager.reset()
      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      manager.recordError(errorMsg)

      if (!manager.shouldRetry()) {
        console.error('[Reconnection] Max attempts exceeded, giving up')
        throw new Error(`Connection failed after ${manager.getState().attempt} attempts: ${errorMsg}`)
      }

      // Wait with exponential backoff
      await manager.scheduleRetry()

      // Continue to next attempt
      console.log('[Reconnection] Retrying connection...')
    }
  }
}

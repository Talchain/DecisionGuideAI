// src/lib/network.ts

/**
 * Network helpers: timeouts, AbortController wiring, and fetch wrapper.
 */

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

/**
 * Create an AbortController that auto-aborts after `ms`.
 * Returns the controller and a cleanup function to clear the timeout.
 */
export function createAbortControllerWithTimeout(ms: number): {
  controller: AbortController
  cleanup: () => void
} {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  const cleanup = () => clearTimeout(id)
  return { controller, cleanup }
}

/**
 * Combine two AbortSignals into one. Uses AbortSignal.any if available, otherwise
 * falls back to manually bridging abort events.
 */
export function combineSignals(a?: AbortSignal | null, b?: AbortSignal | null): AbortSignal | undefined {
  const signals = [a, b].filter(Boolean) as AbortSignal[]
  if (signals.length === 0) return undefined
  if (signals.length === 1) return signals[0]

  // Use AbortSignal.any if available (Node 20+, some modern browsers)
  const anyFn = (AbortSignal as any).any
  if (typeof anyFn === 'function') {
    try {
      return anyFn(signals)
    } catch {
      // fall through to manual bridge
    }
  }

  const controller = new AbortController()
  const onAbort = () => controller.abort()
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort()
      break
    }
    sig.addEventListener('abort', onAbort, { once: true })
  }
  return controller.signal
}

/**
 * fetchWithTimeout wraps global fetch, attaches a timeout-based AbortController,
 * and ensures the timeout is cleaned up when the request settles.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = 15000
): Promise<Response> {
  const { controller, cleanup } = createAbortControllerWithTimeout(timeoutMs)
  try {
    const signal = combineSignals(controller.signal, init.signal)
    const res = await fetch(input as any, { ...init, signal })
    return res
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new TimeoutError(`Request timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    cleanup()
  }
}

/**
 * Utility to wrap a promise with a timeout while also allowing abort.
 * Returns the result or throws TimeoutError.
 */
export async function withTimeout<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const { controller, cleanup } = createAbortControllerWithTimeout(timeoutMs)
  try {
    return await factory(controller.signal)
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new TimeoutError(`Operation timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    cleanup()
  }
}

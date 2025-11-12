/**
 * Runs Update Bus
 *
 * Minimal event hub for notifying observers when the runs list changes.
 * Used to enable live refresh of RunHistory without full remounts.
 */

type Listener = () => void

const listeners = new Set<Listener>()

/**
 * Event constant for runs updates
 */
export const RUNS_UPDATED = 'runs:updated'

/**
 * Subscribe to runs updates
 * @returns Unsubscribe function
 */
export function on(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * Emit a runs update event to all subscribers
 */
export function emit(): void {
  // Clone listeners to avoid issues if a listener modifies the set
  for (const fn of [...listeners]) {
    try {
      fn()
    } catch (error) {
      console.error('[runsBus] Listener error:', error)
    }
  }
}

/**
 * Remove a specific listener
 */
export function off(fn: Listener): void {
  listeners.delete(fn)
}

/**
 * Clear all listeners (primarily for testing)
 */
export function clear(): void {
  listeners.clear()
}

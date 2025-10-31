/**
 * Interim Findings Micro-Batch Queue
 *
 * Prevents re-render storms during SSE streaming by buffering interim findings
 * and flushing them in batches.
 *
 * Performance Strategy:
 * - Buffer window: 250ms (balances responsiveness vs. render cost)
 * - Max items: 50 (newest only, prevents unbounded memory growth)
 * - Scheduler: requestAnimationFrame fallback to setTimeout
 *
 * Usage:
 * ```ts
 * enqueueInterim((items) => {
 *   set(s => ({ results: { ...s.results, interim: items } }))
 * }, newFindings)
 * ```
 */

let buffer: string[] = []
let timer: number | null = null
const BATCH_WINDOW_MS = 250
const MAX_ITEMS = 50

/**
 * Enqueue interim findings for micro-batched flush
 *
 * @param push - Callback to push items to store (receives newest 50 items)
 * @param items - New interim findings to enqueue
 */
export function enqueueInterim(
  push: (items: string[]) => void,
  items: string[]
): void {
  // Add new items to buffer
  buffer.push(...items)

  // Already scheduled? Do nothing (coalesce updates)
  if (timer !== null) return

  // Schedule flush after BATCH_WINDOW_MS
  const flush = () => {
    // Keep only newest MAX_ITEMS
    const newest = buffer.slice(-MAX_ITEMS)
    buffer = []
    timer = null

    // Push to store
    push(newest)
  }

  // Use requestAnimationFrame for better performance, fallback to setTimeout
  if (typeof requestAnimationFrame !== 'undefined') {
    let rafScheduled = false
    timer = window.setTimeout(() => {
      if (!rafScheduled) {
        rafScheduled = true
        requestAnimationFrame(flush)
      }
    }, BATCH_WINDOW_MS)
  } else {
    timer = window.setTimeout(flush, BATCH_WINDOW_MS)
  }
}

/**
 * Clear interim queue (call on cancel or unmount)
 */
export function clearInterimQueue(): void {
  buffer = []
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}

/**
 * Get current queue size (for debugging)
 */
export function getInterimQueueSize(): number {
  return buffer.length
}

import { useEffect } from 'react'

/**
 * ⭐ THE LAYOUT ENGINE IS FETCHED WHEN THE CANVAS MOUNTS, NOT WHEN THE FIRST
 * DRAFT NEEDS IT (26 Sep 2026, olumi-programme-docs#70 5841781894).
 *
 * `applyLayout` reaches its code through three lazy chunks (`utils/layout`,
 * `layoutStore`, `measureNodeHeightsAtLabelBound`), and `utils/layout` reaches
 * ELK through a fourth. Staging publishes new hashed assets on every merge, and
 * the old ones then 404. A page opened before a deploy and drafted after it
 * therefore could not lay out its first model at all.
 * - Served UI c95694de, 01:07Z: `Failed to fetch dynamically imported module
 *   …/elk.bundled-BmqVXTkv.js`, `canvas.layout.failed`.
 * - The same failure on the founder's tab, 19 Sep (`handleLayoutWithRecovery`).
 * The first screen was the pre-layout pile, at 253%.
 *
 * Once a module has loaded, the page keeps it in memory, and every later
 * `import()` of it resolves without the network. So the fix is to load all four
 * while the page's own build is still the one being served: once, at idle,
 * after the canvas mounts. A failure here is SWALLOWED, never shown. The layout
 * call makes the same import and reports through `handleLayoutWithRecovery`,
 * which offers the reload.
 */
export function preloadLayoutEngine(): Promise<void> {
  return Promise.all([
    import('../utils/layout').then((m) => m.loadLayoutEngine()),
    import('../layoutStore'),
    import('../utils/measureNodeHeightsAtLabelBound'),
  ]).then(() => undefined)
}

/** How long the idle callback may wait before it is forced to run. */
export const LAYOUT_ENGINE_PRELOAD_TIMEOUT_MS = 1500

export function usePreloadLayoutEngine(preload: () => Promise<void> = preloadLayoutEngine): void {
  useEffect(() => {
    let done = false
    const run = () => {
      if (done) return
      done = true
      void preload().catch(() => {
        /* reported by the layout call itself, if it ever needs the engine */
      })
    }
    const w = typeof window !== 'undefined' ? (window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number
      cancelIdleCallback?: (h: number) => void
    }) : undefined
    if (w?.requestIdleCallback) {
      const h = w.requestIdleCallback(run, { timeout: LAYOUT_ENGINE_PRELOAD_TIMEOUT_MS })
      return () => { done = true; w.cancelIdleCallback?.(h) }
    }
    const t = setTimeout(run, 0)
    return () => { done = true; clearTimeout(t) }
  }, [preload])
}

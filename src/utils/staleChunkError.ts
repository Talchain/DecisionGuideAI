/**
 * ⭐⭐ A DEPLOY REPLACES THE HASHED ASSETS. AN OPEN TAB STILL POINTS AT THE OLD
 * ONES. EVERY LAZY IMPORT IT HAS NOT YET MADE IS NOW A 404.
 *
 * THE INCIDENT, measured end to end on 19 Sep 2026 — the founder's own tab.
 * "Layout failed. Try again." had been open since 26 Aug (#860) with TWO
 * theories refuted by execution: bad graph input, then a timing race. Both
 * refutations were correct. The cause was never in the app at all:
 *
 *   page loaded on build f22e15fd
 *   18:12:44Z  staging deployed 09411c54 — hashed assets replaced
 *   18:16:01Z  he sends a message; the canvas drafts and reaches for ELK
 *              GET /assets/elk.bundled-BgtF8tzk.js  ->  404
 *              TypeError: Failed to fetch dynamically imported module
 *
 * `utils/layout.ts:618` holds ELK behind `await import('elkjs/...')`, so the
 * layout engine's code is fetched at first use — which can be minutes after the
 * page loaded, and on the other side of a deploy. Verified afterwards: that
 * exact URL still returns 404 while the current build serves a differently
 * hashed chunk.
 *
 * ⛔⛔ AND THE BANNER OFFERED "Try again", WHICH COULD NEVER WORK. The chunk is
 * gone from the origin permanently; a retry re-requests the same dead URL. The
 * founder pressed Retry, then Auto-arrange, and reported neither helped —
 * correctly, and the product had told him to do both. **An affordance that
 * cannot succeed is worse than no affordance**: it converts a ten-second reload
 * into an unbounded loop and makes the user believe their model is broken.
 *
 * ⚠ WHY THIS WAS INVISIBLE FOR THREE WEEKS, which is the part worth keeping.
 * It cannot reproduce locally — a dev server does not replace its own assets
 * under a live page — and on staging the evidence was destroyed twice over:
 * `console.*()` call sites are stripped at build time (two strippers in
 * `vite.config.ts`, one unconditional, with `ci:no-console` failing the build
 * if any survive), and the breadcrumb ring that replaced them was never read
 * back into the debug bundle (#1765). The one line that named the cause was a
 * browser console the user happened to have open.
 *
 * ⚠ THE MESSAGES ARE BROWSER-SPECIFIC AND NONE OF THEM IS A TYPED ERROR. There
 * is no `error.code` to key on: the platforms disagree on wording and each has
 * changed it before. The corpus below is therefore matched loosely and
 * deliberately errs towards OVER-detection — the cost of a false positive is
 * offering a reload that was not needed, and the cost of a false negative is
 * the incident above, unbounded.
 */

/**
 * The real messages, by engine. Each entry is a substring, lower-cased at the
 * point of comparison so a wording change in capitalisation cannot defeat it.
 *
 * ⛔ DO NOT NARROW THESE TO THE ONE WE SAW. Chrome's is the message in the
 * founder's console; the others are the same failure on engines we ship to and
 * did not witness, and leaving them out would make this guard a report about
 * one browser rather than about the condition.
 */
const STALE_CHUNK_SIGNATURES = [
  // Chromium — the founder's capture, verbatim.
  'failed to fetch dynamically imported module',
  // Firefox.
  'error loading dynamically imported module',
  // Safari / WebKit.
  'importing a module script failed',
  'module source uri is not allowed',
  // Bundler-level chunk loaders (webpack-style, and Vite's CSS preloader).
  'loading chunk',
  'loading css chunk',
  'unable to preload css',
  // Generic import failure surfaced by some proxies.
  'failed to import',
] as const

/**
 * Is this error a stale asset reference rather than a fault in our own code?
 *
 * ⭐ IT WALKS `cause`. A dynamic-import rejection is routinely re-thrown by a
 * wrapper — `runLayoutWithProgress` is one — and a detector that reads only the
 * top-level message answers about the wrapper instead of the failure. Depth is
 * bounded so a cyclic `cause` cannot hang the error path.
 */
export function isStaleChunkError(err: unknown): boolean {
  let cur: unknown = err
  for (let depth = 0; depth < 5 && cur != null; depth += 1) {
    const text = typeof cur === 'string'
      ? cur
      : `${(cur as { name?: unknown }).name ?? ''} ${(cur as { message?: unknown }).message ?? ''}`
    const hay = text.toLowerCase()
    if (STALE_CHUNK_SIGNATURES.some(sig => hay.includes(sig))) return true
    cur = (cur as { cause?: unknown }).cause
  }
  return false
}

/**
 * What to tell someone whose tab is older than the deploy.
 *
 * ⚠ IT NAMES THE CAUSE AND THE CURE, AND CLAIMS NOTHING ABOUT THEIR MODEL.
 * "Layout failed" reads as *your graph is broken*; it is not, and nothing has
 * been lost. The one action that works is a reload, so that is the one action
 * offered.
 */
export const STALE_CHUNK_MESSAGE =
  'A new version of Olumi was released while this tab was open. Reload to continue — nothing in your model is lost.'

/** The verb on the button in this state. Never "Retry" — see the store's `actionLabel`. */
export const STALE_CHUNK_ACTION_LABEL = 'Reload'

/** The only cure: fetch the current HTML, and with it the current asset names. */
export function reloadForNewVersion(): void {
  if (typeof window !== 'undefined') window.location.reload()
}

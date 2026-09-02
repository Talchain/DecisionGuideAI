/**
 * `React.lazy`, with the wait BOUNDED.
 *
 * ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────
 * A lazy route chunk that FAILS is handled well: the `import()` rejects, React
 * unwinds to `CanvasErrorBoundary`, and the user gets a named cause and
 * "Reload editor". A lazy route chunk that STALLS is handled not at all: the
 * request never completes, so the promise never settles, so no boundary is ever
 * involved and React holds the Suspense fallback. The user sits on
 * "Loading Canvas..." with no timeout, no message and no way out.
 *
 * ⭐ THE ASYMMETRY *WAS* THE DEFECT. Both halves already existed except the one
 * line that turns the second case into the first.
 *
 * Measured on staging 2026-09-02 (Core E2E artefacts, run 33556631726): 59
 * requests, all HTTP 200 except `/assets/ReactFlowGraph-*.js`, which never
 * completed — and ZERO console errors, because nothing rejected. The page
 * snapshot at 60 s was `status "Loading Canvas"` and nothing else. Same
 * signature in runs 33578060840, 33581772301 and 33546491489.
 *
 * ⚠ AND THE STALLED FILE WAS NOT THE LAZY MODULE ITSELF. `CanvasMVP` imports
 * `ReactFlowGraph` STATICALLY (deliberately — see
 * `src/routes/__tests__/CanvasMVP.serverGraphHydration.spec.tsx`), so it is a
 * static dependency of the lazily-loaded chunk. Confirmed at the deployed bytes:
 * `CanvasMVP-BNoXst43.js` carries `from"./ReactFlowGraph-C-rUd9kz.js"`, and the
 * closure `import()` must complete is **37 modules / 984 KB transferred**.
 * `import()` cannot settle until every one of them has loaded, so ANY of the 37
 * stalling produces this. That is why the bound belongs at the lazy boundary
 * ABOVE `CanvasMVP` and not at the file that happened to stall.
 *
 * ── ⚠⚠ WHY THERE IS NO RETRY HERE, AND WHY ADDING ONE IS A REGRESSION ───────
 * The obvious shape — one retry, then surface — was MEASURED IN A REAL BROWSER
 * before being rejected (see `staleBuildRecovery.ts`'s header for the full
 * table). A retry of the same specifier cannot recover in EITHER direction:
 *
 *   · while the fetch is stalled, a second `import()` JOINS THE SAME in-flight
 *     request and is equally pending (measured: still pending after 3 s);
 *   · after a rejection, the browser has cached the module-map failure and
 *     returns it again — measured with the route REMOVED and the network
 *     healthy, and it still rejected.
 *
 * And Vite bakes the specifier at build time, so there is no URL here to
 * cache-bust. **The retry that works is a document reload**, which the error
 * boundaries already perform exactly once under a shared rate limit. A
 * `loader()` retry would add latency, double nothing useful, and read as
 * recovery while recovering nothing.
 */
import { lazy, type ComponentType } from 'react'
import { CHUNK_STALL_BOUND_MS, createChunkStallError } from './staleBuildRecovery'

/**
 * Race a module load against the bound. Exported separately from the `lazy()`
 * wrapper so a test can drive it directly with fake timers — the React path is
 * proven in a real browser, but the settle logic is worth pinning cheaply too.
 *
 * FAIL-SAFE IN THE DIRECTION THAT MATTERS: a load that beats the bound resolves
 * exactly as before, and a load that rejects on its own rejects with ITS OWN
 * error, untouched — so the stale-build path keeps its true sentence and its
 * existing behaviour. This wrapper only ever converts SILENCE into an error.
 */
export function loadWithStallBound<T>(
  loader: () => Promise<T>,
  what: string,
  boundMs: number = CHUNK_STALL_BOUND_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(createChunkStallError(what, boundMs))
    }, boundMs)

    loader().then(
      (mod) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(mod)
      },
      (error) => {
        // ⚠ Handled even after we have already rejected, deliberately: dropping
        // this arm would turn a late loader rejection into an unhandled promise
        // rejection, which some hosts escalate to a page-level error event.
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Drop-in for `lazy(() => import('...'))`.
 *
 * `what` names the thing the user was waiting for, and it reaches the SCREEN:
 * `CanvasErrorBoundary` prints `error.message` verbatim. Use the user's word for
 * the surface ("The canvas"), not the module identifier.
 */
// Mirrors React's own `lazy` signature, which is `<T extends ComponentType<any>>`.
// Narrowing it (e.g. to `ComponentType<never>`) makes every real call site fail
// to assign — measured, not assumed.
export function lazyWithStallBound<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  what: string,
  boundMs: number = CHUNK_STALL_BOUND_MS,
) {
  return lazy(() => loadWithStallBound(loader, what, boundMs))
}

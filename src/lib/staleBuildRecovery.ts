/**
 * THE SINGLE WRITER for "a chunk this page needs did not arrive".
 *
 * ── THE SITUATION THIS MODULE NAMES ─────────────────────────────────────────
 * Vite emits content-hashed chunk filenames, so every deploy retires the
 * previous deploy's names. A browser that loaded the app BEFORE a deploy still
 * holds the old names in its module graph, and its next lazy `import()` asks
 * for a file that is no longer published. The import rejects, React unwinds to
 * the nearest boundary, and the feature is dead in that tab.
 *
 * ⚠ THE SERVER IS FINE. Nothing failed, nothing crashed, no request errored in
 * any way the user caused or can act on except one: reload, and get the current
 * build. Copy that blames the server, the network, or the user's own action is
 * false here — which is why the sentence lives in this module and nowhere else.
 *
 * Until this module existed the two boundaries that can catch this disagreed:
 * `CanvasErrorBoundary` knew about chunk errors and auto-reloaded once, while
 * `BootErrorBoundary` — which catches the FIRST chunk that can fail, the
 * top-level `AppPoC` lazy import — was chunk-blind and rendered a dead end.
 * Both now consume this. `tests/ci-guards/stale-build-recovery-single-writer.spec.ts`
 * fails if a second detector, a second sentence or a second guard key appears.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * ⭐ THE SECOND CAUSE, ADDED 2026-09-02: A CHUNK THAT STALLS RATHER THAN FAILS.
 *
 * Everything above is about an import that REJECTS. A chunk request that simply
 * never completes does not reject — it leaves the `import()` promise PENDING,
 * forever, with no console error and no boundary involvement, so React holds the
 * Suspense fallback and the user sits on a spinner with no timeout, no message
 * and no way out.
 *
 * MEASURED, not inferred (2026-09-02, deployed staging, Chromium, `page.route`
 * holding `/assets/CanvasMVP-*.js` open without fulfilling or aborting):
 *
 *     control (no route)            -> resolved          [the probe can see a success]
 *     request held open, +15s       -> PENDING, 0 console output
 *     `import()` again, same URL    -> PENDING           [joins the same in-flight fetch]
 *     request released              -> resolved
 *     request ABORTED               -> rejected "Failed to fetch dynamically imported module"
 *     `import()` again after abort  -> REJECTED AGAIN, route removed, network healthy
 *
 * ⚠⚠ THE LAST TWO LINES KILL THE OBVIOUS FIX. A retry of the same specifier
 * CANNOT recover, in EITHER direction: while the fetch is stalled a second
 * `import()` joins the same pending request, and after a rejection the browser
 * has cached the module-map failure and returns it again. And the specifier is
 * baked by Vite at build time, so there is no URL to cache-bust. **The only retry
 * that works is a document RELOAD** — which is what the panel's own button does,
 * under the user's control. Do not add a `loader()` retry: it is measured
 * theatre, and it would delay the panel by exactly the time it wastes.
 *
 * A stall and a stale build are TWO CAUSES OF ONE HARM, and they need naming
 * apart rather than collapsing (CLAUDE.md trap 21). They differ in exactly one
 * thing — the true sentence. "Olumi was updated" is false when a byte stream
 * stopped, and this module exists precisely so a false sentence cannot be told.
 * The questions, written down:
 *
 *   isChunkLoadError(e)        did a module FAIL to load?   -> stale-build sentence
 *                                                           -> AND the one auto-reload
 *   isChunkStallError(e)       did a module NEVER ARRIVE?   -> stall sentence
 *   isChunkDeliveryFailure(e)  either of the above?         -> a NAMED notice, not the
 *                                                              generic crash panel
 *
 * ⚠ The auto-reload hangs off the FIRST question only, and `isChunkDeliveryFailure`
 * says why. A stall that auto-reloaded would wait the bound twice.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/**
 * What the user is told. ONE sentence, and it is true:
 *   · it names the real cause (a new version was published), not a failure;
 *   · it does not claim the server, the network or the user did anything wrong;
 *   · it states the way forward, which is the action the button performs.
 */
export const STALE_BUILD_NOTICE_COPY =
  'Olumi was updated while this page was open, so part of it could not load. Reload to get the current version.'

/** The action that makes the sentence above actionable. */
export const STALE_BUILD_ACTION_COPY = 'Reload'

/**
 * Rate limit for the AUTOMATIC reload.
 *
 * One reload fixes a deploy race, because the new index.html references the new
 * chunks. More than one in a short window means something else is wrong, and
 * reloading again would be an invisible loop the user cannot escape. After the
 * first attempt the boundaries show the notice with its button instead, so the
 * next reload is the user's decision — the product never silently retries
 * forever.
 */
export const CHUNK_RELOAD_GUARD_KEY = 'olumi-chunk-reload-at'
export const CHUNK_RELOAD_GUARD_WINDOW_MS = 5 * 60 * 1000

/**
 * Detect a failed-lazy-chunk error (deploy race / stale index.html). Message
 * shapes across browsers: Chrome "Failed to fetch dynamically imported module",
 * Firefox "error loading dynamically imported module", Safari "Importing a
 * module script failed", plus the MIME-type refusal a SPA fallback produces
 * ("Failed to load module script") and webpack-era "Loading chunk N failed"
 * kept for safety.
 *
 * ⭐ AND THE CSS HALF, WHICH IS NOT A BROWSER STRING. Every shape above is
 * emitted by the BROWSER when a script fails. A lazy route's STYLESHEET fails
 * somewhere else entirely: Vite's own `preload()` helper attaches a `load`/
 * `error` pair to the injected `<link rel="stylesheet">` and rejects with
 * `Unable to preload CSS for ${dep}`, which `handlePreloadError` then rethrows
 * — so it unwinds to a React boundary exactly like a retired script does.
 *
 * That asymmetry is why this shape sat unmatched. In Vite's helper ONLY css
 * deps get a rejecting promise; a failed JS dep falls through to `baseModule()`
 * and surfaces as the browser's message. So a retired CSS chunk and a retired
 * JS chunk are the same deploy race wearing two different vocabularies, and
 * until now the product recognised only one of them: the user was told "the
 * canvas encountered an unexpected error", which blames the app for a deploy
 * race and withholds the one action that fixes it. Witnessed on staging in
 * Core E2E run 33571760150 (2026-09-01), on
 * `/assets/ReactFlowGraph-<hash>.css`.
 *
 * ⚠ THE CSS ALTERNATIVE IS DELIBERATELY THE WHOLE PHRASE, NOT A KEYWORD.
 * Widening in this direction is asymmetrically dangerous: a missed shape costs
 * a bad sentence, but a FALSE POSITIVE tells a user to reload for a defect a
 * reload cannot fix, and hides the real error behind "Olumi was updated".
 * `Unable to preload CSS for` is the producer's literal prefix and cannot be
 * reached by an unrelated error that merely mentions CSS. The near-misses in
 * `__tests__/staleBuildRecovery.spec.ts` pin that.
 */
/**
 * ⭐ THE WITNESSED SHAPES, EXPORTED SO THERE IS ONE OWNER.
 *
 * Three hand-written copies of this list existed at one point — the product
 * spec, the boundary spec, and the Core E2E guard — and the copy is this
 * estate's dominant defect class: a list a human must remember to sync WILL
 * drift, and the drift always reads as green. Concretely, the CSS shape below
 * was added to the predicate while the guard's copy stayed short, so its union
 * assertion would have kept passing while testing one shape fewer.
 *
 * Both directions matter and neither guard is sufficient alone: DERIVATION
 * cannot notice that this list is SHORT, and a CORPUS cannot notice that a
 * consumer has drifted from the product. So this list is the corpus, and the
 * consumers derive from it.
 *
 * Every entry is a shape actually observed, not a guess. Add to it only with a
 * witness — a run id, or the producer's own source.
 */
export const CHUNK_LOAD_ERROR_SHAPES: readonly string[] = [
  // Chrome
  'Failed to fetch dynamically imported module: https://x/assets/canvas-abc.js',
  // Firefox
  'error loading dynamically imported module',
  // Safari
  'Importing a module script failed.',
  // The shape a SPA fallback produces — 200 text/html where JS was expected.
  'Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html".',
  // webpack era, kept for safety
  'Loading chunk 42 failed.',
  'ChunkLoadError',
  // Vite's own, and the ONLY entry the browser does not emit. In Vite's
  // `preload()` helper only CSS deps get a rejecting promise; a failed JS dep
  // falls through and surfaces as the browser's message above. Same deploy race,
  // two vocabularies — which is exactly why this one sat unmatched.
  // Witnessed on staging, Core E2E run 33571760150 (2026-09-01).
  'Unable to preload CSS for /assets/ReactFlowGraph-CD2a-IkG.css',
]

/**
 * The negative corpus — and it is not decoration. Over-matching is the DANGEROUS
 * direction: a false positive tells a user to reload for a defect a reload cannot
 * fix, and buries the real error behind "Olumi was updated". Each entry kills a
 * different plausible over-broad rewrite.
 */
export const CHUNK_LOAD_NEAR_MISSES: readonly string[] = [
  'Cannot read properties of undefined (reading "id")',
  'Network request failed',
  'Analysis returned no options',
  'Maximum update depth exceeded',
  // kills /Unable to load/ or a bare /CSS/ mention
  'Unable to load the stylesheet',
  // kills a loose /preload.*CSS/i that ignores Vite's word order
  'Failed to preload the CSS bundle',
]

export function isChunkLoadError(error: Error | null | undefined): boolean {
  if (!error) return false
  const message = `${error.name ?? ''} ${error.message ?? ''}`
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to load module script|Loading chunk [\w-]+ failed|ChunkLoadError|Unable to preload CSS for/i.test(
    message
  )
}

/**
 * ⭐ THE BOUND. A CHOSEN NUMBER INSIDE A MEASURED INTERVAL — and it says so,
 * because "derived" is a stronger word than this evidence supports.
 *
 * ── WHAT WAS MEASURED (2026-09-02, Chromium, deployed staging build) ────────
 * The thing the bound is about is the whole settle time of
 * `import('../routes/CanvasMVP')`: React.lazy waits for the ENTIRE STATIC MODULE
 * CLOSURE of the chunk, not for one file. Derived from the deployed bytes by BFS
 * over the `from"./X.js"` edges: **37 modules, 984 KB transferred**, of which
 * `ReactFlowGraph` alone is 2.08 MB uncompressed. Fresh browser context per
 * sample, so every sample is a first-visit user with a cold HTTP cache.
 *
 *     network                              N    median     p90       max     all OK?
 *     ------------------------------------------------------------------------------
 *     unthrottled                          12     576 ms   888 ms   1,217 ms   12/12
 *     "Fast 3G"  (1.6 Mbps / 150 ms RTT)    6   5,314 ms  5,390 ms  5,649 ms    6/6
 *     "Slow 3G"  (400 kbps / 400 ms RTT)    5  20,757 ms 20,773 ms 20,899 ms    5/5
 *     200 kbps / 600 ms RTT                 3  40,840 ms       —   40,848 ms    3/3
 *
 * ── THE INTERVAL, AND WHY BOTH EDGES ARE REAL ───────────────────────────────
 * LOWER edge — the slowest SUCCESSFUL load we intend to keep. Every Slow-3G
 * sample succeeded, taking over twenty seconds. **A bound of 12 s would convert
 * every Slow-3G user's working session into "something went wrong".** That
 * direction is the one that hurts real people, and it is why the number here is
 * not the first plausible-sounding one.
 * UPPER edge — the harm. The Core E2E artefacts show the spinner still on screen
 * after 60 s, and nothing was ever going to end it.
 *
 * ── THE CHOICE, AND ITS COST STATED PLAINLY ─────────────────────────────────
 * CHOSEN, not derived: the measurements bound the interval, they do not pick a
 * point in it. The asymmetry decides where to sit: a false timeout costs a user
 * a working session, while an over-generous bound costs a genuinely stalled user
 * a few more seconds of a spinner they were going to stare at forever.
 *
 * At 45 s: Slow 3G clears it with **2.15× headroom** (20.9 s measured max). The
 * 200 kbps profile — worse than any DevTools preset — clears it with only ~10%,
 * and **below roughly 180 kbps a HEALTHY load would be reported as a failure**.
 * That is the real limit of this fix and it is named here rather than discovered
 * later by whoever is on that connection.
 *
 * ── ⭐ THE BETTER INSTRUMENT, MEASURED AND DELIBERATELY NOT BUILT ────────────
 * An INACTIVITY bound — reset the deadline whenever another module of the
 * closure completes — is insensitive to total payload (which every release
 * grows) and sensitive only to the largest single asset. The same runs recorded
 * the number it would need to survive: the largest gap between completed asset
 * fetches during a HEALTHY 200 kbps load was **16.2 s** (3/3), set by
 * `ReactFlowGraph` at 2.08 MB. So a ~25 s inactivity bound would fire sooner on
 * a stall AND tolerate arbitrarily slow connections. It is not built here
 * because it is a materially more complex predicate — it must filter
 * `PerformanceObserver` entries to same-origin script-initiated `/assets/` or an
 * unrelated app fetch silently resets it forever — and this estate's chronic
 * defect is exactly a predicate whose breadth nobody bounded. Recorded with its
 * measurement so it is a decision someone can pick up, not a rediscovery.
 *
 * ⭐ AND THE RELOAD IS CHEAP, which is what makes generosity affordable rather
 * than merely kind: `/assets/*` is served `cache-control: public, max-age=31536000,
 * immutable` (read at the deployed headers), so the reload that follows a stall
 * re-uses the 36 modules that DID arrive and re-requests only the one that did
 * not. The recovery does not re-download 984 KB, and the user's wait is not
 * doubled.
 *
 * ⚠ RE-MEASURE, DO NOT INHERIT. This closure grows with the app: the interval's
 * lower edge is a function of a payload that every release moves. `.measure/`
 * scripts are not committed — re-derive with a cold-context `import()` timing
 * sweep against the deployed build before trusting this number.
 */
export const CHUNK_STALL_BOUND_MS = 45_000

/**
 * The measurement above, in a form a test can assert against, so the constant
 * and its justification cannot drift apart (CLAUDE.md trap 12 — a number whose
 * evidence lives only in a comment is a hand-maintained mirror).
 */
export const CHUNK_STALL_BOUND_EVIDENCE = {
  /**
   * The slowest SUCCESSFUL settle on the slowest connection this bound CLAIMS to
   * keep. A bound at or below this is a false alarm for every such user.
   */
  slowestSupportedProfile: 'Chrome DevTools "Slow 3G" — 400 kbps / 400 ms RTT',
  slowestSupportedMaxMs: 20_899,
  slowestSupportedN: 5,
  /**
   * ⚠ The slowest successful settle measured AT ALL — a profile worse than any
   * DevTools preset. It still clears the bound, but by ~10%, and that margin is
   * the honest edge of this fix.
   */
  worstMeasuredProfile: '200 kbps / 600 ms RTT',
  worstMeasuredMaxMs: 40_848,
  worstMeasuredN: 3,
  /** Silent-spinner duration in the Core E2E artefacts — the harm being bounded. */
  observedSilentSpinnerMs: 60_000,
  /** Fastest healthy settle measured, ms — the other end of the real-world range. */
  fastestHealthyMs: 470,
  /** Largest quiet period during a HEALTHY 200 kbps load — see the inactivity note. */
  largestHealthyGapMs: 16_289,
  claimType: 'chosen within a measured interval, not derived',
} as const

/** Marks the stall error apart from every other Error, without parsing prose. */
export const CHUNK_STALL_ERROR_NAME = 'ChunkStallError'

/**
 * What the user is told when a chunk never arrived. ONE sentence, and — as with
 * the stale-build sentence above — it is true of what we actually know:
 *   · a part of the app did not finish downloading. That is the whole of it;
 *   · it does not claim the server failed, the network failed, or the user did
 *     anything, because the measurement CANNOT distinguish a stalled CDN
 *     response from a stalled connection, and naming either would be a guess
 *     printed as a fact;
 *   · it states the way forward, which is the action the button performs.
 */
export const CHUNK_STALL_HEADING_COPY = 'Olumi could not finish loading'
export const CHUNK_STALL_NOTICE_COPY =
  'Part of Olumi did not finish downloading, so this view could not open. Reload to try again.'

/**
 * Build the error a bounded loader rejects with when the wait expires.
 *
 * ⚠ The message is USER-VISIBLE: `CanvasErrorBoundary` prints `error.message`
 * verbatim in its detail box. It names what happened and nothing it cannot
 * support.
 */
export function createChunkStallError(what: string, waitedMs: number): Error {
  const error = new Error(`${what} did not finish loading within ${Math.round(waitedMs / 1000)}s`)
  error.name = CHUNK_STALL_ERROR_NAME
  return error
}

/**
 * "Did a module NEVER ARRIVE?" — a different question from `isChunkLoadError`'s
 * "did a module FAIL to load?", and deliberately not folded into it.
 *
 * ⚠ Bound by NAME, not by message text. Binding a detector to prose it does not
 * own is how a rename silently un-detects a condition (CLAUDE.md trap 19); the
 * name is set by `createChunkStallError` in this same module, so there is one
 * writer for both halves.
 */
export function isChunkStallError(error: Error | null | undefined): boolean {
  return !!error && error.name === CHUNK_STALL_ERROR_NAME
}

/**
 * "Is this a chunk that did not arrive, whatever the cause?" — the question that
 * decides whether a boundary shows a NAMED notice with a way forward, or the
 * generic crash panel. Both causes say yes; each still gets its own sentence.
 *
 * ⚠⚠ AND IT IS DELIBERATELY *NOT* THE QUESTION THE AUTO-RELOAD ASKS. That one
 * stays `isChunkLoadError`, and the difference is load-bearing:
 *
 *   · a STALE BUILD is fixed by a reload essentially always — the new
 *     index.html names chunks that exist — so reloading silently is a free win
 *     and the user usually never sees a panel at all;
 *   · a STALL is not. If it was transient a reload fixes it; if it was not, the
 *     reloaded page stalls again and the user waits a SECOND full
 *     `CHUNK_STALL_BOUND_MS` before anything appears. **That doubles a 45 s wait
 *     to 90 s — barely better than the unbounded spinner this whole change
 *     exists to remove**, and buys only the one click the panel's own Reload
 *     button already offers.
 *
 * So a stall surfaces the panel at the bound, ONCE, and the next move is the
 * user's. Recorded as a decision rather than left as an absence, because "why
 * doesn't the stall auto-reload like the stale build does?" is exactly the kind
 * of apparent inconsistency a later session reconciles by aligning the two —
 * which is the wrong fix (CLAUDE.md trap 21). They answer different questions.
 */
export function isChunkDeliveryFailure(error: Error | null | undefined): boolean {
  return isChunkLoadError(error) || isChunkStallError(error)
}

/**
 * HashRouter guard: a reload must land back on the SAME route. `location.reload()`
 * preserves the hash, but the recorded replaceState-desync gotcha means the
 * visible hash can have been dropped by earlier history writes — and a guest
 * reloading WITHOUT a route hash lands on the sign-in gate, which reads as
 * total data loss. If the hash is not a route, pin it to the canvas first.
 */
export function ensureRouteHash(): void {
  try {
    if (!window.location.hash || !window.location.hash.startsWith('#/')) {
      window.location.hash = '#/canvas'
    }
  } catch {
    // Fail-soft: reloading with the current URL is still better than nothing.
  }
}

/**
 * Attempt ONE automatic reload, rate-limited.
 *
 * Returns whether a reload was scheduled, so a caller can decide what to render
 * in the meantime. Deferred past the current commit phase — never reload
 * mid-render.
 *
 * Fail-soft in both directions: if `sessionStorage` is unreadable we treat it
 * as recently attempted and do NOT reload, because an unguarded loop is far
 * worse than showing the notice.
 */
export function attemptStaleBuildReload(now: number = Date.now()): boolean {
  if (typeof window === 'undefined') return false

  let lastAttempt = 0
  try {
    lastAttempt = Number(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)) || 0
  } catch {
    return false
  }

  if (now - lastAttempt <= CHUNK_RELOAD_GUARD_WINDOW_MS) return false

  try {
    sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(now))
    ensureRouteHash()
    setTimeout(() => window.location.reload(), 0)
    return true
  } catch {
    return false
  }
}

/** The action the notice's button performs. Separated so a test can drive it. */
export function reloadForCurrentBuild(): void {
  try {
    ensureRouteHash()
    window.location.reload()
  } catch {
    // Nothing further we can do; the user still has the browser's own reload.
  }
}

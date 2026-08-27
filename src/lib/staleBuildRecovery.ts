/**
 * THE SINGLE WRITER for "this page is running a build that no longer exists".
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
 */
export function isChunkLoadError(error: Error | null | undefined): boolean {
  if (!error) return false
  const message = `${error.name ?? ''} ${error.message ?? ''}`
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to load module script|Loading chunk [\w-]+ failed|ChunkLoadError/i.test(
    message
  )
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

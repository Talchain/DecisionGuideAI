/**
 * Behaviour of the single stale-build recovery module.
 *
 * The single-writer guard (tests/ci-guards/stale-build-recovery-single-writer.spec.ts)
 * proves there is ONE detector and ONE sentence. This file proves the one there
 * is actually works — and, specifically, the two properties the brief names:
 * the user is told something TRUE, and the product does NOT silently retry
 * forever.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  attemptStaleBuildReload,
  CHUNK_RELOAD_GUARD_KEY,
  CHUNK_RELOAD_GUARD_WINDOW_MS,
  ensureRouteHash,
  isChunkLoadError,
  STALE_BUILD_ACTION_COPY,
  STALE_BUILD_NOTICE_COPY,
} from '../staleBuildRecovery'

describe('staleBuildRecovery — detector', () => {
  it('recognises the real browser message shapes', () => {
    const yes = [
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
      // ⭐ VITE'S OWN CSS SHAPE — and the only one on this list that Vite emits
      // itself rather than the browser. Derived from the producer, not guessed:
      // node_modules/vite/dist/node/chunks/*.js builds `Unable to preload CSS
      // for ${dep}` in the stylesheet `error` listener inside `preload()`, then
      // `handlePreloadError` RETHROWS it, so it unwinds to a React boundary
      // exactly like a failed JS chunk.
      //
      // Why it went unmatched for so long: in that same helper only CSS deps
      // get a rejecting promise. A failed JS dep falls through to `baseModule()`
      // and surfaces as the BROWSER's "Failed to fetch dynamically imported
      // module" — which is why every other entry on this list is a browser
      // string and this one is not. The asymmetry is in Vite, not in us.
      //
      // Witnessed on staging in Core E2E run 33571760150 (2026-09-01): a lazy
      // route's retired CSS chunk rendered "The canvas encountered an
      // unexpected error", blaming the app for a deploy race.
      'Unable to preload CSS for /assets/ReactFlowGraph-CD2a-IkG.css',
    ]
    for (const m of yes) expect(isChunkLoadError(new Error(m)), m).toBe(true)
  })

  it('CONTRAST: rejects ordinary application errors', () => {
    // Without this arm the detector could be `() => true` and every test above
    // would still pass, turning every crash into "Olumi was updated".
    const no = [
      'Cannot read properties of undefined (reading "id")',
      'Network request failed',
      'Analysis returned no options',
      'Maximum update depth exceeded',
      // ⚠ NEAR-MISSES FOR THE CSS SHAPE. Over-matching is the DANGEROUS
      // direction here: a false positive tells the user to reload for a defect
      // reloading cannot fix, and buries the real error behind "Olumi was
      // updated". These two are not decoration — each kills a different
      // plausible over-broad rewrite of the pattern:
      //   · /Unable to load/ or a bare /CSS/ mention
      'Unable to load the stylesheet',
      //   · a loose /preload.*CSS/i that ignores Vite's word order
      'Failed to preload the CSS bundle',
    ]
    for (const m of no) expect(isChunkLoadError(new Error(m)), m).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
  })

  it('matches on the error NAME as well as the message', () => {
    const e = new Error('boom')
    e.name = 'ChunkLoadError'
    expect(isChunkLoadError(e)).toBe(true)
  })
})

describe('staleBuildRecovery — copy is true and actionable', () => {
  it('never blames the server, the network or the user', () => {
    expect(STALE_BUILD_NOTICE_COPY).not.toMatch(/server|network|offline|your connection|error/i)
  })

  it('names the real cause and the way forward', () => {
    expect(STALE_BUILD_NOTICE_COPY).toMatch(/updated/i)
    expect(STALE_BUILD_NOTICE_COPY).toMatch(/reload/i)
    expect(STALE_BUILD_ACTION_COPY).toMatch(/reload/i)
  })
})

describe('staleBuildRecovery — one reload, never a loop', () => {
  const reload = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    reload.mockClear()
    sessionStorage.clear()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload, hash: '#/canvas' },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reloads once when nothing has been attempted', () => {
    const now = 1_000_000
    expect(attemptStaleBuildReload(now)).toBe(true)
    vi.runAllTimers()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)).toBe(String(now))
  })

  it('does NOT reload again inside the guard window — the notice shows instead', () => {
    const now = 1_000_000
    attemptStaleBuildReload(now)
    vi.runAllTimers()
    reload.mockClear()

    // One millisecond before the window expires.
    expect(attemptStaleBuildReload(now + CHUNK_RELOAD_GUARD_WINDOW_MS)).toBe(false)
    vi.runAllTimers()
    expect(reload).not.toHaveBeenCalled()
  })

  it('CONTRAST: reloads again once the window has genuinely passed', () => {
    // Without this arm the guard could be `return false` and the test above
    // would still pass — a recovery that never recovers.
    const now = 1_000_000
    attemptStaleBuildReload(now)
    vi.runAllTimers()
    reload.mockClear()

    expect(attemptStaleBuildReload(now + CHUNK_RELOAD_GUARD_WINDOW_MS + 1)).toBe(true)
    vi.runAllTimers()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('fails SAFE when sessionStorage is unreadable — no unguarded loop', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    try {
      expect(attemptStaleBuildReload(1_000_000)).toBe(false)
      vi.runAllTimers()
      expect(reload).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('pins a route hash so the reload lands back on the canvas, not the sign-in gate', () => {
    window.location.hash = ''
    ensureRouteHash()
    expect(window.location.hash).toBe('#/canvas')
  })

  it('CONTRAST: an existing route hash is left alone', () => {
    window.location.hash = '#/scenarios'
    ensureRouteHash()
    expect(window.location.hash).toBe('#/scenarios')
  })
})

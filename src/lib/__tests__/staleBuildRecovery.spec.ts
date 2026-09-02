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
  CHUNK_STALL_HEADING_COPY,
  CHUNK_STALL_NOTICE_COPY,
  createChunkStallError,
  ensureRouteHash,
  isChunkDeliveryFailure,
  isChunkLoadError,
  isChunkStallError,
  STALE_BUILD_ACTION_COPY,
  STALE_BUILD_NOTICE_COPY,
  CHUNK_LOAD_ERROR_SHAPES,
  CHUNK_LOAD_NEAR_MISSES,
} from '../staleBuildRecovery'

/**
 * ⭐ THE HAND-WRITTEN CORPUS, AND IT IS HAND-WRITTEN ON PURPOSE.
 *
 * `CHUNK_LOAD_ERROR_SHAPES` is exported from the product so consumers DERIVE
 * rather than copy — the boundary spec and the Core E2E guard both do now. But a
 * derived guard proves AGREEMENT and can never prove COMPLETENESS: delete a shape
 * from the export, narrow the predicate to match, and every derived consumer
 * agrees with the smaller truth while staying green.
 *
 * These lists are the other half, and they earned their place immediately — the
 * reconciliation at the bottom of this file caught the first draft of the export
 * being SHORT by two shapes (`ChunkLoadError` and a negative). Ship both guards;
 * drop either and a whole defect class goes unobserved.
 */
const HAND_WRITTEN_YES: readonly string[] = [
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

const HAND_WRITTEN_NO: readonly string[] = [
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

describe('staleBuildRecovery — detector', () => {
  it('recognises the real browser message shapes', () => {
    const yes = HAND_WRITTEN_YES
    for (const m of yes) expect(isChunkLoadError(new Error(m)), m).toBe(true)
  })

  it('CONTRAST: rejects ordinary application errors', () => {
    // Without this arm the detector could be `() => true` and every test above
    // would still pass, turning every crash into "Olumi was updated".
    const no = HAND_WRITTEN_NO
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

describe('the exported corpus is COMPLETE, not merely self-consistent', () => {
  // The lists above are hand-written and reviewed here; the export is what other
  // files derive from. These assertions are the join. Bidirectional on purpose: an
  // export that GROWS past this file is as much a finding as one that shrinks,
  // because it means a shape was added without its witness being reviewed here.
  it('every hand-written shape is in the exported corpus, and vice versa', () => {
    expect([...CHUNK_LOAD_ERROR_SHAPES].sort()).toEqual([...HAND_WRITTEN_YES].sort())
    expect([...CHUNK_LOAD_NEAR_MISSES].sort()).toEqual([...HAND_WRITTEN_NO].sort())
  })

  it('CONTROL: the corpora are non-empty and do not overlap', () => {
    // A reconciliation between two empty lists passes and proves nothing.
    expect(CHUNK_LOAD_ERROR_SHAPES.length).toBeGreaterThanOrEqual(7)
    expect(CHUNK_LOAD_NEAR_MISSES.length).toBeGreaterThanOrEqual(6)
    for (const m of CHUNK_LOAD_NEAR_MISSES) {
      expect(CHUNK_LOAD_ERROR_SHAPES, `${m} must not be in both`).not.toContain(m)
    }
  })

  it('the CSS shape is present BY NAME, not merely by count', () => {
    // Bound by identity, not by a count another entry could satisfy. This is the
    // shape this change exists for; a refactor that drops it must RED here.
    expect(CHUNK_LOAD_ERROR_SHAPES.some((m) => m.startsWith('Unable to preload CSS for'))).toBe(true)
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true)

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SECOND CAUSE: a chunk that STALLS rather than fails.
 *
 * The stale-build arms above are about an import that REJECTS. Everything below
 * is about one that never settles at all — measured on staging as a permanent
 * "Loading Canvas..." with zero console output. The two must stay NAMED APART:
 * they are two causes of one harm, and exactly one of them may say the build
 * moved (CLAUDE.md trap 21).
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('staleBuildRecovery — the stall detector', () => {
  it('recognises the error the bounded loader produces', () => {
    expect(isChunkStallError(createChunkStallError('The canvas', 45_000))).toBe(true)
  })

  it('binds to the error NAME, not to its prose', () => {
    // The message is user-visible copy and will be reworded. A detector that
    // parsed it would silently stop detecting on the first rewrite.
    const e = createChunkStallError('The canvas', 45_000)
    e.message = 'anything at all'
    expect(isChunkStallError(e)).toBe(true)
  })

  it('CONTRAST: rejects ordinary application errors', () => {
    // Without this the detector could be `() => true` and every arm above would
    // still pass, turning every crash into "Olumi could not finish loading".
    for (const m of ['Cannot read properties of undefined', 'Network request failed', 'boom']) {
      expect(isChunkStallError(new Error(m)), m).toBe(false)
    }
    expect(isChunkStallError(null)).toBe(false)
    expect(isChunkStallError(undefined)).toBe(false)
  })

  it('⭐ THE TWO CAUSES ARE DISJOINT — neither detector may claim the other', () => {
    // This is the arm that stops the two sentences collapsing into one. If a
    // stall satisfied isChunkLoadError, the product would tell a user on a dead
    // CDN that Olumi had been updated — a comfortable, false explanation.
    const stall = createChunkStallError('The canvas', 45_000)
    const staleBuild = new Error('Failed to fetch dynamically imported module: /assets/x.js')

    expect(isChunkLoadError(stall)).toBe(false)
    expect(isChunkStallError(staleBuild)).toBe(false)
    // ...and both are nonetheless a delivery failure, which is the question the
    // boundaries ask when choosing a NAMED notice over the generic crash panel.
    expect(isChunkDeliveryFailure(stall)).toBe(true)
    expect(isChunkDeliveryFailure(staleBuild)).toBe(true)
  })

  it('CONTRAST: an ordinary error is not a delivery failure either', () => {
    expect(isChunkDeliveryFailure(new Error('Maximum update depth exceeded'))).toBe(false)
  })

  it('the message names the surface and the wait, because it reaches the screen', () => {
    // CanvasErrorBoundary prints error.message verbatim in its detail box.
    expect(createChunkStallError('The canvas', 45_000).message).toBe(
      'The canvas did not finish loading within 45s',
    )
  })
})

describe('staleBuildRecovery — the stall sentence is true', () => {
  it('does not blame the server, the network, or the user', () => {
    // ⚠ The measurement CANNOT distinguish a stalled CDN response from a stalled
    // connection. Naming either would be a guess printed as a fact — and the
    // whole reason this copy lives in one module is that a false sentence here
    // is the harm, not the spinner.
    expect(CHUNK_STALL_NOTICE_COPY).not.toMatch(/server|network|offline|your connection|check your/i)
    expect(CHUNK_STALL_HEADING_COPY).not.toMatch(/server|network|offline|error|failed|crash/i)
  })

  it('says what happened and what to do', () => {
    expect(CHUNK_STALL_NOTICE_COPY).toMatch(/did not finish downloading/i)
    expect(CHUNK_STALL_NOTICE_COPY).toMatch(/reload/i)
  })

  it('⭐ never claims the build moved — that is the OTHER cause', () => {
    expect(CHUNK_STALL_NOTICE_COPY).not.toMatch(/updated|new version|current version/i)
    expect(CHUNK_STALL_HEADING_COPY).not.toMatch(/updated/i)
    // CONTRAST, so this pair cannot pass by both sentences being empty.
    expect(STALE_BUILD_NOTICE_COPY).toMatch(/updated/i)
  })

  it('the two sentences are actually different strings', () => {
    expect(CHUNK_STALL_NOTICE_COPY).not.toBe(STALE_BUILD_NOTICE_COPY)
  })
})

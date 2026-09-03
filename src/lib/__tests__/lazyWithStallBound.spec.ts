/**
 * The bounded loader, in BOTH directions.
 *
 * ⚠ THE TWO HARMS ARE OPPOSITE AND CANNOT SHARE A GUARD (CLAUDE.md trap 22b).
 * A bound that never fires leaves the defect in place — the silent, permanent
 * spinner. A bound that fires too eagerly tells a user on a poor connection that
 * the app is broken while their chunk was still arriving. Every arm here has its
 * opposite-direction twin, and the "slow but successful" arms are the ones that
 * matter, because they are the ones a plausible-looking tightening would break.
 *
 * The browser-level proof — a REAL stalled request against a REAL Suspense/error
 * boundary race — is `e2e/geometry/lazyChunkStall.measure.ts`. jsdom cannot host
 * that. This file pins the settle logic underneath it, cheaply and exactly.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadWithStallBound } from '../lazyWithStallBound'
import {
  CHUNK_STALL_BOUND_EVIDENCE,
  CHUNK_STALL_BOUND_MS,
  isChunkLoadError,
  isChunkStallError,
} from '../staleBuildRecovery'

/** A loader whose promise this test controls. `never` is the actual defect. */
function controllable<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { loader: () => promise, resolve, reject }
}

describe('loadWithStallBound — a stall becomes an error, at the bound', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a loader that NEVER settles rejects once the bound elapses', async () => {
    // THE DEFECT, reduced to its essence: before this wrapper existed, this
    // promise was simply pending forever and React held the fallback.
    const { loader } = controllable<{ default: unknown }>()
    const bounded = loadWithStallBound(loader, 'The canvas', 1_000)

    const settled = vi.fn()
    bounded.then(settled, settled)

    await vi.advanceTimersByTimeAsync(999)
    expect(settled, 'must not fire BEFORE the bound').not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(2)
    expect(settled).toHaveBeenCalledTimes(1)

    const error = settled.mock.calls[0][0] as Error
    expect(isChunkStallError(error)).toBe(true)
    // The message reaches the SCREEN (CanvasErrorBoundary prints it verbatim),
    // so it must name what the user was waiting for and how long it waited.
    expect(error.message).toContain('The canvas')
    expect(error.message).toContain('1s')
  })

  it('OPPOSITE DIRECTION: a SLOW but successful load still resolves', async () => {
    // ⭐ THE ARM THAT PROTECTS REAL USERS. Measured on staging, a Slow-3G first
    // visit takes over twenty seconds and SUCCEEDS; a bound that fired first
    // would convert every one of those sessions into "something went wrong".
    const { loader, resolve } = controllable<{ default: string }>()
    const bounded = loadWithStallBound(loader, 'The canvas', 1_000)

    await vi.advanceTimersByTimeAsync(998)
    resolve({ default: 'module' })

    await expect(bounded).resolves.toEqual({ default: 'module' })
  })

  it('a load that beats the bound comfortably is untouched', async () => {
    const { loader, resolve } = controllable<{ default: string }>()
    const bounded = loadWithStallBound(loader, 'The canvas', 1_000)
    resolve({ default: 'module' })
    await expect(bounded).resolves.toEqual({ default: 'module' })
  })

  it('CONTRAST: a loader REJECTION passes through UNCHANGED — the stale-build path keeps its own error', async () => {
    // Without this arm the wrapper could rewrite every failure into a stall and
    // the deploy-race notice ("Olumi was updated") would never be shown again.
    const { loader, reject } = controllable<{ default: unknown }>()
    const bounded = loadWithStallBound(loader, 'The canvas', 1_000)

    const chunkError = new Error('Failed to fetch dynamically imported module: /assets/x.js')
    reject(chunkError)

    await expect(bounded).rejects.toBe(chunkError)
    expect(isChunkLoadError(chunkError)).toBe(true)
    expect(isChunkStallError(chunkError)).toBe(false)
  })

  it('a late resolution after the bound has fired changes nothing, and raises no unhandled rejection', async () => {
    const { loader, resolve } = controllable<{ default: string }>()
    const outcome = vi.fn()
    loadWithStallBound(loader, 'The canvas', 1_000).then(outcome, outcome)

    await vi.advanceTimersByTimeAsync(1_001)
    expect(isChunkStallError(outcome.mock.calls[0][0] as Error)).toBe(true)

    resolve({ default: 'module' })
    await vi.advanceTimersByTimeAsync(10)
    expect(outcome, 'the settled promise must not settle twice').toHaveBeenCalledTimes(1)
  })

  it('a late REJECTION after the bound has fired is swallowed, not escalated', async () => {
    // A dropped rejection arm here becomes an unhandled promise rejection, which
    // some hosts escalate to a page-level error event — turning a handled stall
    // into a second, spurious crash.
    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      const { loader, reject } = controllable<{ default: unknown }>()
      const outcome = vi.fn()
      loadWithStallBound(loader, 'The canvas', 1_000).then(outcome, outcome)

      await vi.advanceTimersByTimeAsync(1_001)
      reject(new Error('late failure'))
      await vi.advanceTimersByTimeAsync(10)

      expect(outcome).toHaveBeenCalledTimes(1)
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
    }
  })

  it('the timer is cleared on a successful load — no stray timer keeps the process alive', async () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout')
    const { loader, resolve } = controllable<{ default: string }>()
    const bounded = loadWithStallBound(loader, 'The canvas', 1_000)
    resolve({ default: 'module' })
    await bounded
    expect(clear).toHaveBeenCalled()
    clear.mockRestore()
  })
})

describe('the bound itself — the constant and its evidence cannot drift apart', () => {
  /*
   * ⚠ A NUMBER WHOSE JUSTIFICATION LIVES ONLY IN A COMMENT IS A HAND-MAINTAINED
   * MIRROR (CLAUDE.md trap 12). These arms are what make a future tightening
   * argue with the measurement instead of quietly overruling it.
   */
  it('clears the slowest SUCCESSFUL load measured on the slowest supported connection', () => {
    expect(CHUNK_STALL_BOUND_MS).toBeGreaterThan(CHUNK_STALL_BOUND_EVIDENCE.slowestSupportedMaxMs)
  })

  it('keeps real headroom over it, not a rounding error', () => {
    // 2x is the claim the module header makes for Slow 3G. If a later edit
    // tightens the bound towards the measurement, this fails and says so.
    expect(CHUNK_STALL_BOUND_MS / CHUNK_STALL_BOUND_EVIDENCE.slowestSupportedMaxMs).toBeGreaterThan(2)
  })

  it('still fires well inside the silent-spinner window it exists to end', () => {
    expect(CHUNK_STALL_BOUND_MS).toBeLessThan(CHUNK_STALL_BOUND_EVIDENCE.observedSilentSpinnerMs)
  })

  it('the claim type is stated as CHOSEN, not overclaimed as derived', () => {
    // A sibling lane called a threshold "derived" when it had been picked inside
    // a measured window, and had to correct it. The word is part of the evidence.
    expect(CHUNK_STALL_BOUND_EVIDENCE.claimType).toContain('chosen')
    expect(CHUNK_STALL_BOUND_EVIDENCE.claimType).not.toMatch(/^derived/)
  })

  it('CONTRAST: the evidence records a real interval, not a single point', () => {
    // Two edges from two different measurements — without this the arms above
    // could all be satisfied by one number copied into three fields.
    expect(CHUNK_STALL_BOUND_EVIDENCE.fastestHealthyMs).toBeLessThan(
      CHUNK_STALL_BOUND_EVIDENCE.slowestSupportedMaxMs,
    )
    expect(CHUNK_STALL_BOUND_EVIDENCE.slowestSupportedMaxMs).toBeLessThan(
      CHUNK_STALL_BOUND_EVIDENCE.worstMeasuredMaxMs,
    )
    expect(CHUNK_STALL_BOUND_EVIDENCE.slowestSupportedN).toBeGreaterThan(1)
  })
})

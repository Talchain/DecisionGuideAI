/**
 * useServerGraphHydration — THE RETURNING-GUEST WRITE-BACK WINDOW.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS PINS (journey-witnessed 2026-08-25, build `55807813`)
 * ═══════════════════════════════════════════════════════════════════════════
 * The server write-back completes 30–90s AFTER the model first appears on
 * screen. A guest who closes the tab and returns inside that window gets
 * `graph_present:false`, and because the boot read fires EXACTLY ONCE per
 * scenario id, the canvas stays empty for the life of the page. Nothing is
 * lost — the client stops looking. A plain reload recovers it every time.
 *
 * Measured, 5 trials: restart at +15s → 0 nodes, `graph_present:false`, no
 * re-ask; restart at +180s → 14 and 11 nodes immediately. In one trial the
 * server held the graph by +47s while the canvas sat at 0 and never re-asked.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BOTH DIRECTIONS — the trap here is obvious and it is the one to guard
 * ═══════════════════════════════════════════════════════════════════════════
 * A scenario that WILL populate must render without a manual reload; a
 * scenario that NEVER populates must TERMINATE rather than spin. An unbounded
 * poll against a scenario that will never populate is a worse defect than the
 * one being fixed, so the CALL COUNT is asserted, not just the eventual
 * render — a test that only proves it eventually renders cannot see a runaway.
 *
 * And a 404 must behave EXACTLY as today: no retry, no notice, no change.
 *
 * ⚠ ASSERTIONS BIND BY IDENTITY. Every count check is paired with the
 * scenario id the call was made for, so a retry aimed at a DIFFERENT scenario
 * cannot satisfy a bare `toHaveBeenCalledTimes`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useServerGraphHydration } from '../useServerGraphHydration'
import * as hydration from '../../hydrate/serverGraphHydration'
import type { HydrationOutcome } from '../../hydrate/serverGraphHydration'

const A = '11111111-2222-4333-8444-555555555555'
const B = '22222222-3333-4444-8555-666666666666'

let user: { id: string } | null = { id: 'guest' }
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user }),
}))

/** Calls made FOR a given scenario id — identity binding, never a bare count. */
function callsFor(
  spy: { mock: { calls: unknown[][] } },
  scenarioId: string,
): unknown[][] {
  return spy.mock.calls.filter((c) => c[0] === scenarioId)
}

function spyHydrate() {
  return vi.spyOn(hydration, 'hydrateCanvasFromServer')
}

let spy: ReturnType<typeof spyHydrate>

beforeEach(() => {
  user = { id: 'guest' }
  vi.useFakeTimers()
  spy = spyHydrate()
})

/**
 * ⚠ NO `vi.runOnlyPendingTimers()` HERE, AND THE REASON IS AN INSTRUMENT DEFECT
 * THIS SPEC ALREADY HIT ONCE.
 *
 * `tests/setup/rtl.ts:48` calls `vi.useRealTimers()` in a global `afterEach`
 * that runs BEFORE this file's. A teardown that assumes the fake clock is still
 * installed therefore THROWS — and vitest attributes that throw to the test that
 * just finished, so every case in the file reds regardless of its body.
 *
 * That is exactly how it presented: 10/10 red on the first run, INCLUDING the
 * 404 control whose body had in fact passed (its debug log showed the single
 * call). A RED-first run where the control also reds is reporting on the
 * harness, not on the code — CLAUDE.md trap 20's uniformity heuristic.
 * `useRealTimers` is idempotent and safe from either state.
 */
afterEach(() => {
  vi.useRealTimers()
})

/** Let the effect's promise chain settle without advancing the clock. */
async function flush(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0)
  })
}

/** Advance the fake clock inside `act` so React state writes are captured. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('useServerGraphHydration — the write-back window (populates late)', () => {
  /**
   * THE RED. At pristine this asserts 1 > 1 and fails: the hook fires once,
   * records the scenario id in `attemptedRef`, and never re-asks.
   */
  it('RE-ASKS for THIS scenario after graph_present:false and hydrates the graph that lands late', async () => {
    spy.mockResolvedValueOnce('absent').mockResolvedValue('merged')

    renderHook(() => useServerGraphHydration(A))
    await flush()
    expect(callsFor(spy, A)).toHaveLength(1)

    // The measured window is 30–90s. Cover it with margin.
    await advance(120_000)

    const forA = callsFor(spy, A)
    expect(forA.length).toBeGreaterThan(1)
    // IDENTITY: the second ask was for A, not for some other scenario.
    expect(forA[1][0]).toBe(A)
  })

  it('STOPS re-asking once a graph arrives — a success is terminal', async () => {
    spy.mockResolvedValueOnce('absent').mockResolvedValue('merged')

    renderHook(() => useServerGraphHydration(A))
    await flush()
    await advance(120_000)

    const afterSuccess = callsFor(spy, A).length
    await advance(600_000)
    expect(callsFor(spy, A)).toHaveLength(afterSuccess)
  })
})

describe('useServerGraphHydration — the never-populates case (must TERMINATE)', () => {
  /**
   * The both-directions twin. A scenario whose graph never lands must stop.
   * The count is asserted at a bound, and then asserted AGAIN after ten more
   * minutes of clock — a schedule that merely backs off would pass the first
   * assertion and fail the second.
   */
  it('TERMINATES on a scenario that never populates, and the call count is BOUNDED', async () => {
    spy.mockResolvedValue('absent')

    renderHook(() => useServerGraphHydration(A))
    await flush()
    await advance(300_000)

    const settled = callsFor(spy, A).length
    expect(settled).toBeGreaterThan(1)
    expect(settled).toBeLessThanOrEqual(12)

    // TEN MORE MINUTES. A bounded schedule has stopped; a backoff has not.
    await advance(600_000)
    expect(callsFor(spy, A)).toHaveLength(settled)
  })
})

describe('useServerGraphHydration — 404 is UNCHANGED (byte-identical to today)', () => {
  /**
   * `notReadable` is the 404 union: absent ∪ not-yours ∪ oracle-unresolvable.
   * It is a stable answer, not a window. Retrying it would spend the shared
   * per-IP read budget to earn the same refusal three more times.
   */
  it('makes EXACTLY ONE call for a 404 and never re-asks', async () => {
    spy.mockResolvedValue('notReadable')

    renderHook(() => useServerGraphHydration(A))
    await flush()
    expect(callsFor(spy, A)).toHaveLength(1)

    await advance(600_000)
    expect(callsFor(spy, A)).toHaveLength(1)
  })

  /**
   * The DISCRIMINATING half. If the guard were "retry on anything that is not
   * a graph", this test and the 404 test would both pass while the product
   * hammered a dead server. Each stable non-absent answer is pinned by NAME.
   */
  it.each<HydrationOutcome>(['refused', 'unusable', 'unavailable', 'mergeRefused'])(
    'makes EXACTLY ONE call for %s and never re-asks',
    async (outcome) => {
      spy.mockResolvedValue(outcome)

      renderHook(() => useServerGraphHydration(A))
      await flush()
      expect(callsFor(spy, A)).toHaveLength(1)

      await advance(600_000)
      expect(callsFor(spy, A)).toHaveLength(1)
    },
  )
})

describe('useServerGraphHydration — the retry follows the live scenario', () => {
  it('ABANDONS the retry when the scenario changes, and never asks for the old id again', async () => {
    spy.mockResolvedValue('absent')

    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), {
      initialProps: { id: A },
    })
    await flush()
    expect(callsFor(spy, A)).toHaveLength(1)

    rerender({ id: B })
    await flush()
    const aAtSwitch = callsFor(spy, A).length

    await advance(600_000)
    // A's schedule is aborted; B gets its own.
    expect(callsFor(spy, A)).toHaveLength(aAtSwitch)
    expect(callsFor(spy, B).length).toBeGreaterThan(0)
  })

  it('ABANDONS the retry on unmount', async () => {
    spy.mockResolvedValue('absent')

    const { unmount } = renderHook(() => useServerGraphHydration(A))
    await flush()
    const atUnmount = callsFor(spy, A).length
    unmount()

    await advance(600_000)
    expect(callsFor(spy, A)).toHaveLength(atUnmount)
  })
})

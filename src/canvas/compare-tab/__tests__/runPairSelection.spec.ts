/**
 * ROADMAP 2.113a slice 2 — the A/B pick's two invariants.
 *
 * Both exist to stop the side-by-side view rendering a comparison that says
 * nothing: a run against ITSELF (a column of `+0pp` deltas and "Leader
 * unchanged", which reads exactly like a measured finding), or a pair whose
 * delta sign convention is inverted relative to every other number in the tab.
 */
import { describe, it, expect } from 'vitest'
import { applyRunPairChange, normaliseRunPair } from '../runPairSelection'

describe('normaliseRunPair', () => {
  it('defaults to first-vs-latest when nothing has been picked', () => {
    expect(normaliseRunPair([1, 2, 3, 4], null)).toEqual({ from: 1, to: 4 })
  })

  it('returns null below two runs — there is nothing to pick between', () => {
    expect(normaliseRunPair([], null)).toBeNull()
    expect(normaliseRunPair([1], null)).toBeNull()
    expect(normaliseRunPair([1], { from: 1, to: 1 })).toBeNull()
  })

  it('keeps a valid pick', () => {
    expect(normaliseRunPair([1, 2, 3, 4], { from: 2, to: 3 })).toEqual({ from: 2, to: 3 })
  })

  it('orders the pair chronologically so every delta is later-minus-earlier', () => {
    expect(normaliseRunPair([1, 2, 3, 4], { from: 4, to: 2 })).toEqual({ from: 2, to: 4 })
  })

  it('clamps an end that no longer exists — re-hydration renumbers the journey', () => {
    // The user picked run 7; a scenario switch left only three runs.
    expect(normaliseRunPair([1, 2, 3], { from: 2, to: 7 })).toEqual({ from: 2, to: 3 })
    expect(normaliseRunPair([1, 2, 3], { from: 9, to: 2 })).toEqual({ from: 1, to: 2 })
  })

  it('NEVER returns a run compared with itself — it falls back to the extremes', () => {
    expect(normaliseRunPair([1, 2, 3], { from: 2, to: 2 })).toEqual({ from: 1, to: 3 })
    // Both ends stale and clamping would collapse them onto the same run.
    expect(normaliseRunPair([1, 2, 3], { from: 8, to: 9 })).toEqual({ from: 1, to: 3 })
  })
})

describe('applyRunPairChange', () => {
  it('moves the picked end', () => {
    expect(applyRunPairChange({ from: 1, to: 4 }, 'from', 2)).toEqual({ from: 2, to: 4 })
    expect(applyRunPairChange({ from: 1, to: 4 }, 'to', 3)).toEqual({ from: 1, to: 3 })
  })

  it('SWAPS rather than collapsing when the picked run is already at the other end', () => {
    expect(applyRunPairChange({ from: 1, to: 4 }, 'from', 4)).toEqual({ from: 1, to: 4 })
    expect(applyRunPairChange({ from: 2, to: 5 }, 'to', 2)).toEqual({ from: 2, to: 5 })
  })

  it('re-orders when a pick crosses the other end', () => {
    // "Compare run 6 with run 3" is the same pair as 3→6, and only one of
    // those two readings keeps the delta sign consistent with the rest of the tab.
    expect(applyRunPairChange({ from: 1, to: 3 }, 'from', 6)).toEqual({ from: 3, to: 6 })
    expect(applyRunPairChange({ from: 4, to: 6 }, 'to', 1)).toEqual({ from: 1, to: 4 })
  })

  it('is total: no sequence of picks produces from === to', () => {
    const runs = [1, 2, 3, 4, 5]
    let pair = { from: 1, to: 5 }
    for (const endpoint of ['from', 'to'] as const) {
      for (const n of runs) {
        pair = applyRunPairChange(pair, endpoint, n)
        expect(pair.from).not.toBe(pair.to)
        expect(pair.from).toBeLessThan(pair.to)
      }
    }
  })
})

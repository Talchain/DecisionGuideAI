/**
 * A rank from a stale run does not age — it names the wrong factor.
 *
 * ⚠⚠ THIS FILE EXISTS BECAUSE A MUTANT SURVIVED. Deleting the freshness gate
 * from `useInfluenceRank` left **106 tests green**, including `FactorNode`'s
 * own 101 — so the gate the card has carried since the ranked readout shipped
 * was unpinned at rest, and the reduced-line change was about to move it into
 * a new module with nothing watching it. A guard nobody tests is one tidy-up
 * from deletion, and its deletion is silent (CLAUDE.md trap 13b).
 *
 * ⭐ WHY THE GATE MATTERS MORE THAN AGEING. `influence` is a magnitude: stale,
 * it is merely out of date. A RANK is a comparison ACROSS factors, so a rank
 * computed on a graph the reader has since changed can point at a factor that
 * is no longer the leader — a false statement, not an old one.
 *
 * ⭐⭐ AND THE PIN WAS THEN PUT THROUGH A DISCRIMINATING MUTANT PAIR, BECAUSE
 * "I wrote a pin and the mutant now bites" is exactly the claim a guard
 * agreeing with itself would also make. A single biting mutant proves
 * sensitivity to SOMETHING; only the pair proves sensitivity to the NAMED
 * object (trap 19's proof obligation). Measured:
 *
 *   · break the FRESHNESS conjunct  → REDs *"withholds it entirely once the
 *     run is stale"* and NOTHING ELSE.
 *   · break the LICENSING conjunct  → REDs *"a current run still withholds an
 *     UNLICENSED rank"* and NOTHING ELSE — the freshness test stays GREEN.
 *   · rot the fixture so it licenses nothing (`(1, 1)`) → REDs the
 *     precondition assertion in the first test, so this file's discriminating
 *     power is guarded at rest rather than true only on the day it was written
 *     (trap 12b: a control pinned to something that moves has an expiry date
 *     nobody wrote down).
 *
 * Neither arm crosses over, so the two tests are bound to two different
 * properties rather than both coasting on one.
 *
 * ⛔ THE FRESHNESS CLASSIFIER IS NOT RE-TESTED HERE. It has its own suite, and
 * a second corpus over it would be two answers to one settled question. What
 * is pinned is this hook's CONJUNCTION: the licensing guard AND the freshness
 * gate, so removing either one REDs.
 *
 * ⭐⭐ 23 SEP 2026 — THE STALE ARM NOW LABELS ON 'changed' INSTEAD OF WITHHOLDING.
 *
 * Paul accepted Q2, 22 Sep: keep the figure and the rank, labelled 'Last run ·'
 * when the model has changed. So the "withholds it entirely once the run is
 * stale" pin above is SPLIT by the question the composed verdict answers, not
 * deleted:
 *
 *   · 'changed' (`useModelChangedSinceRun()`) → the SAME owner's readout,
 *     marked `fromLastRun: true`. Every consumer prefixes `LAST_RUN_PREFIX` off
 *     that same predicate, so a stale rank is never shown unlabelled.
 *   · 'cannot_confirm' / never-run (neither current nor changed) → still
 *     `null`. "Last run" there would be a claim the state does not support.
 *
 * The comparison-across-factors argument above is why the label is mandatory:
 * a rank from a run over a different graph can name the wrong factor, so it
 * may only be spoken as a statement ABOUT THAT RUN.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

let resultsAreCurrent = true
let modelChangedSinceRun = false

vi.mock('../useAnalysisResultsAreCurrent', () => ({
  useAnalysisResultsAreCurrent: () => resultsAreCurrent,
}))
vi.mock('../useModelChangedSinceRun', () => ({
  useModelChangedSinceRun: () => modelChangedSinceRun,
}))

import { useInfluenceRank } from '../useInfluenceRank'
import { influenceRankReadout } from '../../../components/results/influenceScaleCopy'

describe('useInfluenceRank withholds a rank the run no longer licenses', () => {
  beforeEach(() => {
    resultsAreCurrent = true
    modelChangedSinceRun = false
  })

  it('names the rank while the run is about the graph in front of the reader', () => {
    const { result } = renderHook(() => useInfluenceRank(1, 5))
    // Compared against the OWNER's output, never a re-typed string.
    expect(result.current).toMatchObject(influenceRankReadout(1, 5) as object)
    expect(result.current, 'the fixture licenses nothing — this test is vacuous').not.toBeNull()
    // A current result is never marked as coming from an earlier run.
    expect(result.current?.fromLastRun ?? false).toBe(false)
  })

  it('⭐ "changed" — the rank is KEPT and marked as the last run\'s (Paul accepted Q2, 22 Sep: keep the figure and the rank, labelled \'Last run ·\' when the model has changed)', () => {
    resultsAreCurrent = false
    modelChangedSinceRun = true
    const { result } = renderHook(() => useInfluenceRank(1, 5))
    expect(result.current).toMatchObject(influenceRankReadout(1, 5) as object)
    expect(result.current?.fromLastRun).toBe(true)
  })

  it('⛔ "cannot_confirm" / never-run — neither current nor changed — still withholds it entirely', () => {
    resultsAreCurrent = false
    modelChangedSinceRun = false
    const { result } = renderHook(() => useInfluenceRank(1, 5))
    expect(result.current).toBeNull()
  })

  it('CONTRAST — "changed" still withholds an UNLICENSED rank, so the label never licenses by itself', () => {
    resultsAreCurrent = false
    modelChangedSinceRun = true
    const { result } = renderHook(() => useInfluenceRank(1, 1))
    expect(result.current).toBeNull()
  })

  it('CONTRAST — a current run still withholds an UNLICENSED rank, so the two guards are both live', () => {
    // A set of one: the owner refuses it. If this passed only because of the
    // freshness gate, the gate would be doing the licensing guard's job and
    // removing either one would be invisible.
    const { result } = renderHook(() => useInfluenceRank(1, 1))
    expect(result.current).toBeNull()
  })
})

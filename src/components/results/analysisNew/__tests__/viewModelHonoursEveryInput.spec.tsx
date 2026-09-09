/**
 * Analysis (New) — THE VIEW MODEL RECOMPUTES FOR EVERY INPUT IT DECLARES.
 *
 * ⚠⚠ THE DEFECT THIS PINS, MEASURED AT THE HOOK. `useAnalysisNewViewModel`
 * accepts `staleReason` ('changed' | 'unconfirmed'), hands it to
 * `buildAnalysisNewViewModel`, which derives `status.staleKind` from it — and
 * the `useMemo` that wraps that call did NOT list it as a dependency. Measured
 * before the fix: rerendering with `staleReason` flipped 'unconfirmed' →
 * 'changed' and every other input identical returned `staleKind: 'unconfirmed'`
 * — the memo never re-ran.
 *
 * ⭐ WHY THAT SENTENCE MATTERS AND IS NOT COSMETIC. `staleReason.ts` exists
 * because ONE boolean was answering TWO questions: 'changed' is a claim about
 * the WORLD, 'unconfirmed' a claim about our EVIDENCE, and the panel was
 * asserting the first from the second. The dock now computes them from two
 * genuinely different authorities — `isStale` from `displayedFreshness`,
 * `staleReason` from `composedAnalysisState.trust.semantic` — so they move
 * independently by construction. A missing dependency makes the correction
 * conditional on some OTHER input happening to change in the same render.
 *
 * ⚠ THE CLAIM IS SCOPED, DELIBERATELY. This is a property of the CODE, not a
 * witnessed production capture: the surrounding inputs (`nodes` →
 * `nodeValueSources`, `data`) often do move on the same turn, so the stale
 * sentence may well be correct much of the time. That is the point — it was
 * correct by accident, and the view model builder's own header names exactly
 * this failure mode ("a property of the DATA rather than of this adapter …
 * true on the runs that happened to be driven, and unguaranteed").
 *
 * ⭐⭐ SO THE GUARD IS A SWEEP, NOT A SINGLE CASE. A test for `staleReason`
 * alone would close this one omission and see nothing when the next input is
 * dropped (CLAUDE.md trap 12 — the hand-maintained mirror). Every scalar input
 * the hook declares is exercised: change it alone, and the hook MUST hand back
 * a different object.
 *
 * ⚠ AND IT CARRIES ITS OWN DISCRIMINATION PROOF. "A new object appeared" is
 * worthless unless a rerender that changes NOTHING hands back the SAME object
 * — otherwise the memo could be broken open entirely and every row would pass
 * (CLAUDE.md trap 13b: a guard agreeing with itself). Both directions are here.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { useAnalysisNewViewModel, type UseAnalysisNewViewModelArgs } from '../useAnalysisNewViewModel'
import { openStrategicChallenge } from './analysisNewFixtures'

afterEach(cleanup)

/**
 * ⚠ ONE `data` INSTANCE FOR THE WHOLE FILE. `useResultsSectionData` hands back
 * a fresh object on some renders and a stable one on others; building a new
 * fixture per rerender would change a dependency that IS declared and make
 * every row below pass without touching the input under test.
 */
const DATA = openStrategicChallenge()

const BASE: UseAnalysisNewViewModelArgs = {
  data: DATA,
  isPreRun: false,
  isRunning: false,
  isStale: true,
  staleReason: 'unconfirmed',
  nSamples: 500,
  seedUsed: 42,
  responseHash: 'run_abc123',
}

const mount = (initial: UseAnalysisNewViewModelArgs = BASE) =>
  renderHook((props: UseAnalysisNewViewModelArgs) => useAnalysisNewViewModel(props), {
    initialProps: initial,
  })

describe('THE INSTRUMENT — an unchanged rerender must NOT recompute', () => {
  /**
   * ⭐⭐ THE DISCRIMINATION PROOF, FIRST. Without it every assertion below
   * passes on a hook with no memo at all, which is the opposite defect and
   * would make this file a guard that agrees with itself.
   */
  it('returns the SAME object when nothing changed', () => {
    const { result, rerender } = mount()
    const before = result.current
    rerender({ ...BASE })
    expect(result.current).toBe(before)
  })
})

/**
 * Each row changes exactly ONE declared input. `data`, `nodes` and the store
 * slices are held still by construction (the fixture is a module constant and
 * no store is touched), so a row that fails names the input the memo forgot.
 */
const SCALAR_INPUTS: ReadonlyArray<[string, Partial<UseAnalysisNewViewModelArgs>]> = [
  ['isPreRun', { isPreRun: true }],
  ['isRunning', { isRunning: true }],
  ['isStale', { isStale: false }],
  ['staleReason', { staleReason: 'changed' }],
  ['nSamples', { nSamples: 5000 }],
  ['seedUsed', { seedUsed: 99 }],
  ['responseHash', { responseHash: 'run_zzz999' }],
]

describe('every declared input is a dependency', () => {
  it.each(SCALAR_INPUTS)('recomputes when %s changes alone', (_name, patch) => {
    const { result, rerender } = mount()
    const before = result.current
    rerender({ ...BASE, ...patch })
    expect(result.current).not.toBe(before)
  })
})

/**
 * ⭐ AND THE USER-VISIBLE CONSEQUENCE, BOUND BY IDENTITY TO THE FIELD THAT
 * CARRIES THE SENTENCE. The reference check above proves the memo re-ran; this
 * proves the re-run produces the RIGHT answer, so a future change that keeps
 * the dependency and breaks the derivation still REDs.
 *
 * ⚠ BOTH DIRECTIONS. 'changed' is the stronger claim and 'unconfirmed' the
 * fail-closed one; a mapping stuck on either would satisfy a one-way test.
 */
describe('the staleness sentence follows the reason it was given', () => {
  it('unconfirmed → changed', () => {
    const { result, rerender } = mount()
    expect(result.current.status.staleKind).toBe('unconfirmed')
    rerender({ ...BASE, staleReason: 'changed' })
    expect(result.current.status.staleKind).toBe('changed')
  })

  it('changed → unconfirmed', () => {
    const { result, rerender } = mount({ ...BASE, staleReason: 'changed' })
    expect(result.current.status.staleKind).toBe('changed')
    rerender({ ...BASE, staleReason: 'unconfirmed' })
    expect(result.current.status.staleKind).toBe('unconfirmed')
  })
})

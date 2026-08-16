/**
 * `mapToAnalysisRunState` — the slice → run-state hop, pinned arm by arm.
 *
 * ⚠⚠ WHY THIS FILE EXISTS: AN ADVERSARIAL REVIEW PROVED THE `refused` ARM WAS
 * UNPINNED, BY EXECUTION. Deleting `if (input.refusalPresent) return 'refused'`
 * left **53/53 tests GREEN across all four refusal-touching specs**. Not one of
 * them exercised this hop:
 *
 *   · `AnalysisStateRegion.singleTruthBanner.spec.tsx` passes `runState` in
 *     DIRECTLY, so it tests the composition table and is silent about how a
 *     state is reached — by design, and that is exactly the blind spot;
 *   · `AnalysisRefusalNotice.spec.tsx` renders the component from its own prop;
 *   · `applyV5State.analysisRefusalNotice.spec.tsx` is STORE-level — it proves
 *     the wire populates the slice and stops there;
 *   · `analysisStateRegion.mountSites.spec.ts` reads source text.
 *
 * Every one of them is correct about what it covers. Together they cover the
 * wire→slice hop and the state→banner hop and leave the slice→STATE hop between
 * them untested — the classic seam defect, where each neighbour assumes the
 * other owns the join. A refusal could have stopped reaching the user with the
 * whole suite green.
 *
 * ⚠ AND THE COMPOUNDING ERROR, WHICH IS THE WORSE HALF: the mount-site comment
 * in `OutputsDock.tsx` asserted that unifying the gates "would re-dark it and
 * RED `applyV5State.analysisRefusalNotice.spec.tsx`". Measured: FALSE. That
 * spec stayed green under the deletion. A comment naming a guard that does not
 * guard is worse than no comment — it tells the next reader the seam is
 * covered, so they stop looking. The comment now names this file, and this file
 * is the thing that actually bites.
 *
 * ⭐ IT ALSO MATTERS BEYOND THIS PR. #737's selector never mints `refused` on
 * legacy turns, so the post-merge one-line swap to
 * `useAnalysisState().run_state` would silently re-dark the refusal notice.
 * These assertions are what make that regression visible AT SWAP TIME rather
 * than in a screenshot weeks later.
 *
 * HOW THE ASSERTIONS ARE BUILT
 * ----------------------------
 * Every claim about `refusalPresent` is a DISCRIMINATING PAIR: the same inputs
 * with the flag true and false, asserted to differ. A single-sided assertion
 * ("refusal → refused") is satisfiable by a function that returns `'refused'`
 * more often than it should; the pair is not. And each pair is placed at a cell
 * where the OTHER arms would return something else, so it is the flag being
 * measured and not the row.
 */
import { describe, it, expect } from 'vitest'

import { mapToAnalysisRunState } from '../useAnalysisRunState'
import { TRUTH_BANNER_BY_RUN_STATE, type AnalysisRunStateKind } from '../analysisStateContract'

type Input = Parameters<typeof mapToAnalysisRunState>[0]

/** A settled, never-run, no-verdict surface: every arm below is off. */
const BASE: Input = {
  refusalPresent: false,
  resultsStatus: 'idle',
  hasCompletedFirstRun: false,
  displayedFreshness: null,
}

const map = (over: Partial<Input>): AnalysisRunStateKind =>
  mapToAnalysisRunState({ ...BASE, ...over })

describe('mapToAnalysisRunState — the refusal arm (the unpinned seam)', () => {
  it('a refused FIRST analysis is `refused`, not `never_run`', () => {
    // ROADMAP 2.1163's harm. `hasCompletedFirstRun` is false here — the cell
    // the `never_run` arm would claim — so this asserts the ORDERING, which is
    // the whole reason the refusal notice can be ungated. Deleting the refusal
    // arm returns 'never_run' and REDs this line.
    expect(map({ refusalPresent: true, hasCompletedFirstRun: false })).toBe('refused')
    // The pair. Same cell, flag off: the state must DIFFER.
    expect(map({ refusalPresent: false, hasCompletedFirstRun: false })).toBe('never_run')
  })

  it('a refusal after a successful run outranks a retained FRESH verdict', () => {
    // The nastiest cell: CEE has previously vouched for a result, so the
    // freshness arm would return `complete_current` — a surface presenting old
    // numbers as current while the engine has just declined to run.
    const withRefusal: Partial<Input> = {
      refusalPresent: true,
      hasCompletedFirstRun: true,
      displayedFreshness: 'fresh',
    }
    expect(map(withRefusal)).toBe('refused')
    expect(map({ ...withRefusal, refusalPresent: false })).toBe('complete_current')
  })

  it('a refusal outranks a retained STALE verdict', () => {
    const withRefusal: Partial<Input> = {
      refusalPresent: true,
      hasCompletedFirstRun: true,
      displayedFreshness: 'stale',
    }
    expect(map(withRefusal)).toBe('refused')
    expect(map({ ...withRefusal, refusalPresent: false })).toBe('complete_stale')
  })

  it('a refusal outranks an errored rerun', () => {
    const withRefusal: Partial<Input> = {
      refusalPresent: true,
      resultsStatus: 'error',
      hasCompletedFirstRun: true,
      displayedFreshness: 'fresh',
    }
    expect(map(withRefusal)).toBe('refused')
    expect(map({ ...withRefusal, refusalPresent: false })).toBe('unknown_degraded')
  })

  it('a run IN FLIGHT outranks the refusal — the one deliberate exception', () => {
    // Asserted rather than left implicit, because it is the single case where
    // the refusal arm does NOT win, and a reader who only saw the tests above
    // would reasonably assume refusal is absolute. A live run's own narration
    // is the honest thing to show while it is happening; the refusal, if it
    // still holds, is whatever the run settles to.
    for (const resultsStatus of ['preparing', 'connecting', 'streaming']) {
      expect(map({ refusalPresent: true, resultsStatus }), resultsStatus).toBe('running')
    }
  })

  it('the refusal state resolves to the REFUSAL banner, end to end', () => {
    // Closes the loop this file exists to close: the mapping produces
    // `refused`, and `refused` entitles the refusal banner and nothing else.
    // Without this, the two halves could both be individually correct while
    // disagreeing about the enum member that joins them.
    expect(TRUTH_BANNER_BY_RUN_STATE[map({ refusalPresent: true })]).toBe('refusal')
  })
})

describe('mapToAnalysisRunState — the remaining arms', () => {
  it('an in-flight run is `running` at every in-flight status', () => {
    for (const resultsStatus of ['preparing', 'connecting', 'streaming']) {
      expect(map({ resultsStatus, hasCompletedFirstRun: true }), resultsStatus).toBe('running')
    }
    // Discriminating: a settled status at the same cell is NOT running.
    expect(map({ resultsStatus: 'complete', hasCompletedFirstRun: true })).not.toBe('running')
  })

  it('a FIRST run that fails stays `never_run`, and a failed RERUN does not', () => {
    // The ordering between the never_run arm and the error arm, asserted as a
    // pair because it is the only thing that distinguishes them.
    expect(map({ resultsStatus: 'error', hasCompletedFirstRun: false })).toBe('never_run')
    expect(map({ resultsStatus: 'error', hasCompletedFirstRun: true })).toBe('unknown_degraded')
  })

  it('an errored rerun never inherits the previous run\'s verdict', () => {
    // The defect an existing spec caught during the build. Swept over every
    // verdict, because inheriting ANY of them is the same failure.
    for (const displayedFreshness of ['fresh', 'stale', 'unknown', 'none', null] as const) {
      expect(
        map({ resultsStatus: 'error', hasCompletedFirstRun: true, displayedFreshness }),
        String(displayedFreshness),
      ).toBe('unknown_degraded')
    }
  })

  it('an ABSENT verdict after a completed run is cannot-confirm, never current', () => {
    // Fabricating currency from silence is the failure this arm exists to
    // prevent, so both spellings of "no verdict" are pinned.
    expect(map({ hasCompletedFirstRun: true, displayedFreshness: null })).toBe('unknown_degraded')
    expect(map({ hasCompletedFirstRun: true, displayedFreshness: 'none' })).toBe('unknown_degraded')
    expect(map({ hasCompletedFirstRun: true, displayedFreshness: 'unknown' })).toBe('unknown_degraded')
    // Discriminating: a real verdict at the same cell does NOT collapse here.
    expect(map({ hasCompletedFirstRun: true, displayedFreshness: 'fresh' })).toBe('complete_current')
  })

  it('every state the mapping can return is a member of the composition table', () => {
    // Cheap totality check across a swept input space: a state the mapping can
    // mint but the table has no row for would throw at the banner selector,
    // and it would do so only in the cell that produces it.
    for (const refusalPresent of [true, false]) {
      for (const resultsStatus of ['idle', 'preparing', 'streaming', 'error', 'complete']) {
        for (const hasCompletedFirstRun of [true, false]) {
          for (const displayedFreshness of ['fresh', 'stale', 'unknown', 'none', null] as const) {
            const kind = mapToAnalysisRunState({
              refusalPresent,
              resultsStatus,
              hasCompletedFirstRun,
              displayedFreshness,
            })
            expect(TRUTH_BANNER_BY_RUN_STATE, JSON.stringify({ refusalPresent, resultsStatus })).toHaveProperty(kind)
          }
        }
      }
    }
  })
})

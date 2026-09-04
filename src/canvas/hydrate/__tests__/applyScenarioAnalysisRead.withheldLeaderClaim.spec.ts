/**
 * THE LIVE LEG — A WITHHELD PAYLOAD MARKS THE REPORT IT DID NOT REPLACE.
 * W1-e (b).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARM, WITNESSED ON DEPLOYED STAGING `113375a1` (drive 3, 4 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * A user corrects a value. CEE answers `leader_claim { permitted: false,
 * withheld_reason: 'separation_unavailable' }`, `requires_rerun: true`, and on
 * the refusal `blocked_unusable: true` — and ships NO analysis block, because
 * the numbers it holds no longer describe the model. `applyScenarioAnalysisRead`
 * calls `resultsComplete` ONLY when the block is present and has NO
 * else-branch, so the previously-held report goes on presenting itself as
 * current and the canvas goes on naming a leader from it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THREE QUESTIONS, NAMED APART — AND ONLY TWO OF THEM WITHHOLD
 * ═══════════════════════════════════════════════════════════════════════════
 *   Q1  `leader_claim.permitted === false`
 *       "the producer REFUSES PERMISSION to name a leading option."
 *   Q3  `blocked_unusable === true`
 *       "the producer says the analysis it is describing is NOT USABLE."
 *   ⛔  `requires_rerun === true` is NOT in the set, and that exclusion is the
 *       load-bearing one. It means the graph has moved since the run — an
 *       ordinary edit sets it — so folding it in would withdraw the leading
 *       option every time anybody edits anything. That is the "suppression too
 *       wide" failure (CLAUDE.md trap 22b): a fix for a lie that buys a gap.
 *       Staleness already has an owner — the freshness slice — and what it says
 *       is "stale", not "unnameable". Pinned below as an explicit NEGATIVE.
 *
 * Q1 and Q3 keep their own reason strings all the way to the store, so a future
 * relaxation of one cannot silently relax the other (the two-harms-under-one-
 * predicate trap this applier's own divergence guards are already split for).
 *
 * ⭐ IT MARKS, IT DOES NOT DELETE. The user's numbers stay in the slice. What
 * is withdrawn is the DESIGNATION — the claim the producer has just refused —
 * and CEE's own withheld projection makes the same distinction: the DATA is not
 * withheld, only the CLAIM.
 */
import { describe, it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import {
  applyScenarioAnalysisRead,
  type ScenarioAnalysisApplyStore,
} from '../applyScenarioAnalysisRead'

type WithholdFn = NonNullable<ScenarioAnalysisApplyStore['resultsWithholdLeaderClaim']>
type ResultsCompleteFn = NonNullable<ScenarioAnalysisApplyStore['resultsComplete']>

/**
 * A contract-valid verdict, every member spelled so a reader can see which one
 * each test moves. `AnalysisStateV1` is `.strict()` at every level, so a typo
 * fails the contract rather than silently widening the fixture.
 */
function verdict(overrides: Partial<AnalysisStateV1> = {}): AnalysisStateV1 {
  return {
    run_state: { kind: 'refused', reason_code: 'separation_unavailable' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: true,
    blocked_unusable: true,
    contradictions: [],
    ...overrides,
  } as AnalysisStateV1
}

/** A real `analysis_result` block, of the shape CEE's builder emits. */
const RESULT_BLOCK = {
  type: 'analysis_result',
  summary: 'Hiring leads on the current model.',
  leading_option_id: 'opt_hire',
  win_probabilities: { opt_hire: 0.68, opt_hold: 0.32 },
  computed_against_hash: 'hash_draft',
}

function makeStore(overrides: Partial<ScenarioAnalysisApplyStore> = {}): {
  store: ScenarioAnalysisApplyStore
  withhold: Mock<Parameters<WithholdFn>, ReturnType<WithholdFn>>
  resultsComplete: Mock<Parameters<ResultsCompleteFn>, ReturnType<ResultsCompleteFn>>
  calls: string[]
} {
  const calls: string[] = []
  const withhold = vi.fn<Parameters<WithholdFn>, ReturnType<WithholdFn>>(() => {
    calls.push('resultsWithholdLeaderClaim')
  })
  const resultsComplete = vi.fn<Parameters<ResultsCompleteFn>, ReturnType<ResultsCompleteFn>>(() => {
    calls.push('resultsComplete')
  })
  return {
    store: {
      setAnalysisStateV1: vi.fn(),
      resultsComplete,
      resultsWithholdLeaderClaim: withhold,
      currentResultsHash: null,
      ...overrides,
    } as ScenarioAnalysisApplyStore,
    withhold,
    resultsComplete,
    calls,
  }
}

describe('applyScenarioAnalysisRead — a withheld payload marks the held report', () => {
  it('DEFECT SIGNATURE: a refusal carrying NO analysis block withdraws the held claim', () => {
    // The exact witnessed shape: refused, blocked_unusable, leader withheld,
    // and no block — the branch that had no else.
    const { store, withhold } = makeStore()
    applyScenarioAnalysisRead({ analysisState: verdict(), analysisResult: null, store })
    expect(withhold).toHaveBeenCalledTimes(1)
  })

  it('the reason names WHICH question withheld, so the two cannot be relaxed together', () => {
    const q1Only = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ blocked_unusable: false }),
      analysisResult: null,
      store: q1Only.store,
    })
    expect(q1Only.withhold).toHaveBeenCalledWith('leader_claim_withheld')

    const q3Only = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ leader_claim: { permitted: true }, blocked_unusable: true }),
      analysisResult: null,
      store: q3Only.store,
    })
    expect(q3Only.withhold).toHaveBeenCalledWith('analysis_unusable')
  })

  it('CONTRAST CONTROL — a permitting, usable verdict withholds NOTHING', () => {
    // Without this the applier could satisfy every assertion above by
    // withholding on every payload, which would blank the leading option on
    // every poll. An absence probe needs a positive control; this is its twin.
    const { store, withhold } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({
        run_state: { kind: 'complete_current', computed_at: '2026-09-04T10:00:00Z' },
        leader_claim: { permitted: true },
        requires_rerun: false,
        blocked_unusable: false,
      }),
      analysisResult: null,
      store,
    })
    expect(withhold).not.toHaveBeenCalled()
  })

  it('⛔ NEGATIVE — `requires_rerun` ALONE is staleness, NOT a withholding', () => {
    // The over-suppression control. An ordinary edit sets this; withdrawing the
    // leading option here would trade one silent failure for another and the
    // suite would applaud (trap 22b).
    const { store, withhold } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({
        run_state: {
          kind: 'complete_stale',
          computed_at: '2026-09-04T10:00:00Z',
          cause: 'graph_changed',
        },
        leader_claim: { permitted: true },
        requires_rerun: true,
        blocked_unusable: false,
      }),
      analysisResult: null,
      store,
    })
    expect(withhold).not.toHaveBeenCalled()
  })

  it('IT MARKS, IT DOES NOT DELETE: a blockless payload never reaches `resultsComplete`', () => {
    const { store, resultsComplete } = makeStore()
    applyScenarioAnalysisRead({ analysisState: verdict(), analysisResult: null, store })
    expect(resultsComplete).not.toHaveBeenCalled()
  })

  it('a withheld payload that DOES carry a block withholds the freshly-written report, AFTER writing it', () => {
    // The other half: CEE may ship an analysis AND refuse the designation over
    // it. The order is the correctness — a withholding stamped before the
    // results write would be overwritten by it.
    const { store, calls } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({
        run_state: { kind: 'complete_current', computed_at: '2026-09-04T10:00:00Z' },
      }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(calls).toEqual(['resultsComplete', 'resultsWithholdLeaderClaim'])
  })

  it('an ALREADY-HELD result is still withheld — the hash dedupe must not swallow the refusal', () => {
    // The dedupe returns `alreadyHeld` early. A re-read of an analysis we
    // already display, arriving with the producer's refusal attached, must
    // still apply it — otherwise the second poll silently re-permits a claim
    // the first one withdrew.
    const heldHash = (() => {
      const probe = makeStore()
      applyScenarioAnalysisRead({
        analysisState: verdict({
          run_state: { kind: 'complete_current', computed_at: '2026-09-04T10:00:00Z' },
        }),
        analysisResult: RESULT_BLOCK,
        store: probe.store,
      })
      // Derived from the REAL mapper rather than hardcoded, so the dedupe below
      // is provably exercised instead of being asserted about a guessed hash.
      return probe.resultsComplete.mock.calls[0]![0]!.hash
    })()

    const { store, withhold, resultsComplete } = makeStore({ currentResultsHash: heldHash })
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({
        run_state: { kind: 'complete_current', computed_at: '2026-09-04T10:00:00Z' },
      }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    // PIN THE PRECONDITION IN-TEST (trap 13b): this must be the dedupe path, or
    // the assertion below is about a different branch than the one it names.
    expect(outcome.outcome).toBe('alreadyHeld')
    expect(resultsComplete).not.toHaveBeenCalled()
    expect(withhold).toHaveBeenCalledTimes(1)
  })

  it('a DIVERGENT canvas withholds nothing — the verdict describes another graph', () => {
    // The applier already declines to write anything when the canvas does not
    // derive from an accepted server graph. A withholding sourced from a
    // verdict about a DIFFERENT graph would be a suppression justified by a
    // fact about something the user is not looking at, and this leg's rule is
    // that a divergent read writes NOTHING.
    const { store, withhold } = makeStore({ graphAcceptedForCanvas: false })
    applyScenarioAnalysisRead({ analysisState: verdict(), analysisResult: null, store })
    expect(withhold).not.toHaveBeenCalled()
  })

  it('a NON-TERMINAL verdict withholds nothing — "not yet" is not an answer', () => {
    const { store, withhold } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ run_state: { kind: 'never_run' } }),
      analysisResult: null,
      store,
    })
    expect(withhold).not.toHaveBeenCalled()
  })
})

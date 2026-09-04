/**
 * THE BOOT LEG — THE WITHHOLDING SURVIVES A RELOAD. W1-e (c), the D9 half.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARM, WITNESSED ON DEPLOYED STAGING `113375a1` (drive 3, 4 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * CEE refuses to name a leading option; the refusal is rendered in the
 * conversation. The user reloads. Measured post-reload: "did not run" 0
 * occurrences, "Leading option" 1. **The honest half was transient and the
 * unsafe half was durable, which is exactly backwards.**
 *
 * `applyBootAnalysisVerdict` restores only `complete_stale` and declines every
 * other kind — CORRECTLY. A previous session's `refused` asserts the model is
 * not analysable, the boot merge can falsify exactly that by supplying the
 * values CEE was refusing over, and a restored `refused` reaches the run gate
 * and DISABLES the Analyse control on a model that is fine right now. None of
 * that is being reopened here.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO QUESTIONS UNDER ONE RESTORE — AND ONLY ONE OF THEM IS MONOTONE
 * ═══════════════════════════════════════════════════════════════════════════
 *   RUN STATE   "is this analysis current, and is this model analysable?"
 *               NOT monotone. The boot merge can falsify it. Declined.
 *   PERMISSION  "did the producer refuse to name a leading option?"
 *               MONOTONE. No merge and no local edit can turn a refusal into a
 *               permission — only a NEW RUN can, and a new run brings a new
 *               report carrying no withholding at all. Restorable.
 *
 * That is the SAME test `applyBootAnalysisVerdict` already applies to
 * `complete_stale` ("restore a verdict only if NOTHING THE BOOT MERGE DOES CAN
 * FALSIFY IT"), applied to a different question. The two are named apart rather
 * than aligned: this function cannot restore a run state and that one cannot
 * withhold a claim.
 *
 * ⭐ WITHHOLD-ONLY, AND THE ASYMMETRY IS THE WHOLE SAFETY ARGUMENT. The client
 * cannot prove the report it restored from the autosave is the one this verdict
 * describes. So it may SUBTRACT a claim on the producer's word and may never
 * ADD one back. Restoring a withholding can only ever cost the user a
 * designation they were not entitled to; restoring a permission could hand them
 * one about a run that never happened.
 */
import { describe, it, expect, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { applyBootLeaderClaimWithholding } from '../applyScenarioAnalysisRead'

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

describe('applyBootLeaderClaimWithholding — a refusal outlives the reload', () => {
  it('DEFECT SIGNATURE: a boot verdict that withholds re-applies the withholding', () => {
    const resultsWithholdLeaderClaim = vi.fn()
    const outcome = applyBootLeaderClaimWithholding({
      analysisState: verdict(),
      store: { resultsWithholdLeaderClaim },
    })
    expect(resultsWithholdLeaderClaim).toHaveBeenCalledTimes(1)
    expect(outcome).toEqual({ outcome: 'withheld', reason: 'leader_claim_withheld' })
  })

  it.each([
    ['refused', { kind: 'refused', reason_code: 'separation_unavailable' }],
    ['blocked', { kind: 'blocked', reason_code: 'not_analysable', blockers: [] }],
    ['never_run', { kind: 'never_run' }],
    ['running', { kind: 'running', started_at: '2026-09-04T10:00:00Z' }],
    ['unknown_degraded', { kind: 'unknown_degraded', cause: 'legacy_fact' }],
    ['complete_current', { kind: 'complete_current', computed_at: '2026-09-04T10:00:00Z' }],
    ['complete_stale', { kind: 'complete_stale', computed_at: '2026-09-04T10:00:00Z', cause: 'graph_changed' }],
  ])(
    'INDEPENDENT of the run-state restore: it withholds under `%s` too',
    (_label, runState) => {
      // The run-state restore declines all but one of these, for reasons that
      // stand. That decline must not take the monotone withholding down with
      // it — which is precisely what it did on the deployed build.
      const resultsWithholdLeaderClaim = vi.fn()
      applyBootLeaderClaimWithholding({
        analysisState: verdict({ run_state: runState as AnalysisStateV1['run_state'] }),
        store: { resultsWithholdLeaderClaim },
      })
      expect(resultsWithholdLeaderClaim).toHaveBeenCalledTimes(1)
    },
  )

  it('WITHHOLD-ONLY: a permitting boot verdict writes NOTHING — it never GRANTS', () => {
    const resultsWithholdLeaderClaim = vi.fn()
    const outcome = applyBootLeaderClaimWithholding({
      analysisState: verdict({
        run_state: { kind: 'complete_current', computed_at: '2026-09-04T10:00:00Z' },
        leader_claim: { permitted: true },
        requires_rerun: false,
        blocked_unusable: false,
      }),
      store: { resultsWithholdLeaderClaim },
    })
    expect(resultsWithholdLeaderClaim).not.toHaveBeenCalled()
    expect(outcome).toEqual({ outcome: 'noop', reason: 'not_withheld' })
  })

  it('⛔ NEGATIVE — `requires_rerun` alone does NOT withhold at boot either', () => {
    // The same over-suppression control as the live leg, at the same predicate.
    // Both legs read ONE definition of "withholds"; if they ever diverge, one
    // of these two suites REDs.
    const resultsWithholdLeaderClaim = vi.fn()
    applyBootLeaderClaimWithholding({
      analysisState: verdict({
        run_state: { kind: 'complete_stale', computed_at: '2026-09-04T10:00:00Z', cause: 'graph_changed' },
        leader_claim: { permitted: true },
        requires_rerun: true,
        blocked_unusable: false,
      }),
      store: { resultsWithholdLeaderClaim },
    })
    expect(resultsWithholdLeaderClaim).not.toHaveBeenCalled()
  })

  it('an ABSENT verdict writes NOTHING — absence is not a state', () => {
    // An older CEE, a graphless scenario and a verdict that failed the
    // contract's own validation all arrive here as `null`, and in each case we
    // know strictly less than a moment ago.
    const resultsWithholdLeaderClaim = vi.fn()
    const outcome = applyBootLeaderClaimWithholding({
      analysisState: null,
      store: { resultsWithholdLeaderClaim },
    })
    expect(resultsWithholdLeaderClaim).not.toHaveBeenCalled()
    expect(outcome).toEqual({ outcome: 'noop', reason: 'no_verdict' })
  })

  it('a store without the action is a no-op, never a throw', () => {
    // Boot legs never throw: an unhandled rejection at boot is how a canvas
    // ends up in an undefined state.
    expect(() =>
      applyBootLeaderClaimWithholding({ analysisState: verdict(), store: {} }),
    ).not.toThrow()
  })
})

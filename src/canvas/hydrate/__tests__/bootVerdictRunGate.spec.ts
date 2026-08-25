/**
 * ⚠⚠ THE BOOT RESTORE MUST NOT CLOSE THE ANALYSE GATE.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT THIS CLOSES, MEASURED BEFORE IT WAS WRITTEN
 * ═══════════════════════════════════════════════════════════════════════════
 * The first cut of the boot restore reasoned about `run_state.kind` ONLY. But
 * `selectAnalysisReadinessAuthority` (`analysisStateSelector.ts:809`) NEVER
 * LOOKS AT `run_state` — it reads `readiness.status` and `readiness.blockers`
 * and hands them to `readinessObjectsToRun`, the run gate's one predicate
 * (`canRunAnalysis.ts:425`), which objects on
 * `status === 'blocked' || actionableBlockers(blockers).length > 0`.
 *
 * So `readiness` RIDES ALONG on every restored verdict and reaches the Analyse
 * control on three mounted surfaces (`usePreAnalysisModel.ts:257`,
 * `OutputsDock.tsx:1130,1303`, `ConversationPanel.tsx:560`). Measured:
 *
 *   PRE-PR   verdict null                        -> false  (Analyse ENABLED)
 *   restored `blocked`  (readiness 'blocked')    -> TRUE   (Analyse DISABLED)
 *   restored `refused`  (readiness 'blocked')    -> TRUE   (Analyse DISABLED)
 *   restored `complete_stale` (readiness ready)  -> false  (contrast control)
 *
 * A verdict from a PREVIOUS session could therefore disable Analyse on a model
 * that is analysable right now — the same false-block harm a parallel lane is
 * fixing, arriving by a different route, and NOT caught by that fix: it objects
 * through clause (a) (`status === 'blocked'` with an EMPTY blocker list), while
 * the `mayRun` work addresses clause (b). Two fixes for one harm, each correct
 * in isolation, recreating it between them (trap 21).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE RULE, SYMMETRIC WITH THE `complete_current` DECLINE
 * ═══════════════════════════════════════════════════════════════════════════
 * `complete_current` is declined because the client cannot verify a currency
 * claim. A previous session's REFUSAL is equally unverifiable — and worse in
 * consequence: a false currency claim misinforms, a false block REMOVES THE
 * USER'S ACTION. So: restore a verdict only when it cannot close the gate.
 *
 * ⚠ THE OBJECTION IS IMPORTED, NEVER MIRRORED. The expectations below are
 * derived by calling the GATE'S OWN predicate, so this suite cannot drift from
 * the gate on the next change to either. A local re-implementation would be a
 * second authority for one question — this estate's most repeated defect.
 *
 * ⚠ AND THE LESSON THAT PRODUCED THIS FILE: the original guard was correct and
 * POINTED AT THE WRONG BYTES. Hence the two identity tests at the end, which
 * assert the gate inspects `readiness` and not `run_state`.
 */

import { describe, it, expect, vi } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { applyBootAnalysisVerdict } from '../applyScenarioAnalysisRead'
import { selectAnalysisReadinessAuthority } from '../../state/analysisStateSelector'
import { readinessObjectsToRun } from '../../utils/canRunAnalysis'

function v(
  runState: AnalysisStateV1['run_state'],
  readiness: { status: string; blockers: readonly unknown[] },
  over: Partial<AnalysisStateV1> = {},
): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness,
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: true,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  } as AnalysisStateV1
}

const STALE = { kind: 'complete_stale', computed_at: '2026-08-25T09:00:00.000Z', cause: 'graph_changed' } as never
const BLOCKED = { kind: 'blocked', reason_code: 'no_options', blockers: [] } as never
const REFUSED = { kind: 'refused', reason_code: 'declined_by_policy' } as never

const READY = { status: 'ready', blockers: [] as readonly unknown[] }
/** The shape `buildAnalysisRefusalReadiness` emits: 'blocked' with NO blockers. */
const GATE_CLOSING = { status: 'blocked', blockers: [] as readonly unknown[] }

function makeStore() {
  const setAnalysisStateV1 = vi.fn()
  return { store: { setAnalysisStateV1 }, setAnalysisStateV1 }
}

/** THE ORACLE — the gate's own predicate, not a restatement of it. */
function gateObjects(verdict: AnalysisStateV1): boolean {
  return readinessObjectsToRun(null, selectAnalysisReadinessAuthority(verdict))
}

describe('PRECONDITIONS — the oracle is the gate, and it discriminates', () => {
  it('POSITIVE CONTROL — the gate objects to a blocking readiness and not to a ready one', () => {
    // Without this the whole file could pass against an oracle that always says
    // the same thing (trap 20: sameness across inputs that ought to differ is
    // evidence about the instrument).
    expect(gateObjects(v(STALE, GATE_CLOSING))).toBe(true)
    expect(gateObjects(v(STALE, READY))).toBe(false)
  })

  it('a null verdict cannot close the gate — the pre-PR boot baseline', () => {
    expect(readinessObjectsToRun(null, selectAnalysisReadinessAuthority(null))).toBe(false)
  })
})

describe('⭐ RED-FIRST — a verdict that would close the Analyse gate is DECLINED', () => {
  it('⭐ restored `blocked` (readiness "blocked") is declined and writes NOTHING', () => {
    const { store, setAnalysisStateV1 } = makeStore()
    const verdict = v(BLOCKED, GATE_CLOSING, { blocked_unusable: true })
    // Bind the premise: this verdict genuinely closes the gate, per the gate.
    expect(gateObjects(verdict)).toBe(true)

    const outcome = applyBootAnalysisVerdict({ analysisState: verdict, store })
    expect(outcome).toEqual({ outcome: 'declined', reason: 'closes_run_gate' })
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('⭐ restored `refused` (readiness "blocked") is declined and writes NOTHING', () => {
    const { store, setAnalysisStateV1 } = makeStore()
    const verdict = v(REFUSED, GATE_CLOSING)
    expect(gateObjects(verdict)).toBe(true)

    const outcome = applyBootAnalysisVerdict({ analysisState: verdict, store })
    expect(outcome).toEqual({ outcome: 'declined', reason: 'closes_run_gate' })
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('⭐ THE GENERAL EXPOSURE: even `complete_stale` is declined when ITS readiness would object', () => {
    // Narrowing the restorable set to `complete_stale` would NOT have closed
    // this — `readiness` rides along on every verdict, whatever its kind.
    const { store, setAnalysisStateV1 } = makeStore()
    const verdict = v(STALE, GATE_CLOSING)
    expect(gateObjects(verdict)).toBe(true)

    expect(applyBootAnalysisVerdict({ analysisState: verdict, store })).toEqual({
      outcome: 'declined',
      reason: 'closes_run_gate',
    })
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('⭐ END-TO-END: nothing this applier restores can close the gate', () => {
    // The invariant stated against the SPEC rather than against the cases in
    // hand: for every verdict, if it was restored then the gate does not object.
    const cases = [
      v(STALE, READY), v(STALE, GATE_CLOSING),
      v(BLOCKED, READY, { blocked_unusable: true }), v(BLOCKED, GATE_CLOSING, { blocked_unusable: true }),
      v(REFUSED, READY), v(REFUSED, GATE_CLOSING),
    ]
    let restoredCount = 0
    for (const verdict of cases) {
      const { store } = makeStore()
      const outcome = applyBootAnalysisVerdict({ analysisState: verdict, store })
      if (outcome.outcome === 'restored') {
        restoredCount += 1
        expect({ kind: verdict.run_state.kind, objects: gateObjects(verdict) }).toEqual({
          kind: verdict.run_state.kind,
          objects: false,
        })
      }
    }
    // ...and the loop is not vacuous. Without this, declining EVERYTHING would
    // satisfy the invariant perfectly (a guard too strict to fail).
    expect(restoredCount).toBeGreaterThan(0)
  })
})

describe('⭐ BOTH DIRECTIONS — the capability must survive the new guard', () => {
  it('⭐⭐ `complete_stale` with a NON-objecting readiness STILL restores — the whole none→changed win', () => {
    const { store, setAnalysisStateV1 } = makeStore()
    const verdict = v(STALE, READY)
    expect(gateObjects(verdict)).toBe(false)

    expect(applyBootAnalysisVerdict({ analysisState: verdict, store })).toEqual({
      outcome: 'restored',
      kind: 'complete_stale',
    })
    expect(setAnalysisStateV1).toHaveBeenCalledTimes(1)
    expect(setAnalysisStateV1.mock.calls[0]![0]).toBe(verdict)
  })

  it('`blocked` / `refused` with a non-objecting readiness still restore — the guard is not a set narrowing', () => {
    // Proves the new rule keys on the GATE, not on the kind. If it had been
    // implemented as "drop the refusal-shaped kinds", these would decline.
    for (const runState of [BLOCKED, REFUSED]) {
      const { store, setAnalysisStateV1 } = makeStore()
      const verdict = v(runState, READY, { blocked_unusable: runState === BLOCKED })
      expect(gateObjects(verdict)).toBe(false)
      expect(applyBootAnalysisVerdict({ analysisState: verdict, store }).outcome).toBe('restored')
      expect(setAnalysisStateV1).toHaveBeenCalledTimes(1)
    }
  })

  it('an ACTIONABLE blocker also declines, even under a `ready` status — clause (b), not just (a)', () => {
    const { store } = makeStore()
    const withBlocker = v(STALE, {
      status: 'ready',
      blockers: [{ code: 'missing_option_value', category: 'input', message: 'x', repairability: 'user' }],
    })
    // Premise pinned via the gate: this really does object, by the other clause.
    expect(gateObjects(withBlocker)).toBe(true)
    expect(applyBootAnalysisVerdict({ analysisState: withBlocker, store }).outcome).toBe('declined')
  })
})

describe('⭐ IDENTITY — the guard inspects the member the GATE inspects', () => {
  it('holding `run_state` CONSTANT, changing ONLY `readiness` changes the decision', () => {
    // Proves the guard is pointed at `readiness`. The original defect was a
    // guard that was correct and pointed at the wrong bytes.
    const a = applyBootAnalysisVerdict({ analysisState: v(STALE, READY), store: makeStore().store })
    const b = applyBootAnalysisVerdict({ analysisState: v(STALE, GATE_CLOSING), store: makeStore().store })
    expect(a.outcome).toBe('restored')
    expect(b.outcome).toBe('declined')
  })

  it('holding `readiness` CONSTANT, changing ONLY `run_state` does NOT change it — for restorable kinds', () => {
    // The discriminating twin. Together with the test above this pins WHICH
    // member decides: `readiness` does, `run_state.kind` does not (beyond the
    // restorable-set membership the other spec already covers).
    const outcomes = [STALE, BLOCKED, REFUSED].map(
      (rs) =>
        applyBootAnalysisVerdict({
          analysisState: v(rs, READY, { blocked_unusable: rs === BLOCKED }),
          store: makeStore().store,
        }).outcome,
    )
    expect(outcomes).toEqual(['restored', 'restored', 'restored'])
  })
})

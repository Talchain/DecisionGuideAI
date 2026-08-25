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
 * POINTED AT THE WRONG BYTES. Hence the identity tests at the end.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ AND THE LESSON THIS FILE THEN LEARNED ABOUT ITSELF
 * ═══════════════════════════════════════════════════════════════════════════
 * `gateObjects` below is BYTE-IDENTICAL to the guard it tests. That makes this
 * suite able to prove the guard is PRESENT (mutant M4: delete it, six tests
 * RED) and structurally UNABLE to prove the guard asks the RIGHT QUESTION — a
 * guard agreeing with itself (trap 13b), because the oracle was derived from
 * the implementation rather than from the spec the consumer parses.
 *
 * It was wrong in exactly that way: a `blocked` verdict with a READY readiness
 * passed this gate and still degraded the product, because that harm travels
 * via `run_state.kind`, which the gate never reads. This file's earlier
 * `blocked`/`refused` cases PINNED THE DEFECTIVE PAYLOAD AS CORRECT.
 *
 * The consumer-level invariant now lives in
 * `bootVerdictNoDisplayRegression.spec.ts`, whose oracle is
 * `composeAnalysisState`. THIS file keeps a narrower and still-real job: the
 * run-gate guard, which remains live and necessary because a `complete_stale`
 * verdict can itself carry a blocking readiness.
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
  it('⚠ `blocked` is declined by the KIND rule, which now runs FIRST', () => {
    // ⚠ THIS ASSERTED `closes_run_gate` UNTIL `blocked` LEFT THE RESTORABLE SET.
    // The reason moved because the ORDER matters: the kind rule precedes the
    // gate rule, so a kind that may never be restored is refused on its own
    // terms rather than incidentally, by a readiness that happens to object.
    // Relying on the gate to catch it was the defect — a `blocked` verdict with
    // a READY readiness sails straight past the gate.
    const { store, setAnalysisStateV1 } = makeStore()
    const verdict = v(BLOCKED, GATE_CLOSING, { blocked_unusable: true })
    expect(applyBootAnalysisVerdict({ analysisState: verdict, store })).toEqual({
      outcome: 'declined',
      reason: 'not_restorable',
    })
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('⚠ `refused` likewise — declined by kind, not by readiness', () => {
    const { store, setAnalysisStateV1 } = makeStore()
    const verdict = v(REFUSED, GATE_CLOSING)
    expect(applyBootAnalysisVerdict({ analysisState: verdict, store })).toEqual({
      outcome: 'declined',
      reason: 'not_restorable',
    })
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

  it('⚠⚠ `blocked` / `refused` are declined EVEN WITH A NON-OBJECTING READINESS', () => {
    // ⭐ THIS TEST ASSERTED THE OPPOSITE, AND THE OPPOSITE WAS THE DEFECT. It
    // read "these still restore — the guard is not a set narrowing", which
    // PINNED THE DEFECTIVE PAYLOAD AS CORRECT BEHAVIOUR: a `blocked` verdict
    // whose readiness is READY passes the gate guard and still degrades the
    // product, because the harm travels via `run_state.kind`.
    //
    // The premise is kept and inverted rather than deleted — the readiness
    // genuinely does not object, which is precisely why the gate guard could
    // never have caught this and why the narrowing was the right remedy.
    for (const runState of [BLOCKED, REFUSED]) {
      const { store, setAnalysisStateV1 } = makeStore()
      const verdict = v(runState, READY, { blocked_unusable: runState === BLOCKED })
      expect(gateObjects(verdict)).toBe(false)
      expect(applyBootAnalysisVerdict({ analysisState: verdict, store }).outcome).toBe('declined')
      expect(setAnalysisStateV1).not.toHaveBeenCalled()
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

  it('⭐ holding `readiness` CONSTANT, changing ONLY `run_state` DOES change it — both members decide', () => {
    // ⭐ THIS ALSO ASSERTED THE OPPOSITE, AND THE COMMENT BESIDE IT — "`readiness`
    // decides, `run_state.kind` does not" — was TRUE OF THE GUARD AND FALSE OF
    // THE PRODUCT. That sentence is the whole defect in one line.
    //
    // The corrected truth is that TWO members decide, for two different reasons:
    //   · `run_state.kind` decides MEMBERSHIP — may this kind ever be restored?
    //   · `readiness`      decides ADMISSIBILITY — would this instance close the
    //                      Analyse gate?
    // Neither subsumes the other, which is why both guards exist.
    const outcomes = [STALE, BLOCKED, REFUSED].map(
      (rs) =>
        applyBootAnalysisVerdict({
          analysisState: v(rs, READY, { blocked_unusable: rs === BLOCKED }),
          store: makeStore().store,
        }).outcome,
    )
    expect(outcomes).toEqual(['restored', 'declined', 'declined'])
  })
})

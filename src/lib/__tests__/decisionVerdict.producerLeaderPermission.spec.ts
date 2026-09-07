/**
 * THE PRODUCER'S PERMISSION IS A CONJUNCT OF THE VERDICT — W1-e (a).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARM, WITNESSED ON DEPLOYED STAGING `113375a1` (drive 3, 4 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * A user corrects a value. CEE answers with
 *   `analysis_state.leader_claim = { permitted: false,
 *                                    withheld_reason: 'separation_unavailable' }`
 * and the canvas goes on rendering `Leading option`. `deriveDecisionVerdict`
 * — the ONE module entitled to answer "is there a leading option?" — reads
 * `option_probabilities`, `robustness.recommended_option_id`,
 * `robustness.near_tie` and `decision_brief.headline_banded`, and reads the
 * producer's permission NOWHERE. So an explicit refusal has no path to the
 * surface that acts on it.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * TWO QUESTIONS, NAMED APART, COMPOSED AT THE POINT OF USE
 * ═══════════════════════════════════════════════════════════════════════════
 *   Q1 PERMISSION  "may a leading option be named for this analysis?"
 *                  Answered by the PRODUCER (`leader_claim.permitted`),
 *                  carried on the report as `producer_leader_permission`.
 *   Q2 SEPARATION  "does this report separate the arms?"
 *                  Answered by the CLIENT, from the report's own numbers and
 *                  the producer's near-tie / band signals.
 *
 * Neither leaf is redefined and neither default is aligned to the other. Q2's
 * existing answer is asserted UNCHANGED on every payload where Q1 is silent —
 * that is the contrast control, and without it these tests could pass by
 * suppressing everything.
 *
 * ⭐ WHY THE PERMISSION RIDES THE REPORT AND NOT THE LIVE WIRE SLICE. On the
 * wire it lives on `analysis_state`, which `applyV5State` CLEARS on every turn
 * that does not restate it ("the field's whole contract is 'CEE stated this FOR
 * THIS TURN'"). The claim it governs belongs to the REPORT, which outlives the
 * turn and the session. Bound to the turn, the permission evaporates on the
 * next message and the unsafe claim returns — which is the second half of the
 * witnessed harm. Bound to the report, it lives exactly as long as the thing it
 * is about, and rides the autosave record home.
 *
 * ⭐ ABSENCE MEANS AN OLDER PRODUCER, NEVER "NO". `permitted` is REQUIRED and
 * BOOLEAN inside `leader_claim` at the pinned contract (`@talchain/schemas`
 * 0.50.0, `dist/boundary/analysis-state.d.ts:450-461`), but the field is absent
 * from every report this UI has ever persisted. Reading absence as a refusal
 * would blank the leading option on every restored answer in the estate.
 */
import { describe, it, expect } from 'vitest'

import { deriveDecisionVerdict, type DecisionVerdictReportLike } from '../decisionVerdict'

const LEADER = 'opt_leader'
const RIVAL = 'opt_rival'

/**
 * A report on which Q2 alone says there IS a leading option, by the producer's
 * own near-tie signal naming the win argmax. Everything here is the SHIPPED
 * permitting shape — the only thing any test below changes is Q1.
 */
function permittedReport(): DecisionVerdictReportLike {
  return {
    option_probabilities: {
      [LEADER]: { win_probability: 0.71 },
      [RIVAL]: { win_probability: 0.22 },
    },
    robustness: {
      recommended_option_id: LEADER,
      near_tie: { is_tie: false, top_option_id: LEADER },
    },
  }
}

/** The wire's own words, spelled verbatim rather than through a helper, so a
 *  RED here is about BEHAVIOUR and never about a missing export. */
function withPermission(
  report: DecisionVerdictReportLike,
  permission: unknown,
): DecisionVerdictReportLike {
  return { ...report, producer_leader_permission: permission } as DecisionVerdictReportLike
}

describe('deriveDecisionVerdict — Q1 (producer permission) is a conjunct, not a redefinition', () => {
  it('PRECONDITION: with Q1 silent, this fixture names a leader (the state the harm was witnessed in)', () => {
    // Trap 13b — pin the precondition IN-TEST. Every assertion below is about
    // withdrawing a claim; if the fixture ever stopped producing one, the
    // withholding tests would pass by testing nothing.
    const verdict = deriveDecisionVerdict(permittedReport())
    expect(verdict.hasLeadingOption).toBe(true)
    expect(verdict.leaderId).toBe(LEADER)
    expect(verdict.separation).toBe('clear')
  })

  it('DEFECT SIGNATURE: `permitted:false` withdraws the entitlement', () => {
    const verdict = deriveDecisionVerdict(
      withPermission(permittedReport(), {
        permitted: false,
        withheld_reason: 'separation_unavailable',
      }),
    )
    expect(verdict.hasLeadingOption).toBe(false)
  })

  it('IDENTITY SURVIVES the withholding — only the ENTITLEMENT is withdrawn', () => {
    // This module's own doctrine (its no-claim exit): identity and entitlement
    // are different questions, and non-claiming consumers — ordering, focus,
    // the decision record — must keep working.
    const verdict = deriveDecisionVerdict(withPermission(permittedReport(), { permitted: false }))
    expect(verdict.leaderId).toBe(LEADER)
    expect(verdict.gapPp).toBe(49)
    // Fail toward SILENCE, never toward a DENIAL: `tied` would license "no
    // clear leading option", a second claim we equally have no authority for.
    expect(verdict.separation).toBe('unknown')
    expect(verdict.source).toBe('none')
  })

  it('CONTRAST CONTROL — `permitted:true` changes NOTHING', () => {
    expect(deriveDecisionVerdict(withPermission(permittedReport(), { permitted: true })))
      .toEqual(deriveDecisionVerdict(permittedReport()))
  })

  it('CONTRAST CONTROL — an ABSENT permission is an older producer, not a refusal', () => {
    expect(deriveDecisionVerdict(permittedReport()).hasLeadingOption).toBe(true)
  })

  it.each([
    ['a string "false"', { permitted: 'false' }],
    ['the number 0', { permitted: 0 }],
    ['a null permitted', { permitted: null }],
    ['an empty object', {}],
    ['a null block', null],
    ['a string block', 'withheld'],
  ])('CONTRAST CONTROL — a non-boolean permission (%s) is NOT a refusal', (_label, permission) => {
    // STRICT BOOLEAN, not falsiness. A malformed field is a producer we cannot
    // read, and an unreadable producer has said nothing — treating it as "no"
    // would let a contract drift silently blank every leader in the estate.
    expect(deriveDecisionVerdict(withPermission(permittedReport(), permission)).hasLeadingOption)
      .toBe(true)
  })

  it('DOES NOT REDEFINE Q2: a withheld payload that ALREADY had no leader is untouched', () => {
    // Q1 may only ever SUBTRACT. A report Q2 already declined must come back
    // identical, so a future relaxation of Q1 cannot manufacture a claim.
    const noSignal: DecisionVerdictReportLike = {
      option_probabilities: {
        [LEADER]: { win_probability: 0.51 },
        [RIVAL]: { win_probability: 0.49 },
      },
    }
    expect(deriveDecisionVerdict(withPermission(noSignal, { permitted: false })))
      .toEqual(deriveDecisionVerdict(noSignal))
  })

  it('the withholding OUTRANKS the producer band, which is the other authority that names a leader', () => {
    // Two producer authorities can each mint `hasLeadingOption: true`. A guard
    // placed on one of them only would leave the other open — the estate's
    // one-question-two-gates defect. Driven explicitly rather than assumed.
    const banded: DecisionVerdictReportLike = {
      option_probabilities: {
        [LEADER]: { win_probability: 0.71 },
        [RIVAL]: { win_probability: 0.22 },
      },
      decision_brief: {
        headline_banded: { band: 'clearly_ahead', leader_option_id: LEADER, gap_pp: 49 },
      },
    }
    expect(deriveDecisionVerdict(banded).hasLeadingOption).toBe(true)
    expect(deriveDecisionVerdict(withPermission(banded, { permitted: false })).hasLeadingOption)
      .toBe(false)
  })
})

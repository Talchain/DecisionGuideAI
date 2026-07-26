/**
 * OWNED LEADER CLAIM — the UI renders the producer's leader claim, never one
 * it reconstructed itself. (ROADMAP 1.223, gate G-CEE-1, UI half.)
 *
 * ## The defect this pins
 *
 * CEE #711 made the constraint verdict gate every egress surface: on a turn
 * whose verdict is WITHHELD ("no option can be put forward yet") the wire now
 * carries `leading_option_id: null` and a `decision_brief` stripped of its
 * three leader-ranking members (`headline`, `headline_banded`,
 * `robustness_caveat`). Absence of the owned claim IS the withheld signal —
 * there is no separate flag, by design.
 *
 * The UI did not stop. `normalizeHeadlineBanded(undefined)` returns null and
 * `deriveDecisionVerdict` fell through to **Authority 3, the win-probability
 * residual fallback**, which reconstructed a leader out of the per-option win
 * probabilities that (correctly) still ride the wire. On the live withheld run
 * captured by the render probe that produced `separation: 'clear'` and
 * `hasLeadingOption: true` — so the hero printed "X is slightly ahead", the
 * canvas printed "X leads in 43% of scenarios", and seven more leader surfaces
 * rendered beside CEE's own "no option can be put forward yet".
 *
 * A fallback that reconstructs a withheld claim is not a fallback. It is the
 * defect.
 *
 * ## The fixture
 *
 * `WITHHELD_REPORT` is the post-#711 withheld shape at the point the UI reads
 * it: win probabilities present with a LARGE gap (0.346 — the live figure), a
 * `decision_brief` carrying its non-comparative members only, and no producer
 * leader signal of any kind. Note `robustness.near_tie` is absent because the
 * V5 mapper's keep-list (`mapV5AnalysisToReport`) never forwards it — the live
 * analysis path therefore has no Authority-1 signal either, which is why
 * Authority 3 was reachable at all.
 *
 * `PERMITTED_REPORT` is the same run with the owned claim present. It is the
 * OVER-SUPPRESSION control: every leader surface must keep working. A change
 * that silences the withheld turn by silencing everything is a failure, not a
 * fix.
 */
import { describe, expect, it } from 'vitest'
import {
  deriveDecisionVerdict,
  type DecisionVerdictReportLike,
} from '../decisionVerdict'
import {
  LEADER_ID,
  PERMITTED_REPORT,
  WIN_GAP as GAP,
  WIN_LEADER as WIN_MAC,
  WITHHELD_REPORT,
} from '../__fixtures__/ownedLeaderClaim.fixtures'

describe('deriveDecisionVerdict — the owned claim is the only leader authority', () => {
  it('WITHHELD: no producer leader signal ⇒ no leading option, whatever the gap', () => {
    const v = deriveDecisionVerdict(WITHHELD_REPORT)

    // The entitlement question. This is the single boolean every surface
    // gates on, and it must be false.
    expect(v.hasLeadingOption).toBe(false)
    // 'unknown', NOT 'tied'. The producer withheld the claim; it did not say
    // the options are close. `unknown` licenses silence, `tied` licenses a
    // denial — and a denial here would be a second false claim.
    expect(v.separation).toBe('unknown')
    // RED-PROOF: before the fix this was 'win_probability' — the residual
    // Authority-3 branch. Naming the source pins WHICH branch produced the
    // verdict, so this test cannot pass for the wrong reason.
    expect(v.source).toBe('none')
  })

  it('WITHHELD: the gap really is large — the fixture reaches the deleted branch', () => {
    // Positive control for the fixture itself (TESTING-DISCIPLINE: an absence
    // assertion must first prove it can see a presence). If this drifts below
    // the threshold the suppression test above would pass vacuously.
    expect(GAP).toBeGreaterThan(0.1)
    expect(WIN_MAC).toBeGreaterThan(0.65)
    // The data is still on the wire and still readable — we suppress the
    // CLAIM, never the numbers.
    expect(WITHHELD_REPORT.option_probabilities?.[LEADER_ID]?.win_probability).toBe(WIN_MAC)
  })

  it('PERMITTED: the owned claim is rendered, not re-derived', () => {
    const v = deriveDecisionVerdict(PERMITTED_REPORT)

    expect(v.hasLeadingOption).toBe(true)
    expect(v.separation).toBe('clear')
    expect(v.leaderId).toBe(LEADER_ID)
    // The band is the authority — not the win probabilities that happen to
    // agree with it.
    expect(v.source).toBe('producer_band')
  })

  it('PERMITTED: a producer band naming a DIFFERENT option is not re-pointed', () => {
    // Identity hazard (recovered session): a claim about option X must never
    // license a claim about option Y. With the band inapplicable there is no
    // owned claim for THIS ranking, so the verdict withholds rather than
    // falling back to the win-probability argmax.
    const v = deriveDecisionVerdict({
      ...PERMITTED_REPORT,
      decision_brief: {
        headline_banded: {
          band: 'clearly_ahead',
          leader_option_id: 'opt_dell',
          robustness_gated: false,
        },
      } as unknown as DecisionVerdictReportLike['decision_brief'],
    })
    expect(v.hasLeadingOption).toBe(false)
    expect(v.separation).toBe('unknown')
  })

  it('PERMITTED: a producer near-tie still decides, on the paths that carry one', () => {
    // Authority 1 is untouched — the V2/direct-PLoT path still carries
    // `robustness.near_tie`, and it remains an OWNED producer claim.
    const tied = deriveDecisionVerdict({
      ...WITHHELD_REPORT,
      robustness: {
        recommended_option_id: LEADER_ID,
        near_tie: { is_tie: true, top_option_id: LEADER_ID },
      },
    })
    expect(tied.hasLeadingOption).toBe(false)
    expect(tied.separation).toBe('tied')
    expect(tied.source).toBe('producer_near_tie')

    const notTied = deriveDecisionVerdict({
      ...WITHHELD_REPORT,
      robustness: {
        recommended_option_id: LEADER_ID,
        near_tie: { is_tie: false, top_option_id: LEADER_ID },
      },
    })
    expect(notTied.hasLeadingOption).toBe(true)
    expect(notTied.source).toBe('producer_near_tie')
  })

  it('WITHHELD: identity and the gap survive — only the ENTITLEMENT is withheld', () => {
    const v = deriveDecisionVerdict(WITHHELD_REPORT)
    // The module's own doctrine: "a non-null leaderId does NOT license the
    // phrase 'leading option'". Keeping the id lets non-claiming surfaces
    // (ordering, focus, the decision record) keep working unchanged.
    expect(v.leaderId).toBe(LEADER_ID)
    expect(v.gapPp).toBe(Math.round(GAP * 100))
  })
})

/**
 * `robustness_caveat` — the producer's own sentence about how far the ranking held.
 *
 * ⚠ WHY THIS IS NOT THE SAME CLASS AS `defaulted_assumptions`, AND WHY THE GATE
 * IS THE WHOLE POINT.
 *
 * `robustness_caveat` is one of THREE LEADER-RANKING MEMBERS — with `headline`
 * and `headline_banded` — that CEE strips on a withheld turn. Its own docblock in
 * `ownedLeaderClaim.spec.ts`: *"Absence of the owned claim IS the withheld signal
 * — there is no separate flag, by design."* And the text itself presupposes a
 * ranking: "This RANKING held up under the perturbations tested."
 *
 * The estate has already shipped the defect next door. `deriveDecisionVerdict`'s
 * Authority 3 reconstructed a leader from win probabilities on a withheld run, so
 * the hero printed "X is slightly ahead" beside CEE's own "no option can be put
 * forward yet". Authority 3 was deleted; its token is absent from the `source`
 * union deliberately, so re-deriving a leader is now a type error.
 *
 * Therefore this surface CONSUMES the one authority and never chooses:
 * `hasLeadingOption` — "the single boolean every surface must gate on before
 * asserting OR denying a leading option" — arrives as a prop from the parent that
 * already resolved the verdict. The caveat's PRESENCE is never read as evidence
 * that a leader exists. That is the invariant these tests exist to hold.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { readDecisionBriefViewModel } from '../decisionBriefViewModel'
import { DecisionBriefSection } from '../DecisionBriefSection'

const BRIEF_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301'
const CREATED_AT = '2026-08-25T08:16:20.000Z'
const HELD = 'This ranking held up under the perturbations tested. That is not a guarantee — '
  + 'defaulted or uncertain inputs can still change the result.'
const FRAGILE = 'This ranking was fragile under the perturbations tested — small changes to '
  + 'assumptions could change which option leads.'

const caveat = (text = HELD) => ({ text, basis: 'is_robust', doctrine: 'provisional_doctrine_v0' })
const brief = (extra: Record<string, unknown>) =>
  ({ version: '1', brief_id: BRIEF_ID, created_at: CREATED_AT, ...extra })

const vmWith = (extra: Record<string, unknown>) => readDecisionBriefViewModel(brief({
  top_drivers: [{ factor_label: 'Churn Trend', sensitivity: 0.4, direction: 'positive' }],
  ...extra,
}))

describe('robustness_caveat reaches the view model', () => {
  it('carries the producer text and its basis token verbatim', () => {
    expect(vmWith({ robustness_caveat: caveat() })?.robustnessCaveat)
      .toEqual({ text: HELD, basis: 'is_robust' })
  })

  it('is null when the producer withheld it (the withheld-turn signal)', () => {
    expect(vmWith({})?.robustnessCaveat).toBeNull()
  })

  it('withholds a caveat with no basis — an unattested claim about the ranking', () => {
    expect(vmWith({ robustness_caveat: { text: HELD } })?.robustnessCaveat).toBeNull()
  })

  /**
   * ⚠ THIS TEST PINNED THE WRONG BEHAVIOUR AND IS INVERTED, not deleted.
   *
   * It asserted that a caveat whose text contains a glossary term is WITHHELD, and
   * treated a one-character near-miss (`perturbation` banned, `perturbations` not)
   * as a margin to defend. #846 settled the sibling reader the other way and the
   * reasoning applies here identically: `glossaryCheck` gates UI-AUTHORED COPY, not
   * producer prose. Withholding the producer's own sentence because the analysis
   * used an ordinary word is a silent loss of the one line telling the user how far
   * to trust the ranking.
   *
   * Now asserted in the honest direction: ordinary business vocabulary renders.
   */
  it('renders a caveat containing ordinary business vocabulary, never withholds it', () => {
    for (const word of ['perturbation', 'variance', 'elasticity', 'intervention']) {
      const text = `This ranking held up under the ${word} tested.`
      expect(
        vmWith({ robustness_caveat: caveat(text) })?.robustnessCaveat?.text,
        `a producer sentence containing "${word}" must not be withheld`,
      ).toBe(text)
    }
  })

  it('still withholds a caveat whose text carries a raw identifier', () => {
    // The guard that DOES answer the real question is unchanged.
    const leaky = 'This ranking held up for deadbeefcafe1234 under the tests.'
    expect(vmWith({ robustness_caveat: caveat(leaky) })?.robustnessCaveat).toBeNull()
  })
})

describe('the caveat is gated on the leader claim, and never asserts one', () => {
  it('renders when the producer permitted a leader claim', () => {
    const vm = vmWith({ robustness_caveat: caveat() })!
    render(<DecisionBriefSection brief={vm} leaderClaimPermitted />)
    expect(screen.getByText(new RegExp('held up under the perturbations tested'))).toBeInTheDocument()
  })

  it('renders NOTHING when the leader claim is not permitted, even though the caveat is present', () => {
    // The defect this prevents: a surface treating the caveat's presence as its
    // own evidence that a ranking may be spoken about.
    const vm = vmWith({ robustness_caveat: caveat() })!
    expect(vm.robustnessCaveat).not.toBeNull()
    render(<DecisionBriefSection brief={vm} leaderClaimPermitted={false} />)
    expect(screen.queryByText(new RegExp('held up under the perturbations tested'))).toBeNull()
    expect(screen.queryByTestId('decision-brief-robustness-caveat')).toBeNull()
  })

  it('makes no claim in either direction when the caveat is absent but a leader is permitted', () => {
    const vm = vmWith({})!
    render(<DecisionBriefSection brief={vm} leaderClaimPermitted />)
    expect(screen.queryByTestId('decision-brief-robustness-caveat')).toBeNull()
    // Absence must not be rendered as reassurance.
    expect(document.body.textContent ?? '').not.toMatch(/held up|robust|no caveat|stable/i)
  })

  it('renders the fragile wording as faithfully as the reassuring one', () => {
    const vm = vmWith({ robustness_caveat: caveat(FRAGILE) })!
    render(<DecisionBriefSection brief={vm} leaderClaimPermitted />)
    expect(screen.getByText(new RegExp('was fragile under the perturbations tested'))).toBeInTheDocument()
  })
})

/**
 * L65 — WinGauge: target-set-but-not-scored is its OWN state, never the
 * no-target invitation.
 *
 * THE DEFECT THIS PINS (found by #579's reviewer, verified at `da1630e6`).
 * Post-#308 PLoT suppresses the frame-broken `probability_of_joint_goal` at
 * source, so on the witnessed run class NOTHING arrives in the goal-fit
 * slot: `selectGoalProbability` returns basis 'none' and
 * `jointSubstitutionWithheld: false`. WinGauge's only honest-absence trigger
 * was `goalFitWithheld` — which fires only when a joint figure ARRIVED and
 * was refused — so a run where the user DID set a target fell through to the
 * no-target branch: "Set a success target…" + "Define success", an
 * invitation to do something already done. Stage-1 of this file pinned that
 * wrong invitation GREEN at pristine before being flipped to these pins.
 *
 * THE FIX. WinGauge reads the same store-derived target signal the V7 goal
 * lens already discriminates with (`recommendation.goalThreshold` →
 * `buildV7Lenses.ts` gate `no_target` vs `producer_gap`) as a prop, and for
 * target-set-plus-basis-'none' renders the SAME producer-gap sentence the
 * lens shows for the SAME run state — one claim, one register
 * (`GOAL_ANCHOR_COPY.producerGap`, which `V7_LENS_COPY.goal.gateProducerGap`
 * delegates to). No CTA beside it: there is nothing a user action unlocks.
 *
 * Assertions bind by IDENTITY — exact testid, verbatim register string —
 * never by a value predicate another element could satisfy (trap 19).
 * jsdom scope (trap 3): these pins prove presence/absence in the rendered
 * output, never layout or visibility.
 */

import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { WinGauge, type OptionWinShare } from '../WinGauge'
import { GOAL_ANCHOR_COPY } from '../utils/goalAnchorCopy'
import { V7_LENS_COPY } from '../v7/v7LensCopy'

/** Basis 'none' on every option: no goal figure, nothing withheld. */
function sharesNothingArrived(): OptionWinShare[] {
  return [
    {
      id: 'opt-a',
      label: 'Option A',
      winProbability: 0.7,
      isWinner: true,
      goalProbability: null,
      goalFitIsSubstitutedJoint: false,
      goalFitWithheld: false,
    },
    {
      id: 'opt-b',
      label: 'Option B',
      winProbability: 0.3,
      isWinner: false,
      goalProbability: null,
      goalFitIsSubstitutedJoint: false,
      goalFitWithheld: false,
    },
  ]
}

describe('L65 / WinGauge — target set, nothing arrived (basis none)', () => {
  it('renders the producer-gap sentence, not the invitation to set a target', () => {
    const { container } = render(
      <WinGauge shares={sharesNothingArrived()} goalThreshold={250000} />,
    )
    const text = container.textContent ?? ''

    // The honest-absence state, by testid and verbatim register copy.
    const gap = container.querySelector('[data-testid="win-gauge-goal-producer-gap"]')
    expect(gap).not.toBeNull()
    expect(gap!.textContent).toContain(GOAL_ANCHOR_COPY.producerGap)

    // NOT the no-target invitation: the user already set a target, and the
    // CTA would offer to unlock something no user action can unlock.
    expect(container.querySelector('[data-testid="win-gauge-no-target"]')).toBeNull()
    expect(text).not.toContain(GOAL_ANCHOR_COPY.noTarget)
    expect(text).not.toContain(GOAL_ANCHOR_COPY.noTargetCta)

    // NOT the withheld pair: nothing arrived, so "The analysis produced a
    // figure for your limits" would claim a figure that does not exist.
    expect(container.querySelector('[data-testid="win-gauge-goal-not-scored"]')).toBeNull()
    expect(text).not.toContain(GOAL_ANCHOR_COPY.notScoredReason)

    // No goal numbers were fabricated for it either.
    expect(container.querySelector('[data-testid="win-gauge-goal-block"]')).toBeNull()

    // The comparative block is untouched — the gate withholds one claim, it
    // does not blank the panel.
    expect(container.querySelector('[data-testid="win-gauge-comparative-block"]')).not.toBeNull()
  })

  it('a non-finite target does NOT count as a target (same guard as the V7 lens)', () => {
    const { container } = render(
      <WinGauge shares={sharesNothingArrived()} goalThreshold={Number.NaN} />,
    )
    expect(container.querySelector('[data-testid="win-gauge-no-target"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="win-gauge-goal-producer-gap"]')).toBeNull()
  })
})

describe('L65 / WinGauge — positive controls (the discrimination must not over-fire)', () => {
  it('genuinely-no-target still gets the invitation and its CTA, never the producer-gap sentence', () => {
    // No goalThreshold prop at all — the ordinary state of a run the user
    // set no target on. Without this control, wiring every empty goal block
    // to the producer-gap copy would pass the tests above.
    const { container } = render(<WinGauge shares={sharesNothingArrived()} />)
    const invitation = container.querySelector('[data-testid="win-gauge-no-target"]')
    expect(invitation).not.toBeNull()
    expect(invitation!.textContent).toContain(GOAL_ANCHOR_COPY.noTarget)
    expect(invitation!.textContent).toContain(GOAL_ANCHOR_COPY.noTargetCta)
    expect(container.querySelector('[data-testid="win-gauge-goal-producer-gap"]')).toBeNull()
    expect(container.querySelector('[data-testid="win-gauge-goal-not-scored"]')).toBeNull()
  })

  it('an explicit null target behaves exactly like an absent one', () => {
    const { container } = render(
      <WinGauge shares={sharesNothingArrived()} goalThreshold={null} />,
    )
    expect(container.querySelector('[data-testid="win-gauge-no-target"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="win-gauge-goal-producer-gap"]')).toBeNull()
  })

  it('honest goal numbers with a target still draw the goal block, bound per option by id', () => {
    const honest: OptionWinShare[] = sharesNothingArrived().map((s, i) => ({
      ...s,
      goalProbability: i === 0 ? 0.2 : 0.8,
    }))
    const { container } = render(<WinGauge shares={honest} goalThreshold={250000} />)

    expect(container.querySelector('[data-testid="win-gauge-goal-block"]')).not.toBeNull()
    // IDENTITY-bound: each option's own readout node, found by its id.
    expect(container.querySelector('[data-testid="goal-pct-opt-a"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="goal-pct-opt-b"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="win-gauge-goal-producer-gap"]')).toBeNull()
    expect(container.querySelector('[data-testid="win-gauge-no-target"]')).toBeNull()
  })

  it('PRECEDENCE: a withheld figure keeps the withheld pair even when the target is set', () => {
    // Both signals true: a joint figure arrived and was refused (L62) AND the
    // target is known locally. The withheld pair is the more specific truth —
    // it explains that a figure existed — and must not be displaced by the
    // producer-gap sentence.
    const withheld: OptionWinShare[] = sharesNothingArrived().map((s) => ({
      ...s,
      goalFitWithheld: true,
    }))
    const { container } = render(<WinGauge shares={withheld} goalThreshold={250000} />)

    const notScored = container.querySelector('[data-testid="win-gauge-goal-not-scored"]')
    expect(notScored).not.toBeNull()
    expect(notScored!.textContent).toContain(GOAL_ANCHOR_COPY.notScored)
    expect(notScored!.textContent).toContain(GOAL_ANCHOR_COPY.notScoredReason)
    expect(container.querySelector('[data-testid="win-gauge-goal-producer-gap"]')).toBeNull()
    expect(container.querySelector('[data-testid="win-gauge-no-target"]')).toBeNull()
  })
})

describe('L65 / one sentence, two surfaces', () => {
  it('the V7 goal lens producer-gap gate IS the house register sentence (identity, not equality of copies)', () => {
    // Delegation pin, same shape as gateNoTarget → GOAL_ANCHOR_COPY.noTarget:
    // the lens and the gauge render the same state from the same key, so the
    // two surfaces cannot drift apart under a future copy edit.
    expect(V7_LENS_COPY.goal.gateProducerGap).toBe(GOAL_ANCHOR_COPY.producerGap)
  })
})

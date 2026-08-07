/**
 * stressTestTemplates — Brief 5.8B D4 pure-template tests.
 *
 * Locks the approved copy emitted by buildDisconfirmationCard +
 * buildOutsideViewCard. Future V5 `decision_review` replacement of these
 * deterministic templates must come with its own spec; this one anchors
 * the structural contract (return shape) so the StressTestSection
 * component can keep its assertions stable.
 */

import { describe, it, expect } from 'vitest'
import {
  buildDisconfirmationCard,
  buildOutsideViewCard,
} from '../stressTestTemplates'
import {
  resolveFactorConfidenceDisplay,
  DISPLAY_SAFE_DRIVER_CONFIDENCE,
} from '../../driverConfidenceDisplayPolicy'

// F5a: `topDriverConfidence` is no longer a number — it is the resolved
// display union, so the "limited evidence" branch cannot be reached without a
// value the ruled policy has cleared. `cleared` uses the policy module's
// documented `displaySafe` TEST SEAM so a fixture cannot fabricate a shape the
// production resolver would never emit.
const cleared = (value: number | null | undefined) =>
  resolveFactorConfidenceDisplay({ confidence: value }, true)
/** What PRODUCTION emits today for ANY value: the ruled policy hides it. */
const ruledOut = (value: number) => resolveFactorConfidenceDisplay({ confidence: value })

describe('buildDisconfirmationCard', () => {
  const base = {
    winnerLabel: 'Option A',
    alternativeLabel: 'Option B',
    topDriverLabel: 'Customer churn',
  }

  it('emits the approved question with winner + alternative interpolated', () => {
    const card = buildDisconfirmationCard({ ...base, topDriverConfidence: cleared(0.8) })
    expect(card.question).toBe(
      'What would have to change for Option B to become more likely than Option A to hit your goal?',
    )
  })

  it('chip label is "Explore this challenge"', () => {
    const card = buildDisconfirmationCard({ ...base, topDriverConfidence: cleared(0.8) })
    expect(card.chipLabel).toBe('Explore this challenge')
  })

  it('emits context line ONLY when a CLEARED confidence is < 0.5', () => {
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: cleared(0.49) }).context).toBe(
      'The analysis depends on Customer churn, which has limited evidence.',
    )
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: cleared(0.5) }).context).toBeUndefined()
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: cleared(0.8) }).context).toBeUndefined()
  })

  it('suppresses context line when confidence is missing / NaN / non-finite', () => {
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: cleared(null) }).context).toBeUndefined()
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: cleared(undefined) }).context).toBeUndefined()
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: cleared(Number.NaN) }).context).toBeUndefined()
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: cleared(Number.POSITIVE_INFINITY) }).context).toBeUndefined()
  })

  // ── F5a ────────────────────────────────────────────────────────────────
  // The finding: `factor_sensitivity[].confidence` is `0.25` with
  // `sampling_stability: 0` in both real staging captures. `0.25 < 0.5`, so
  // this card asserted "which has limited evidence" about a number nobody
  // measured — on every analysis. The two tests above deliberately open the
  // policy seam to prove the branch still works; this one is what the product
  // actually does.
  it('F5a: makes NO evidence claim from a confidence the ruled policy hides', () => {
    expect(DISPLAY_SAFE_DRIVER_CONFIDENCE).toBe(false)

    const card = buildDisconfirmationCard({ ...base, topDriverConfidence: ruledOut(0.25) })

    // NON-VACUOUS: the card itself is still built and still asks its question —
    // only the unfounded evidence sentence is gone.
    expect(card.question).toContain('Option A')
    expect(card.chipLabel).toBe('Explore this challenge')
    expect(card.context).toBeUndefined()

    // POSITIVE CONTROL: same value, same builder, policy open ⇒ it fires. So
    // the absence above is caused by the gate, not by the fixture.
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: cleared(0.25) }).context)
      .toBe('The analysis depends on Customer churn, which has limited evidence.')
  })
})

describe('buildOutsideViewCard', () => {
  it('emits the approved question with winner + alternative interpolated', () => {
    const card = buildOutsideViewCard({ winnerLabel: 'Option A', alternativeLabel: 'Option B' })
    expect(card.question).toBe(
      'For decisions like this, does Option A usually outperform Option B?',
    )
  })

  it('always emits the static context line', () => {
    const card = buildOutsideViewCard({ winnerLabel: 'X', alternativeLabel: 'Y' })
    expect(card.context).toBe(
      'Outside views often catch assumptions you have stopped questioning.',
    )
  })

  it('chip label is "Research this"', () => {
    const card = buildOutsideViewCard({ winnerLabel: 'X', alternativeLabel: 'Y' })
    expect(card.chipLabel).toBe('Research this')
  })
})

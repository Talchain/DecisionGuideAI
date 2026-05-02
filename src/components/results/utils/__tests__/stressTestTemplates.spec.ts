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

describe('buildDisconfirmationCard', () => {
  const base = {
    winnerLabel: 'Option A',
    alternativeLabel: 'Option B',
    topDriverLabel: 'Customer churn',
  }

  it('emits the approved question with winner + alternative interpolated', () => {
    const card = buildDisconfirmationCard({ ...base, topDriverConfidence: 0.8 })
    expect(card.question).toBe(
      'What could make you switch your recommendation from Option A to Option B?',
    )
  })

  it('chip label is "Explore this challenge"', () => {
    const card = buildDisconfirmationCard({ ...base, topDriverConfidence: 0.8 })
    expect(card.chipLabel).toBe('Explore this challenge')
  })

  it('emits context line ONLY when topDriverConfidence < 0.5', () => {
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: 0.49 }).context).toBe(
      'The analysis depends on Customer churn, which has limited evidence.',
    )
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: 0.5 }).context).toBeUndefined()
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: 0.8 }).context).toBeUndefined()
  })

  it('suppresses context line when confidence is missing / NaN / non-finite', () => {
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: null }).context).toBeUndefined()
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: undefined }).context).toBeUndefined()
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: Number.NaN }).context).toBeUndefined()
    expect(buildDisconfirmationCard({ ...base, topDriverConfidence: Number.POSITIVE_INFINITY }).context).toBeUndefined()
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

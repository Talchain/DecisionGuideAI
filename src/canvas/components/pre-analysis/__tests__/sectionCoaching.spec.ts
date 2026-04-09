import { describe, it, expect } from 'vitest'
import {
  getReviewNextCoachingLine,
  getImproveConfidenceCoachingLine,
  isRedundantWithStartHere,
  resolveReviewNextCoachingLine,
} from '../sectionCoaching'
import type { ReviewNextSignal } from '../pickStartHere'
import type { TriageCardItem } from '../mapImprovementToTriageCard'

function triageCard(overrides: Partial<TriageCardItem> = {}): TriageCardItem {
  return {
    key: 't1',
    title: 'Factor A',
    detail: 'Detail',
    subtitle: undefined,
    category: 'verify',
    influence: 0.45,
    action: undefined,
    sourcePill: null,
    ...overrides,
  }
}

function triage(score: number, title = 'Factor A', defaulted = false): ReviewNextSignal {
  return {
    kind: 'triage',
    id: 'triage:t1',
    score,
    defaultedScore: defaulted,
    focusId: 'fac_a',
    card: triageCard({ title }),
  }
}

describe('getReviewNextCoachingLine', () => {
  it('renders triage coaching with a percentage', () => {
    expect(getReviewNextCoachingLine(triage(0.45)))
      .toBe("Factor A drives 45% of the result and hasn't been validated.")
  })

  it('returns null for defaulted triage scores (P1-3 guard)', () => {
    expect(getReviewNextCoachingLine(triage(0.5, 'Factor A', true))).toBeNull()
  })

  it('returns null for zero-percent triage scores', () => {
    expect(getReviewNextCoachingLine(triage(0))).toBeNull()
  })

  it('renders the overlap line for option_quality with intervention overlap', () => {
    const signal: ReviewNextSignal = {
      kind: 'option_quality',
      id: 'option_quality',
      score: 0.9,
      defaultedScore: false,
      optionLabels: ['Option 1'],
      hasInterventionOverlap: true,
    }
    expect(getReviewNextCoachingLine(signal)).toBe('Your options work through similar factors.')
  })

  it('returns null for option_quality without overlap (few_options variant)', () => {
    const signal: ReviewNextSignal = {
      kind: 'option_quality',
      id: 'option_quality',
      score: 0.7,
      defaultedScore: false,
      optionLabels: ['Option 1'],
      hasInterventionOverlap: false,
    }
    expect(getReviewNextCoachingLine(signal)).toBeNull()
  })

  it('renders bias coaching lowercasing the type', () => {
    const signal: ReviewNextSignal = {
      kind: 'bias',
      id: 'bias:narrow',
      score: 0.85,
      defaultedScore: false,
      biasType: 'Narrow Framing',
    }
    expect(getReviewNextCoachingLine(signal)).toBe('Watch for narrow framing when reviewing the items below.')
  })

  it('returns null for a null signal', () => {
    expect(getReviewNextCoachingLine(null)).toBeNull()
  })
})

describe('getImproveConfidenceCoachingLine', () => {
  it('pluralises correctly', () => {
    expect(getImproveConfidenceCoachingLine(1)).toBe('1 item could strengthen confidence.')
    expect(getImproveConfidenceCoachingLine(3)).toBe('3 items could strengthen confidence.')
  })

  it('returns null when count is zero', () => {
    expect(getImproveConfidenceCoachingLine(0)).toBeNull()
  })
})

describe('isRedundantWithStartHere', () => {
  it('flags exact title match as redundant', () => {
    const signal = triage(0.45)
    expect(isRedundantWithStartHere('Factor A', signal)).toBe(true)
  })

  it('flags substring overlap as redundant', () => {
    const signal = triage(0.45, 'Direct Delivery Capacity')
    // The triage line will contain "Direct Delivery Capacity drives..." which
    // includes the title as a substring — redundant.
    expect(isRedundantWithStartHere(
      'Direct Delivery Capacity drives 45% of the result',
      signal,
    )).toBe(true)
  })

  it('returns false when no Start here', () => {
    expect(isRedundantWithStartHere('Some coaching line', null)).toBe(false)
  })

  it('returns false when lines are unrelated', () => {
    const signal = triage(0.45, 'Factor A')
    expect(isRedundantWithStartHere('Your options work through similar factors.', signal)).toBe(false)
  })
})

describe('resolveReviewNextCoachingLine end-to-end', () => {
  it('suppresses when triage title is contained in the coaching line', () => {
    // Triage signal always yields "{title} drives..." which contains the title
    // as a substring → should be suppressed to avoid duplication with the
    // Start here card title.
    const signal = triage(0.45, 'Factor A')
    expect(resolveReviewNextCoachingLine(signal)).toBeNull()
  })

  it('returns null for defaulted triage (before suppression check)', () => {
    const signal = triage(0.5, 'Factor A', true)
    expect(resolveReviewNextCoachingLine(signal)).toBeNull()
  })

  it('returns null when startHere is null', () => {
    expect(resolveReviewNextCoachingLine(null)).toBeNull()
  })
})

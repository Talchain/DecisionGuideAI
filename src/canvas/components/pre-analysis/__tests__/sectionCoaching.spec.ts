import { describe, it, expect } from 'vitest'
import {
  getReviewNextCoachingLine,
  getImproveConfidenceCoachingLine,
  isRedundantWithStartHere,
  resolveReviewNextCoachingLine,
} from '../sectionCoaching'
import type { ReviewNextSignal } from '../pickStartHere'
import type { TriageCardItem } from '../mapImprovementToTriageCard'
import { resolveAnalysisMetric } from '@/components/results/driverDisplayModel'

function triageCard(overrides: Partial<TriageCardItem> = {}): TriageCardItem {
  return {
    key: 't1',
    title: 'Factor A',
    detail: 'Detail',
    subtitle: undefined,
    category: 'verify',
    analysisMetric: resolveAnalysisMetric({
      value: 0.45,
      basis: 'pre_analysis_influence',
    }),
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
    card: triageCard({
      title,
      analysisMetric: resolveAnalysisMetric({
        value: score,
        basis: 'pre_analysis_influence',
      }),
    }),
  }
}

describe('getReviewNextCoachingLine', () => {
  it('renders triage coaching with a percentage', () => {
    expect(getReviewNextCoachingLine(triage(0.45)))
      .toBe("Factor A has a pre-analysis influence score of 45% and hasn't been validated.")
  })

  it('returns null for defaulted triage scores (P1-3 guard)', () => {
    expect(getReviewNextCoachingLine(triage(0.5, 'Factor A', true))).toBeNull()
  })

  it('preserves an explicitly attested zero-percent triage score', () => {
    expect(getReviewNextCoachingLine(triage(0)))
      .toBe("Factor A has a pre-analysis influence score of 0% and hasn't been validated.")
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
    // The triage line includes the title as a substring, so it is redundant.
    expect(isRedundantWithStartHere(
      'Direct Delivery Capacity has a pre-analysis influence score of 45%',
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
    // Triage signal always yields a sentence beginning with the title, so it
    // should be suppressed to avoid duplication with the
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

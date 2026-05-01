import { describe, it, expect } from 'vitest'
import {
  pickStartHere,
  BIAS_SEVERITY_SCORE,
  OPTION_QUALITY_SEVERITY,
  type ReviewNextSignal,
  type TriageSignal,
  type BiasSignal,
  type OptionQualitySignal,
} from '../pickStartHere'
import type { TriageCardItem } from '../mapImprovementToTriageCard'

function triageCard(overrides: Partial<TriageCardItem> = {}): TriageCardItem {
  return {
    key: 't1',
    title: 'Factor A',
    detail: 'Detail',
    subtitle: undefined,
    category: 'verify',
    influence: null,
    action: undefined,
    sourcePill: null,
    ...overrides,
  }
}

function triage(score: number, label = 'Factor A', focusId = 'fac_a', defaulted = false): TriageSignal {
  return {
    kind: 'triage',
    id: `triage_${focusId}`,
    score,
    defaultedScore: defaulted,
    focusId,
    card: triageCard({ key: `t_${focusId}`, title: label }),
  }
}

function bias(severity: keyof typeof BIAS_SEVERITY_SCORE, biasType = 'confirmation'): BiasSignal {
  return {
    kind: 'bias',
    id: `bias_${biasType}`,
    score: BIAS_SEVERITY_SCORE[severity],
    defaultedScore: false,
    biasType,
  }
}

function optionQuality(overlap = false, labels = ['Option 1']): OptionQualitySignal {
  return {
    kind: 'option_quality',
    id: 'option_quality',
    score: overlap
      ? OPTION_QUALITY_SEVERITY.intervention_overlap
      : OPTION_QUALITY_SEVERITY.few_options,
    defaultedScore: false,
    optionLabels: labels,
    hasInterventionOverlap: overlap,
  }
}

describe('pickStartHere', () => {
  it('returns null when signals are empty', () => {
    expect(pickStartHere([], {})).toBeNull()
  })

  // UI-BUG-9: hasMustFix guard was removed — Start here renders in review-tier
  // regardless of Must fix state. Must fix and review-tier are separate sections.
  it('returns a signal even when must-fix items would exist (UI-BUG-9)', () => {
    const signals: ReviewNextSignal[] = [triage(0.9)]
    expect(pickStartHere(signals, {})).not.toBeNull()
  })

  it('CEE dominantFactorId overrides score ranking', () => {
    const signals: ReviewNextSignal[] = [
      triage(0.2, 'Dominant', 'fac_dominant'),
      triage(0.9, 'High', 'fac_high'),
    ]
    const pick = pickStartHere(signals, { dominantFactorId: 'fac_dominant' })
    expect(pick?.kind).toBe('triage')
    expect((pick as TriageSignal).focusId).toBe('fac_dominant')
  })

  it('dominantFactorId is ignored when no matching signal present', () => {
    const signals: ReviewNextSignal[] = [triage(0.9, 'High', 'fac_high')]
    const pick = pickStartHere(signals, { dominantFactorId: 'fac_missing' })
    expect((pick as TriageSignal).focusId).toBe('fac_high')
  })

  it('picks the highest scored signal across mixed kinds (triage > bias > option)', () => {
    const signals: ReviewNextSignal[] = [
      bias('medium'),             // 0.65
      optionQuality(true),        // 0.9
      triage(0.95, 'Very high'),  // 0.95 — should win
    ]
    const pick = pickStartHere(signals, {})
    expect(pick?.kind).toBe('triage')
  })

  it('bias wins when triage score is low', () => {
    const signals: ReviewNextSignal[] = [
      triage(0.1, 'Low influence'),
      bias('high'),  // 0.85
    ]
    const pick = pickStartHere(signals, {})
    expect(pick?.kind).toBe('bias')
    expect((pick as BiasSignal).biasType).toBe('confirmation')
  })

  it('option_quality signals are excluded — bias wins over low triage', () => {
    const signals: ReviewNextSignal[] = [
      triage(0.1, 'Minor'),
      bias('low'),              // 0.45
      optionQuality(true),      // 0.9 — excluded from Start here candidacy
    ]
    const pick = pickStartHere(signals, {})
    // option_quality excluded; bias (0.45) beats triage (0.1)
    expect(pick?.kind).toBe('bias')
  })

  it('returns null when only option_quality signals exist', () => {
    const signals: ReviewNextSignal[] = [optionQuality(true)]
    expect(pickStartHere(signals, {})).toBeNull()
  })

  it('tie-break is alphabetical by label', () => {
    const signals: ReviewNextSignal[] = [
      triage(0.8, 'Zebra', 'fac_z'),
      triage(0.8, 'Apple', 'fac_a'),
      triage(0.8, 'Mango', 'fac_m'),
    ]
    const pick = pickStartHere(signals, {})
    expect((pick as TriageSignal).card.title).toBe('Apple')
  })

  it('defaultedScore triage signals can still be picked when nothing else exists', () => {
    const signals: ReviewNextSignal[] = [triage(0.5, 'Default scored', 'fac_d', true)]
    const pick = pickStartHere(signals, {})
    expect(pick).not.toBeNull()
    expect((pick as TriageSignal).defaultedScore).toBe(true)
  })
})

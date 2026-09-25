/**
 * strengthBands.ts — unit tests
 *
 * Tests every band boundary value for strength, confidence, and existence bands.
 * Also covers all basis labels and contested reason labels.
 */

import { describe, it, expect } from 'vitest'
import {
  getStrengthBand,
  getDirectionalStrengthLabel,
  getConfidenceBand,
  getConfidenceLabel,
  getExistenceBand,
  getExistenceLabel,
  getBasisLabel,
  getContestedReasonLabel,
  getSignedMidpoint,
  STRENGTH_BAND_MIDPOINTS,
} from '../strengthBands'
import { directionFromProducerSignedMean } from '../../../domain/edgeValueProvenance'
import { CANVAS_STRENGTH_BANDS } from '../../../domain/vocabulary'
import type { EstimateBasis, ContestedReason } from '../../../domain/validation'

// ── Strength bands ─────────────────────────────────────────────────────────────

describe('getStrengthBand', () => {
  // A15: moderate/strong thresholds are READ from the canonical table
  // (domain/vocabulary.ts CANVAS_STRENGTH_BANDS: moderate ≥ 0.2, strong ≥
  // 0.4) — not re-typed here. weak ≥ 0.05, else negligible: unchanged,
  // no canonical counterpart (see the file's own note).
  it('classifies -1 as strong', () => expect(getStrengthBand(-1)).toBe('strong'))
  it('classifies -0.4 as strong', () => expect(getStrengthBand(-0.4)).toBe('strong'))
  it('classifies -0.399 as moderate', () => expect(getStrengthBand(-0.399)).toBe('moderate'))
  it('classifies -0.2 as moderate', () => expect(getStrengthBand(-0.2)).toBe('moderate'))
  it('classifies -0.199 as weak', () => expect(getStrengthBand(-0.199)).toBe('weak'))
  it('classifies -0.05 as weak', () => expect(getStrengthBand(-0.05)).toBe('weak'))
  it('classifies -0.049 as negligible', () => expect(getStrengthBand(-0.049)).toBe('negligible'))
  it('classifies 0 as negligible', () => expect(getStrengthBand(0)).toBe('negligible'))
  it('classifies 0.049 as negligible', () => expect(getStrengthBand(0.049)).toBe('negligible'))
  it('classifies 0.05 as weak', () => expect(getStrengthBand(0.05)).toBe('weak'))
  it('classifies 0.199 as weak', () => expect(getStrengthBand(0.199)).toBe('weak'))
  it('classifies 0.2 as moderate', () => expect(getStrengthBand(0.2)).toBe('moderate'))
  it('classifies 0.399 as moderate', () => expect(getStrengthBand(0.399)).toBe('moderate'))
  it('classifies 0.4 as strong', () => expect(getStrengthBand(0.4)).toBe('strong'))
  it('classifies 1 as strong', () => expect(getStrengthBand(1)).toBe('strong'))

  // ⭐ THE EXACT AUDIT REPRODUCTION (A15): -0.5 read "Strong" in the inspector
  // (canonical `strong` starts at 0.4) and "Moderate" here (old threshold
  // 0.6). Bound to the SAME predicate the inspector's own band table would
  // answer for this magnitude — not a re-typed number.
  it('A15: classifies 0.5 the same way the canonical inspector table does — strong, not moderate', () => {
    expect(getStrengthBand(-0.5)).toBe('strong')
    expect(getStrengthBand(0.5)).toBe('strong')
  })
})

/**
 * ROADMAP 2.263 — `getDirectionalStrengthLabel` no longer infers a direction from the sign
 * of its own argument; the direction is a REQUIRED second parameter. These
 * cases are about BAND BOUNDARIES, so they supply a direction from an explicit
 * named source and the expected strings are unchanged. The honesty behaviour
 * (unstated direction ⇒ no direction word) is covered in
 * `edgeDirectionHonesty.spec.tsx`.
 */
const dir = (mean: number) => directionFromProducerSignedMean(mean)

describe('getDirectionalStrengthLabel', () => {
  it('returns "Strong positive effect" for +0.8', () =>
    expect(getDirectionalStrengthLabel(0.8, dir(0.8))).toBe('Strong positive effect'))
  it('returns "Strong negative effect" for -0.8', () =>
    expect(getDirectionalStrengthLabel(-0.8, dir(-0.8))).toBe('Strong negative effect'))
  it('returns "Moderate positive effect" for +0.35', () =>
    expect(getDirectionalStrengthLabel(0.35, dir(0.35))).toBe('Moderate positive effect'))
  it('returns "Moderate negative effect" for -0.35', () =>
    expect(getDirectionalStrengthLabel(-0.35, dir(-0.35))).toBe('Moderate negative effect'))
  it('returns "Weak positive effect" for +0.1', () =>
    expect(getDirectionalStrengthLabel(0.1, dir(0.1))).toBe('Weak positive effect'))
  it('returns "Weak negative effect" for -0.1', () =>
    expect(getDirectionalStrengthLabel(-0.1, dir(-0.1))).toBe('Weak negative effect'))
  it('returns "Negligible effect" for 0', () =>
    expect(getDirectionalStrengthLabel(0, dir(0))).toBe('Negligible effect'))
  it('returns "Negligible effect" for -0.01 (no direction qualifier)', () =>
    expect(getDirectionalStrengthLabel(-0.01, dir(-0.01))).toBe('Negligible effect'))
  it('returns "Strong positive effect" at exact boundary 0.6', () =>
    expect(getDirectionalStrengthLabel(0.6, dir(0.6))).toBe('Strong positive effect'))
  // A15: the strong/moderate boundary is READ from the canonical table (0.4).
  it('returns "Strong positive effect" at the canonical boundary 0.4', () =>
    expect(getDirectionalStrengthLabel(0.4, dir(0.4))).toBe('Strong positive effect'))
  it('returns "Moderate positive effect" at exact boundary 0.25', () =>
    expect(getDirectionalStrengthLabel(0.25, dir(0.25))).toBe('Moderate positive effect'))
  // A15: the moderate/weak boundary is READ from the canonical table (0.2).
  it('returns "Moderate positive effect" at the canonical boundary 0.2', () =>
    expect(getDirectionalStrengthLabel(0.2, dir(0.2))).toBe('Moderate positive effect'))
  it('returns "Weak positive effect" at exact boundary 0.05', () =>
    expect(getDirectionalStrengthLabel(0.05, dir(0.05))).toBe('Weak positive effect'))
})

// ── Confidence bands ───────────────────────────────────────────────────────────

describe('getConfidenceBand', () => {
  // Thresholds: high < 0.10, moderate < 0.20, else low
  it('classifies std=0 as high', () => expect(getConfidenceBand(0)).toBe('high'))
  it('classifies std=0.09 as high', () => expect(getConfidenceBand(0.09)).toBe('high'))
  it('classifies std=0.10 as moderate', () => expect(getConfidenceBand(0.10)).toBe('moderate'))
  it('classifies std=0.19 as moderate', () => expect(getConfidenceBand(0.19)).toBe('moderate'))
  it('classifies std=0.20 as low', () => expect(getConfidenceBand(0.20)).toBe('low'))
  it('classifies std=0.5 as low', () => expect(getConfidenceBand(0.5)).toBe('low'))
})

describe('getConfidenceLabel', () => {
  it('returns "High confidence" for std=0.05', () =>
    expect(getConfidenceLabel(0.05)).toBe('High confidence'))
  it('returns "Moderate confidence" for std=0.15', () =>
    expect(getConfidenceLabel(0.15)).toBe('Moderate confidence'))
  it('returns "Low confidence" for std=0.25', () =>
    expect(getConfidenceLabel(0.25)).toBe('Low confidence'))
})

// ── Existence bands ────────────────────────────────────────────────────────────

describe('getExistenceBand', () => {
  // Thresholds: near-certain ≥ 0.9, likely ≥ 0.7, uncertain ≥ 0.5, else speculative
  it('classifies ep=0.9 as near-certain', () => expect(getExistenceBand(0.9)).toBe('near-certain'))
  it('classifies ep=1.0 as near-certain', () => expect(getExistenceBand(1.0)).toBe('near-certain'))
  it('classifies ep=0.89 as likely', () => expect(getExistenceBand(0.89)).toBe('likely'))
  it('classifies ep=0.7 as likely', () => expect(getExistenceBand(0.7)).toBe('likely'))
  it('classifies ep=0.69 as uncertain', () => expect(getExistenceBand(0.69)).toBe('uncertain'))
  it('classifies ep=0.5 as uncertain', () => expect(getExistenceBand(0.5)).toBe('uncertain'))
  it('classifies ep=0.49 as speculative', () => expect(getExistenceBand(0.49)).toBe('speculative'))
  it('classifies ep=0 as speculative', () => expect(getExistenceBand(0)).toBe('speculative'))
})

describe('getExistenceLabel', () => {
  it('returns "Very likely to exist" for ep=0.95', () =>
    expect(getExistenceLabel(0.95)).toBe('Very likely to exist'))
  it('returns "Likely to exist" for ep=0.75', () =>
    expect(getExistenceLabel(0.75)).toBe('Likely to exist'))
  it('returns "May or may not exist" for ep=0.6', () =>
    expect(getExistenceLabel(0.6)).toBe('May or may not exist'))
  it('returns "Speculative" for ep=0.3', () =>
    expect(getExistenceLabel(0.3)).toBe('Speculative'))
})

// ── Basis labels ───────────────────────────────────────────────────────────────

describe('getBasisLabel', () => {
  const cases: Array<[EstimateBasis, string]> = [
    ['brief_explicit', 'Based on your brief'],
    ['structural_inference', 'Inferred from model structure'],
    ['domain_prior', 'Based on general domain knowledge'],
    ['weak_guess', 'Uncertain — your input would help'],
  ]
  it.each(cases)('maps %s correctly', (basis, expected) => {
    expect(getBasisLabel(basis)).toBe(expected)
  })
})

// ── Contested reason labels ────────────────────────────────────────────────────

describe('getContestedReasonLabel', () => {
  const cases: Array<[ContestedReason, string]> = [
    ['sign_flip', 'Our reviews disagree on whether this effect is positive or negative'],
    ['strength_band_change', 'Our reviews disagree on how strong this effect is'],
    ['confidence_band_change', 'Our reviews disagree on how confident we should be'],
    ['existence_boundary_crossing', 'Our reviews disagree on whether this relationship is reliable'],
    ['raw_magnitude', 'Our reviews give meaningfully different estimates'],
  ]
  it.each(cases)('maps %s correctly', (reason, expected) => {
    expect(getContestedReasonLabel(reason)).toBe(expected)
  })
})

// ── Quick-set band midpoints ───────────────────────────────────────────────────

describe('STRENGTH_BAND_MIDPOINTS', () => {
  it('puts each midpoint inside its band range', () => {
    expect(getStrengthBand(STRENGTH_BAND_MIDPOINTS.weak)).toBe('weak')
    expect(getStrengthBand(STRENGTH_BAND_MIDPOINTS.moderate)).toBe('moderate')
    expect(getStrengthBand(STRENGTH_BAND_MIDPOINTS.strong)).toBe('strong')
  })

  it('orders weak < moderate < strong', () => {
    expect(STRENGTH_BAND_MIDPOINTS.weak).toBeLessThan(STRENGTH_BAND_MIDPOINTS.moderate)
    expect(STRENGTH_BAND_MIDPOINTS.moderate).toBeLessThan(STRENGTH_BAND_MIDPOINTS.strong)
  })

  // ⭐⭐ A15 — THE ONE-TABLE ASSERTION. Before this fix, clicking "Moderate"
  // here wrote 0.40 while the inspector's own "Moderate" quick-set pill
  // (`StrengthBandButtons`, reading `CANVAS_STRENGTH_BANDS` directly) wrote
  // 0.30 — same word, two different numbers sent to the model. These
  // compare against the canonical table LIVE, so a future edit to either
  // side that lets them diverge again fails here, not in production.
  it('A15: moderate and strong midpoints equal the canonical table, verbatim', () => {
    const canonicalModerate = CANVAS_STRENGTH_BANDS.find(b => b.id === 'moderate')!
    const canonicalStrong = CANVAS_STRENGTH_BANDS.find(b => b.id === 'strong')!
    expect(STRENGTH_BAND_MIDPOINTS.moderate).toBe(canonicalModerate.midpoint)
    expect(STRENGTH_BAND_MIDPOINTS.strong).toBe(canonicalStrong.midpoint)
    expect(STRENGTH_BAND_MIDPOINTS.moderate).toBe(0.30)
    expect(STRENGTH_BAND_MIDPOINTS.strong).toBe(0.55)
  })
})

describe('getSignedMidpoint', () => {
  it('returns positive midpoint for positive direction', () => {
    expect(getSignedMidpoint('weak', 'positive')).toBe(STRENGTH_BAND_MIDPOINTS.weak)
    expect(getSignedMidpoint('moderate', 'positive')).toBe(STRENGTH_BAND_MIDPOINTS.moderate)
    expect(getSignedMidpoint('strong', 'positive')).toBe(STRENGTH_BAND_MIDPOINTS.strong)
  })

  it('returns negated midpoint for negative direction', () => {
    expect(getSignedMidpoint('weak', 'negative')).toBe(-STRENGTH_BAND_MIDPOINTS.weak)
    expect(getSignedMidpoint('moderate', 'negative')).toBe(-STRENGTH_BAND_MIDPOINTS.moderate)
    expect(getSignedMidpoint('strong', 'negative')).toBe(-STRENGTH_BAND_MIDPOINTS.strong)
  })

  it('preserves sign across all three bands when negated', () => {
    expect(Math.sign(getSignedMidpoint('weak', 'negative'))).toBe(-1)
    expect(Math.sign(getSignedMidpoint('strong', 'negative'))).toBe(-1)
  })
})

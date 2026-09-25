/**
 * A22 (AUDIT-SYNTH 20260925) — the Analysis tab must render a factor's carried
 * `display_value`, not re-band the raw 0–1 value with its own qualitative
 * thresholds. Measured: New Logos showed Usage-Based Pricing Exposure "to low"
 * where the canvas read "Moderate (0.3)" for the same value — two independent
 * threshold sets (`formatValueWithUnit.ts`'s `qualitativeLabel`, and this
 * file's `toQualitativeLevel`) disagreeing with the producer's own words and
 * with each other.
 *
 * `formatObservedStateDetail` had THREE call sites that fell straight to
 * `toQualitativeLevel(rawNum)` for a unitless 0–1 value without ever looking
 * at `os.display_value` — the producer's own reading of the SAME number. This
 * pins that the carried reading wins wherever it exists, and that the
 * qualitative band word survives as the honest fallback when it does not.
 */
import { describe, it, expect } from 'vitest'
import { formatObservedStateDetail, toQualitativeLevel } from '../hooks/usePreAnalysisData'
import type { ObservedStateData } from '../../../utils/observedStateHelpers'

const os = (overrides: Partial<ObservedStateData>): ObservedStateData => ({
  value: null,
  raw_value: null,
  display_value: null,
  unit: null,
  cap: null,
  source: null,
  ...overrides,
} as ObservedStateData)

describe('formatObservedStateDetail — carried display_value over a re-banded raw value', () => {
  it('a qualitative raw_value with a carried display_value renders the carried string, not the re-banded word', () => {
    // The exact shape the audit measured: a 0–1 value with no unit/cap that
    // WOULD band to "moderate", but the producer already said "Moderate (0.3)".
    const result = formatObservedStateDetail(os({ raw_value: 0.3, display_value: 'Moderate (0.3)' }))
    expect(result).toBe('Moderate (0.3)')
    expect(result).not.toBe(toQualitativeLevel(0.3))
  })

  it('a qualitative bare value (no raw_value) with a carried display_value renders the carried string', () => {
    const result = formatObservedStateDetail(os({ value: 0.3, display_value: 'Moderate (0.3)' }))
    expect(result).toBe('Moderate (0.3)')
  })

  it('an encoding_map-style carried phrase wins over the magnitude band too', () => {
    const result = formatObservedStateDetail(os({ raw_value: 0, display_value: 'No AEs added' }))
    expect(result).toBe('No AEs added')
    expect(result).not.toBe('very low')
  })

  it('CONTRAST: with no carried display_value, the qualitative band word survives as the honest fallback', () => {
    expect(formatObservedStateDetail(os({ raw_value: 0.3 }))).toBe(toQualitativeLevel(0.3))
    expect(formatObservedStateDetail(os({ value: 0.3 }))).toBe(toQualitativeLevel(0.3))
  })

  it('CONTRAST: a real unit + fresh raw_value still outranks a carried display_value (stale-value protection, unchanged)', () => {
    // Not a qualitative factor at all — this path never reaches toQualitativeLevel
    // and must not start preferring display_value over a real anchored figure.
    const result = formatObservedStateDetail(os({ raw_value: 49, unit: '£', display_value: '£999 (stale)' }))
    expect(result).toBe('£49')
  })
})

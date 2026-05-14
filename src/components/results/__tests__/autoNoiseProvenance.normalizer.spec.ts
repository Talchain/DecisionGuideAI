/**
 * Unit tests for `normalizeAutoNoiseProvenance` (audit B3, P0).
 *
 * The normaliser is the trust boundary between PLoT's snake_case payload
 * and the UI's camelCase shape. Malformed input returns null — never
 * partial fills, never throws — so a bad payload simply hides the marker
 * (graceful degradation) without crashing the trust panel.
 */

import { describe, it, expect } from 'vitest'
import { normalizeAutoNoiseProvenance } from '../types'

const validRaw = {
  applied: true,
  effect: 'widens_outcome_and_risk_uncertainty',
  formula_version: 'plot_auto_v1',
  multiplier: 1.0,
  noise_distribution: 'normal_zero_mean_outcome_std',
  filter_scope: 'outcome_and_risk_nodes',
  is_provisional: true,
  calibration_status: 'provisional_pending_pilot_calibration',
}

describe('normalizeAutoNoiseProvenance', () => {
  it('camelCases a well-formed payload with applied=true', () => {
    expect(normalizeAutoNoiseProvenance(validRaw)).toEqual({
      applied: true,
      effect: 'widens_outcome_and_risk_uncertainty',
      formulaVersion: 'plot_auto_v1',
      multiplier: 1.0,
      noiseDistribution: 'normal_zero_mean_outcome_std',
      filterScope: 'outcome_and_risk_nodes',
      isProvisional: true,
      calibrationStatus: 'provisional_pending_pilot_calibration',
    })
  })

  it('camelCases a well-formed payload with applied=false (full metadata preserved)', () => {
    const result = normalizeAutoNoiseProvenance({ ...validRaw, applied: false })
    expect(result).not.toBeNull()
    expect(result!.applied).toBe(false)
    // Full formula provenance is preserved on applied=false — see brief.
    expect(result!.multiplier).toBe(1.0)
    expect(result!.formulaVersion).toBe('plot_auto_v1')
    expect(result!.calibrationStatus).toBe('provisional_pending_pilot_calibration')
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['array', [validRaw]],
    ['number', 42],
    ['string', 'oops'],
  ])('returns null for non-object input: %s', (_label, input) => {
    expect(normalizeAutoNoiseProvenance(input)).toBeNull()
  })

  it('returns null for malformed boolean fields', () => {
    expect(normalizeAutoNoiseProvenance({ ...validRaw, applied: 'true' })).toBeNull()
    expect(normalizeAutoNoiseProvenance({ ...validRaw, is_provisional: 1 })).toBeNull()
  })

  it('returns null for malformed numeric multiplier', () => {
    expect(normalizeAutoNoiseProvenance({ ...validRaw, multiplier: '1.0' })).toBeNull()
    expect(normalizeAutoNoiseProvenance({ ...validRaw, multiplier: NaN })).toBeNull()
    expect(normalizeAutoNoiseProvenance({ ...validRaw, multiplier: Infinity })).toBeNull()
  })

  it('returns null when any required string field is missing or empty', () => {
    for (const key of [
      'effect',
      'formula_version',
      'noise_distribution',
      'filter_scope',
      'calibration_status',
    ] as const) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _omit, ...rest } = validRaw
      expect(normalizeAutoNoiseProvenance(rest)).toBeNull()
      expect(normalizeAutoNoiseProvenance({ ...validRaw, [key]: '' })).toBeNull()
      expect(normalizeAutoNoiseProvenance({ ...validRaw, [key]: 42 })).toBeNull()
    }
  })

  it('forward-compat: unknown enum values pass through (string-typed UI side)', () => {
    // Mirrors the A1 pattern (commit e46f305f) of relaxing UI enum types
    // to `string` so a future calibrated PLoT build does not crash old UI.
    const future = { ...validRaw, formula_version: 'plot_auto_v2', calibration_status: 'calibrated_pilot_v1' }
    const result = normalizeAutoNoiseProvenance(future)
    expect(result).not.toBeNull()
    expect(result!.formulaVersion).toBe('plot_auto_v2')
    expect(result!.calibrationStatus).toBe('calibrated_pilot_v1')
  })
})

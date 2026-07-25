/**
 * buildMethodCard — the Model-Card-Lite honesty mechanism (P1-9).
 *
 * Driven by TWO REAL captured staging responses, deliberately chosen because
 * they DISAGREE about what the producer reported:
 *
 *   · golden-path-staging-2026-04-05 — carries NO `confidence_provenance`
 *     and NO `auto_noise_provenance` (the absence case)
 *   · olumi-debug-50b336a6-20260510  — carries a fully populated
 *     `confidence_provenance` (the POSITIVE CONTROL)
 *
 * The positive control matters: without it, every "reports it as unknown"
 * assertion below would pass against a function that returned unknown for
 * everything, always. The 05-10 capture proves this module can SEE a
 * presence, which is what makes the 04-05 absence assertions mean anything.
 */
import { describe, it, expect } from 'vitest'

import { buildMethodCard } from '../buildMethodCard'
import goldenPath from '../../../../test/fixtures/golden-path-staging-2026-04-05.json'
import debugBundle from '../../../debug/__tests__/fixtures/staging-bundles/olumi-debug-50b336a6-20260510.pre-fix.json'

const CAPTURE_0405 = (goldenPath as { plot_response: unknown }).plot_response
const CAPTURE_0510 = (debugBundle as { payloads: { plot_response: unknown } }).payloads.plot_response

describe('buildMethodCard — real capture, 2026-04-05 (no confidence provenance)', () => {
  const model = buildMethodCard(CAPTURE_0405)

  it('reports the sample count the producer actually sent', () => {
    expect(model.nSamples).toEqual({ known: true, value: 1000 })
  })

  it('reports the seed the producer actually sent', () => {
    expect(model.seed).toEqual({ known: true, value: '485977' })
  })

  it("reports the producer's own EVPI method verbatim — heuristic stays heuristic", () => {
    // Never dressed up. If this ever renders as anything but the producer's
    // own word, the card is overstating the method.
    expect(model.evpiMethod).toEqual({ known: true, value: 'heuristic' })
  })

  it('reports confidence calibration as UNKNOWN when no factor carries confidence_provenance', () => {
    // ⛔ The load-bearing assertion. This capture has confidence values but no
    // provenance for them. Unknown must NOT collapse to "calibrated".
    expect(model.confidenceCalibration.known).toBe(false)
  })

  it('reports the robustness bands as provisional, per the producer stamp', () => {
    expect(model.stabilityThresholds).toEqual({
      known: true,
      value: { isProvisional: true, version: 'v1.0-operational-defaults' },
    })
  })

  it('reports the auto-noise adjustment as UNKNOWN when the producer sent no provenance', () => {
    // Absence of the provenance object must not be read as "no adjustment was
    // applied" — that would be an absent-as-false fabrication.
    expect(model.autoNoiseApplied.known).toBe(false)
  })
})

describe('buildMethodCard — real capture, 2026-05-10 (POSITIVE CONTROL: provenance present)', () => {
  const model = buildMethodCard(CAPTURE_0510)

  it('SEES confidence provenance when the producer sends it', () => {
    // If this fails, every "known: false" assertion in the 04-05 block above
    // is vacuous — the function would simply never detect anything.
    expect(model.confidenceCalibration.known).toBe(true)
  })

  it('surfaces the producer provisional stamp rather than claiming calibration', () => {
    expect(model.confidenceCalibration).toEqual({
      known: true,
      value: { isProvisional: true, status: 'provisional_pending_pilot_calibration' },
    })
  })

  it('still reads sample count and seed from a different real run', () => {
    expect(model.nSamples).toEqual({ known: true, value: 1000 })
    expect(model.seed).toEqual({ known: true, value: '991555' })
  })
})

describe('buildMethodCard — fabrication guards', () => {
  it('reports EVERY fact as unknown for an empty response — no field is defaulted', () => {
    const model = buildMethodCard({})
    expect(Object.values(model).every((f) => f.known === false)).toBe(true)
  })

  it('reports every fact as unknown for null / a non-object', () => {
    for (const input of [null, undefined, 'nope', 42, []]) {
      const model = buildMethodCard(input)
      expect(Object.values(model).every((f) => f.known === false)).toBe(true)
    }
  })

  it('refuses a non-finite sample count rather than coercing it', () => {
    expect(buildMethodCard({ meta: { n_samples: NaN } }).nSamples.known).toBe(false)
    expect(buildMethodCard({ meta: { n_samples: Infinity } }).nSamples.known).toBe(false)
    expect(buildMethodCard({ meta: { n_samples: '1000' } }).nSamples.known).toBe(false)
  })

  it('refuses an empty seed rather than rendering a blank as a value', () => {
    expect(buildMethodCard({ meta: { seed_used: '' } }).seed.known).toBe(false)
    expect(buildMethodCard({ meta: { seed_used: '  ' } }).seed.known).toBe(false)
  })

  it('accepts a numeric seed (contract revisions differ) and stringifies it losslessly', () => {
    expect(buildMethodCard({ meta: { seed_used: 485977 } }).seed).toEqual({
      known: true,
      value: '485977',
    })
  })

  it('reports EVPI method as unknown when factors DISAGREE — never first-wins', () => {
    // A run whose factors were computed different ways has no single method.
    // Picking one would be a claim the response does not support.
    const model = buildMethodCard({
      factor_sensitivity: [{ evpi_method: 'heuristic' }, { evpi_method: 'exact' }],
    })
    expect(model.evpiMethod.known).toBe(false)
  })

  it('reports EVPI method when the reporting factors agree, ignoring silent factors', () => {
    const model = buildMethodCard({
      factor_sensitivity: [{ evpi_method: 'heuristic' }, {}, { evpi_method: 'heuristic' }],
    })
    expect(model.evpiMethod).toEqual({ known: true, value: 'heuristic' })
  })

  it('treats confidence as provisional when ANY factor is provisional', () => {
    // Conservative direction — matches the policy DriversSection already
    // ships (`drivers.some(d => d.confidenceProvenance?.isProvisional)`).
    const model = buildMethodCard({
      factor_sensitivity: [
        { confidence_provenance: { is_provisional: false, calibration_status: 'calibrated' } },
        { confidence_provenance: { is_provisional: true, calibration_status: 'provisional' } },
      ],
    })
    expect(model.confidenceCalibration).toEqual({
      known: true,
      value: { isProvisional: true, status: 'calibrated' },
    })
  })

  it('refuses a non-boolean stability provisional flag rather than coercing truthiness', () => {
    expect(buildMethodCard({ stability_thresholds: { provisional: 'true' } }).stabilityThresholds.known).toBe(false)
    expect(buildMethodCard({ stability_thresholds: {} }).stabilityThresholds.known).toBe(false)
  })
})

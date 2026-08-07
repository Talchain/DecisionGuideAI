/**
 * The shared factor-confidence display policy, anchored to REAL captured bytes.
 *
 * Both arms come from ONE real staging bundle, chosen because the two layers
 * inside it DISAGREE:
 *   · `payloads.plot_response.factor_sensitivity[]` — confidence 0.25,
 *     confidence_source 'plot_unified_from_isl_bootstrap',
 *     confidence_components.sampling_stability 0  → DEFAULTED
 *   · `payloads.isl_response.factor_sensitivity[]` — confidence 0.3756,
 *     confidence_source 'bootstrap_sampling'      → NOT defaulted
 *
 * That disagreement is the whole finding: the canvas was rendering PLoT's
 * defaulted 0.25 as a measurement while ISL's own computed 0.3756 sat in the
 * same file. No invented literals are used for either arm.
 *
 * POSITIVE CONTROL (trap 13): every "it is hidden" assertion is paired with the
 * same row resolved under `displaySafe: true`. Without that pairing the
 * resolver could return `{show:false}` unconditionally — for a missing field,
 * a typo'd fixture path, anything — and every hidden-assertion would pass while
 * testing nothing.
 */
import { describe, it, expect } from 'vitest'
import {
  DISPLAY_SAFE_DRIVER_CONFIDENCE,
  isDefaultedConfidenceFromRaw,
  resolveFactorConfidenceDisplay,
  resolveRawFactorConfidenceDisplay,
  factorConfidenceDisclosure,
} from '../driverConfidenceDisplayPolicy'
import bundle from '../../debug/__tests__/fixtures/staging-bundles/olumi-debug-50b336a6-20260510.pre-fix.json'

const plotRows = (bundle as any).payloads.plot_response.factor_sensitivity as Record<string, unknown>[]
const islRows = (bundle as any).payloads.isl_response.factor_sensitivity as Record<string, unknown>[]

describe('captured bytes — the fixture really does carry the disagreement', () => {
  // Guards every test below: if the bundle shape ever changes, these fail
  // LOUDLY rather than letting the suite pass against empty arrays.
  it('PLoT rows carry a defaulted 0.25', () => {
    expect(plotRows.length).toBeGreaterThan(0)
    expect(plotRows[0].confidence).toBe(0.25)
    expect(plotRows[0].confidence_source).toBe('plot_unified_from_isl_bootstrap')
    expect((plotRows[0].confidence_components as any).sampling_stability).toBe(0)
    expect((plotRows[0].confidence_provenance as any).is_provisional).toBe(true)
  })

  it('ISL rows in the SAME bundle carry a computed 0.3756', () => {
    expect(islRows.length).toBeGreaterThan(0)
    expect(islRows[0].confidence).toBe(0.3756)
    expect(islRows[0].confidence_source).toBe('bootstrap_sampling')
  })
})

describe('the ruled policy is unchanged by this lane', () => {
  it('DISPLAY_SAFE_DRIVER_CONFIDENCE is still false — no doctrine flip here', () => {
    expect(DISPLAY_SAFE_DRIVER_CONFIDENCE).toBe(false)
  })
})

describe('isDefaultedConfidenceFromRaw — discriminates on real bytes', () => {
  it('calls the PLoT row defaulted', () => {
    expect(isDefaultedConfidenceFromRaw({
      confidenceSource: plotRows[0].confidence_source as string,
      samplingStability: (plotRows[0].confidence_components as any).sampling_stability,
    })).toBe(true)
  })

  it('does NOT call the ISL row defaulted', () => {
    expect(isDefaultedConfidenceFromRaw({
      confidenceSource: islRows[0].confidence_source as string,
      samplingStability: undefined,
    })).toBe(false)
  })
})

describe('resolveRawFactorConfidenceDisplay — under the ruled policy, nothing shows', () => {
  it('hides the defaulted PLoT 0.25 as not-display-safe', () => {
    const out = resolveRawFactorConfidenceDisplay(plotRows[0])
    expect(out.show).toBe(false)
    expect(out).toEqual({ show: false, hiddenReason: 'no_display_safe_source' })
  })

  it('hides the ISL 0.3756 too — the ruled reason is the SOURCE, not the value', () => {
    // Important discrimination: this lane implements "no display-safe source
    // exists", the panel's actual ruling. It is NOT "hide only the defaulted
    // ones", which would leave un-disclosed numbers on the canvas that the
    // panel still refuses to print.
    const out = resolveRawFactorConfidenceDisplay(islRows[0])
    expect(out).toEqual({ show: false, hiddenReason: 'no_display_safe_source' })
  })

  it('reports an ABSENT confidence as a different reason from a suppressed one', () => {
    // Two hidden states that must never be conflated: "the producer sent
    // nothing" and "the producer sent something we will not print".
    const { confidence: _dropped, ...noConfidence } = plotRows[0]
    expect(resolveRawFactorConfidenceDisplay(noConfidence)).toEqual({
      show: false,
      hiddenReason: 'absent',
    })
  })
})

describe('POSITIVE CONTROL — with the gate open, the real values do come through', () => {
  it('shows the PLoT row WITH its defaulted + provisional disclosure, never bare', () => {
    const out = resolveRawFactorConfidenceDisplay(plotRows[0], true)
    expect(out).toEqual({
      show: true,
      value: 0.25,
      isDefaulted: true,
      isProvisional: true,
    })
  })

  it('shows the ISL row as NOT defaulted — proving isDefaulted is derived, not hardcoded', () => {
    const out = resolveRawFactorConfidenceDisplay(islRows[0], true)
    expect(out).toEqual({
      show: true,
      value: 0.3756,
      isDefaulted: false,
      isProvisional: false,
    })
  })
})

describe('resolveFactorConfidenceDisplay — rejects values it cannot trust', () => {
  it.each([null, undefined, NaN, Infinity, -0.1, 1.1, '0.5' as unknown as number])(
    'reports %p as absent rather than coercing it',
    (confidence) => {
      expect(resolveFactorConfidenceDisplay({ confidence: confidence as number }, true)).toEqual({
        show: false,
        hiddenReason: 'absent',
      })
    },
  )

  it('never infers a disclosure flag that was not supplied', () => {
    const out = resolveFactorConfidenceDisplay({ confidence: 0.5 }, true)
    expect(out).toEqual({ show: true, value: 0.5, isDefaulted: false, isProvisional: false })
  })
})


// ── F9 ───────────────────────────────────────────────────────────────────
// The module header promises that flipping `DISPLAY_SAFE_DRIVER_CONFIDENCE`
// lights every surface up "WITH disclosure". That promise did not hold:
// `FactorNode` derived the disclosure line in a PRIVATE inline array and
// `NodeInspector` — which renders the same signal, including the spoken line
// "High influence but low confidence." — derived nothing at all. One
// derivation is the only way the promise can be kept.
describe('factorConfidenceDisclosure — one derivation for every surface (F9)', () => {
  it('discloses a defaulted estimate', () => {
    expect(factorConfidenceDisclosure({ isDefaulted: true })).toBe(
      'Default estimate — not yet validated with evidence',
    )
  })

  it('discloses a provisional calibration', () => {
    expect(factorConfidenceDisclosure({ isProvisional: true })).toBe('Calibration is provisional')
  })

  it('joins both when both apply', () => {
    expect(factorConfidenceDisclosure({ isDefaulted: true, isProvisional: true })).toBe(
      'Default estimate — not yet validated with evidence. Calibration is provisional',
    )
  })

  it('returns null — not an empty string — when there is nothing to disclose', () => {
    expect(factorConfidenceDisclosure({})).toBeNull()
    expect(factorConfidenceDisclosure({ isDefaulted: false, isProvisional: false })).toBeNull()
  })

  it('is strict: only an explicit true discloses (an absent flag is not a claim)', () => {
    expect(factorConfidenceDisclosure({ isDefaulted: undefined })).toBeNull()
  })

  it('composes with the resolver, so a shown value always has its disclosure available', () => {
    const shown = resolveFactorConfidenceDisplay(
      { confidence: 0.25, isDefaulted: true, confidenceProvenance: { isProvisional: true } },
      true,
    )
    expect(shown.show).toBe(true)
    if (!shown.show) throw new Error('unreachable — asserted above')
    expect(factorConfidenceDisclosure(shown)).toBe(
      'Default estimate — not yet validated with evidence. Calibration is provisional',
    )
  })
})

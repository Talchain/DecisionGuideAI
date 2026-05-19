/**
 * evpi_validation — separates user-facing EVPI percentage-point values
 * from raw diagnostic mirrors and surfaces min/max/negative counts.
 *
 * Sources:
 *   - `bundle.payloads.plot_response.factor_sensitivity[*].evpi_percentage_points`
 *     (surfaced, user-facing)
 *   - `bundle.payloads.plot_response.factor_sensitivity[*].value_of_information`
 *     (raw diagnostic mirror; may legitimately be negative)
 */

import { assertHonestyRules, type ValidatorInputs, type ValidatorResult } from './types'

interface Stats {
  count: number
  min: number | null
  max: number | null
  negative_count: number
}

function summariseNumbers(values: ReadonlyArray<number>): Stats {
  if (values.length === 0) {
    return { count: 0, min: null, max: null, negative_count: 0 }
  }
  let min = values[0]
  let max = values[0]
  let neg = 0
  for (const v of values) {
    if (v < min) min = v
    if (v > max) max = v
    if (v < 0) neg++
  }
  return { count: values.length, min, max, negative_count: neg }
}

function extractFromFactorSensitivity(plotResponse: unknown): {
  surfaced: number[]
  raw: number[]
} {
  if (!plotResponse || typeof plotResponse !== 'object' || Array.isArray(plotResponse)) {
    return { surfaced: [], raw: [] }
  }
  const fs = (plotResponse as Record<string, unknown>).factor_sensitivity
  if (!Array.isArray(fs)) return { surfaced: [], raw: [] }
  const surfaced: number[] = []
  const raw: number[] = []
  for (const entry of fs) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const e = entry as Record<string, unknown>
    if (typeof e.evpi_percentage_points === 'number') surfaced.push(e.evpi_percentage_points)
    if (typeof e.value_of_information === 'number') raw.push(e.value_of_information)
  }
  return { surfaced, raw }
}

export function runEvpiValidation(inputs: ValidatorInputs): ValidatorResult {
  const { surfaced, raw } = extractFromFactorSensitivity(inputs.plotResponse)
  if (surfaced.length === 0 && raw.length === 0) {
    return assertHonestyRules({
      status: 'unavailable',
      claim_strength: 'unavailable',
      source_paths: [
        'payloads.plot_response.factor_sensitivity[*].evpi_percentage_points',
        'payloads.plot_response.factor_sensitivity[*].value_of_information',
      ],
      limitations: ['No EVPI / value_of_information values found in PLoT response.'],
      required_upstream_support: [
        'plot.response.factor_sensitivity[*].evpi_percentage_points',
      ],
      details: {},
    })
  }

  const surfacedStats = summariseNumbers(surfaced)
  const rawStats = summariseNumbers(raw)

  // Surfaced (user-facing) negatives are the main concern: they would
  // mean the UI shows negative EVPI to a user. Negatives in raw
  // diagnostic mirrors are expected and not a fail signal.
  const status: ValidatorResult['status'] =
    surfacedStats.negative_count > 0 ? 'fail' : 'pass'

  return assertHonestyRules({
    status,
    claim_strength: 'derived',
    source_paths: [
      'payloads.plot_response.factor_sensitivity[*].evpi_percentage_points',
      'payloads.plot_response.factor_sensitivity[*].value_of_information',
    ],
    limitations:
      surfacedStats.count === 0
        ? ['Only raw diagnostic EVPI is present (no surfaced values).']
        : [],
    required_upstream_support: [],
    details: {
      surfaced: surfacedStats,
      raw_diagnostic: rawStats,
    },
  })
}

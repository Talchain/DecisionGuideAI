/**
 * auto_noise_validation — checks top-level `auto_noise_applied` and
 * `auto_noise_provenance.applied` for agreement. A disagreement means
 * the reported applied state differs from the provenance record —
 * likely a bug or stale field.
 */

import { assertHonestyRules, type ValidatorInputs, type ValidatorResult } from './types'

export function runAutoNoiseValidation(inputs: ValidatorInputs): ValidatorResult {
  if (
    !inputs.plotResponse ||
    typeof inputs.plotResponse !== 'object' ||
    Array.isArray(inputs.plotResponse)
  ) {
    return assertHonestyRules({
      status: 'unavailable',
      claim_strength: 'unavailable',
      source_paths: [],
      limitations: ['PLoT response missing.'],
      required_upstream_support: ['plot.response.auto_noise_applied', 'plot.response.auto_noise_provenance'],
      details: {},
    })
  }

  const pr = inputs.plotResponse as Record<string, unknown>
  const applied_top = pr.auto_noise_applied
  const prov = pr.auto_noise_provenance

  if (applied_top === undefined && prov === undefined) {
    return assertHonestyRules({
      status: 'unavailable',
      claim_strength: 'unavailable',
      source_paths: [],
      limitations: ['Neither auto_noise_applied nor auto_noise_provenance is present.'],
      required_upstream_support: ['plot.response.auto_noise_applied', 'plot.response.auto_noise_provenance'],
      details: {},
    })
  }

  const applied_top_bool =
    typeof applied_top === 'boolean' ? applied_top : null
  const applied_prov =
    prov && typeof prov === 'object' && !Array.isArray(prov)
      ? (typeof (prov as Record<string, unknown>).applied === 'boolean'
          ? ((prov as Record<string, unknown>).applied as boolean)
          : null)
      : null

  const agreement =
    applied_top_bool !== null && applied_prov !== null
      ? applied_top_bool === applied_prov
      : null

  const status: ValidatorResult['status'] =
    agreement === null ? 'partial' : agreement ? 'pass' : 'fail'

  const limitations: string[] = []
  if (applied_top_bool === null) limitations.push('auto_noise_applied not a boolean.')
  if (applied_prov === null) limitations.push('auto_noise_provenance.applied not a boolean.')

  return assertHonestyRules({
    status,
    claim_strength: 'derived',
    source_paths: [
      'payloads.plot_response.auto_noise_applied',
      'payloads.plot_response.auto_noise_provenance',
    ],
    limitations,
    required_upstream_support: [],
    details: {
      auto_noise_applied_top_level: applied_top_bool,
      auto_noise_applied_provenance: applied_prov,
      agreement,
      provenance: prov ?? null,
    },
  })
}

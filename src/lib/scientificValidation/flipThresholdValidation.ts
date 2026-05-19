/**
 * flip_threshold_validation — validates PR #167 surface:
 *   - if `bundle.payloads.plot_response.flip_thresholds_status` is
 *     present, classify directly (`derived`);
 *   - if absent, emit `unavailable` with explicit upstream support
 *     requirement. Do NOT infer `_status` from `flip_value` presence as
 *     proof — that's `inferred` evidence and cannot pair with pass.
 */

import { assertHonestyRules, type ValidatorInputs, type ValidatorResult } from './types'

interface FlipBuckets {
  found: number
  no_effect: number
  unresolved: number
  unavailable: number
}

function bucketFlipThresholds(entries: unknown): FlipBuckets {
  const out: FlipBuckets = { found: 0, no_effect: 0, unresolved: 0, unavailable: 0 }
  if (!Array.isArray(entries)) return out
  for (const e of entries) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) continue
    const flip_value = (e as Record<string, unknown>).flip_value
    const flip_reason = (e as Record<string, unknown>).flip_reason
    if (typeof flip_value === 'number' && Number.isFinite(flip_value)) {
      out.found++
    } else if (flip_reason === 'no_effect' || flip_reason === 'no_bracket') {
      out.no_effect++
    } else if (flip_reason === 'unresolved' || flip_reason === 'not_resolved') {
      out.unresolved++
    } else {
      out.unavailable++
    }
  }
  return out
}

export function runFlipThresholdValidation(inputs: ValidatorInputs): ValidatorResult {
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
      required_upstream_support: ['plot.response.flip_thresholds_status'],
      details: {},
    })
  }

  const pr = inputs.plotResponse as Record<string, unknown>
  const status_field = pr.flip_thresholds_status
  const thresholds = pr.flip_thresholds

  if (status_field !== undefined && status_field !== null) {
    // PR #167 upstream emit available — derived directly.
    const buckets = bucketFlipThresholds(thresholds)
    return assertHonestyRules({
      status: 'pass',
      claim_strength: 'derived',
      source_paths: [
        'payloads.plot_response.flip_thresholds_status',
        'payloads.plot_response.flip_thresholds',
      ],
      limitations: [],
      required_upstream_support: [],
      details: {
        flip_thresholds_status: status_field,
        buckets,
      },
    })
  }

  // Status field absent — emit unavailable. Do NOT promote inferred buckets
  // to a pass.
  return assertHonestyRules({
    status: 'unavailable',
    claim_strength: 'unavailable',
    source_paths: thresholds ? ['payloads.plot_response.flip_thresholds'] : [],
    limitations: [
      'flip_thresholds_status is not yet emitted by PLoT (PR #167 work in flight). ' +
        'Bucket counts from flip_value presence are provided as inferred evidence only.',
    ],
    required_upstream_support: ['plot.response.flip_thresholds_status'],
    details: {
      inferred_buckets: bucketFlipThresholds(thresholds),
    },
  })
}

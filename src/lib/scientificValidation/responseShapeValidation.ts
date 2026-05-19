/**
 * response_shape_validation — always emits. Lists which required fields
 * are present/missing on the PLoT response and classifies the source as
 * live / hydrated / fallback / unavailable.
 *
 * The source classification is derived from `capture_pipeline_status`:
 *   - complete                                              → live
 *   - results_rendered_from_store_without_capture           → fallback
 *   - hydrated_only                                         → hydrated
 *   - parse_failed / request_failed / proxy_or_network_failure → fallback
 *   - capture_missing                                       → unavailable
 */

import { assertHonestyRules, type ValidatorInputs, type ValidatorResult } from './types'

const REQUIRED_PLOT_RESPONSE_KEYS = [
  'option_comparison',
  'factor_sensitivity',
  'm1_coaching',
  'flip_thresholds',
  'robustness',
] as const

function classifySource(status: string | null): 'live' | 'hydrated' | 'fallback' | 'unavailable' {
  switch (status) {
    case 'complete':
      return 'live'
    case 'hydrated_only':
      return 'hydrated'
    case 'parse_failed':
    case 'request_failed':
    case 'proxy_or_network_failure':
    case 'results_rendered_from_store_without_capture':
      return 'fallback'
    case 'capture_missing':
    default:
      return 'unavailable'
  }
}

export function runResponseShapeValidation(inputs: ValidatorInputs): ValidatorResult {
  const source = classifySource(inputs.capturePipelineStatus)

  const presence: Record<string, boolean> = {}
  let present_count = 0
  if (
    inputs.plotResponse &&
    typeof inputs.plotResponse === 'object' &&
    !Array.isArray(inputs.plotResponse)
  ) {
    const obj = inputs.plotResponse as Record<string, unknown>
    for (const k of REQUIRED_PLOT_RESPONSE_KEYS) {
      const isPresent = obj[k] !== undefined && obj[k] !== null
      presence[k] = isPresent
      if (isPresent) present_count++
    }
  } else {
    for (const k of REQUIRED_PLOT_RESPONSE_KEYS) presence[k] = false
  }

  let status: ValidatorResult['status']
  let claim_strength: ValidatorResult['claim_strength']
  if (source === 'unavailable') {
    status = 'unavailable'
    claim_strength = 'unavailable'
  } else if (source === 'hydrated' || source === 'fallback') {
    status = 'partial'
    claim_strength = 'inferred'
  } else {
    status =
      present_count === REQUIRED_PLOT_RESPONSE_KEYS.length ? 'pass' : 'partial'
    claim_strength = 'observed'
  }

  const limitations: string[] = []
  if (source === 'hydrated') {
    limitations.push(
      'PLoT response was hydrated from saved state; live raw payloads are not available for this export.',
    )
  }
  if (source === 'fallback') {
    limitations.push(
      'PLoT response was reconstructed without a fresh capture; treat fields as advisory.',
    )
  }

  return assertHonestyRules({
    status,
    claim_strength,
    source_paths: ['payloads.plot_response'],
    limitations,
    required_upstream_support: [],
    details: {
      source,
      required_keys: [...REQUIRED_PLOT_RESPONSE_KEYS],
      presence,
      present_count,
    },
  })
}

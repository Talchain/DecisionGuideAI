/**
 * confidence_validation — verifies factor confidence is sourced from
 * the `plot_unified_v3+` pipeline (PR #170). Detects:
 *   - presence of `confidence_provenance.computation_source` and
 *     `formula_version`;
 *   - whether values match the old discrete lattice
 *     `{0.25, 0.375, 0.5, 0.625, 0.75}`;
 *   - distinct confidence count (continuous bootstrap should show many).
 */

import { assertHonestyRules, type ValidatorInputs, type ValidatorResult } from './types'

const OLD_LATTICE = new Set([0.25, 0.375, 0.5, 0.625, 0.75])
const PROVENANCE_REGEX = /^plot_unified_v(\d+)$/

interface FactorRow {
  factor_id: string | null
  confidence: number | null
  confidence_source: string | null
  computation_source: string | null
  formula_version: string | null
  formula_version_number: number | null
  confidence_components: Record<string, unknown> | null
  old_lattice_match: boolean
}

function readFactorRow(entry: unknown): FactorRow | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  const e = entry as Record<string, unknown>
  const factor_id =
    typeof e.factor_id === 'string'
      ? e.factor_id
      : typeof e.id === 'string'
      ? e.id
      : null
  const confidence = typeof e.confidence === 'number' ? e.confidence : null
  const confidence_source =
    typeof e.confidence_source === 'string' ? e.confidence_source : null

  const prov = e.confidence_provenance
  const provObj =
    prov && typeof prov === 'object' && !Array.isArray(prov)
      ? (prov as Record<string, unknown>)
      : null
  const computation_source =
    provObj && typeof provObj.computation_source === 'string'
      ? (provObj.computation_source as string)
      : null
  const formula_version =
    provObj && typeof provObj.formula_version === 'string'
      ? (provObj.formula_version as string)
      : null
  const formula_match = formula_version ? PROVENANCE_REGEX.exec(formula_version) : null
  const formula_version_number = formula_match ? Number(formula_match[1]) : null

  const components_raw = provObj?.confidence_components
  const confidence_components =
    components_raw && typeof components_raw === 'object' && !Array.isArray(components_raw)
      ? (components_raw as Record<string, unknown>)
      : null

  return {
    factor_id,
    confidence,
    confidence_source,
    computation_source,
    formula_version,
    formula_version_number,
    confidence_components,
    old_lattice_match: confidence !== null && OLD_LATTICE.has(confidence),
  }
}

export function runConfidenceValidation(inputs: ValidatorInputs): ValidatorResult {
  const response = inputs.plotResponse
  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return assertHonestyRules({
      status: 'unavailable',
      claim_strength: 'unavailable',
      source_paths: [],
      limitations: ['PLoT response not captured in bundle.payloads.plot_response.'],
      required_upstream_support: ['plot.response.factor_sensitivity'],
      details: {},
    })
  }
  const fs = (response as Record<string, unknown>).factor_sensitivity
  if (!Array.isArray(fs) || fs.length === 0) {
    return assertHonestyRules({
      status: 'unavailable',
      claim_strength: 'unavailable',
      source_paths: ['payloads.plot_response.factor_sensitivity'],
      limitations: ['factor_sensitivity missing or empty in PLoT response.'],
      required_upstream_support: ['plot.response.factor_sensitivity'],
      details: {},
    })
  }

  const rows = fs.map(readFactorRow).filter((r): r is FactorRow => r !== null)
  const provenance_present_count = rows.filter((r) => r.computation_source !== null).length
  const v3_plus_count = rows.filter(
    (r) => r.formula_version_number !== null && r.formula_version_number >= 3,
  ).length
  const old_lattice_match_count = rows.filter((r) => r.old_lattice_match).length
  const distinct_confidence_count = new Set(
    rows.map((r) => (r.confidence === null ? null : r.confidence)),
  ).size

  let status: ValidatorResult['status']
  if (provenance_present_count === 0) {
    status = 'unavailable'
  } else if (v3_plus_count > 0 && old_lattice_match_count === 0) {
    status = 'pass'
  } else if (v3_plus_count > 0) {
    status = 'partial'
  } else {
    status = 'fail'
  }

  const claim_strength: ValidatorResult['claim_strength'] =
    status === 'unavailable' ? 'unavailable' : 'derived'

  return assertHonestyRules({
    status,
    claim_strength,
    source_paths: [
      'payloads.plot_response.factor_sensitivity',
      'payloads.plot_response.factor_sensitivity[*].confidence_provenance',
    ],
    limitations:
      provenance_present_count === 0
        ? ['No factor carries confidence_provenance — PR #170 work has not propagated yet.']
        : [],
    required_upstream_support:
      provenance_present_count === 0
        ? ['plot.response.factor_sensitivity[*].confidence_provenance']
        : [],
    details: {
      factor_count: rows.length,
      provenance_present_count,
      v3_plus_count,
      old_lattice_match_count,
      distinct_confidence_count,
      factors: rows,
    },
  })
}

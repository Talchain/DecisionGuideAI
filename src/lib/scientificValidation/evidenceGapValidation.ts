/**
 * evidence_gap_validation — verifies PR #166: evidence gaps are sourced
 * from enriched PLoT factor_sensitivity and EXCLUDE intervention levers.
 *
 * Reads:
 *   - `bundle.payloads.plot_response.m1_coaching.evidence_gaps[]`
 *   - canvas store `ceeAnalysisReady.options[*].interventions` keys
 *
 * Flags any evidence gap whose factor_id matches an intervention lever.
 */

import { assertHonestyRules, type ValidatorInputs, type ValidatorResult } from './types'

function readEvidenceGaps(plotResponse: unknown): unknown[] {
  if (!plotResponse || typeof plotResponse !== 'object' || Array.isArray(plotResponse)) return []
  const coaching = (plotResponse as Record<string, unknown>).m1_coaching
  if (!coaching || typeof coaching !== 'object' || Array.isArray(coaching)) return []
  const gaps = (coaching as Record<string, unknown>).evidence_gaps
  return Array.isArray(gaps) ? gaps : []
}

function readInterventionLevers(ceeAnalysisReady: unknown): Set<string> {
  const out = new Set<string>()
  if (!ceeAnalysisReady || typeof ceeAnalysisReady !== 'object' || Array.isArray(ceeAnalysisReady)) {
    return out
  }
  const options = (ceeAnalysisReady as Record<string, unknown>).options
  if (!Array.isArray(options)) return out
  for (const opt of options) {
    if (!opt || typeof opt !== 'object' || Array.isArray(opt)) continue
    const interventions = (opt as Record<string, unknown>).interventions
    if (interventions && typeof interventions === 'object' && !Array.isArray(interventions)) {
      for (const k of Object.keys(interventions as Record<string, unknown>)) out.add(k)
    }
    // Handle alternate shape: array of {factor_id, value}
    if (Array.isArray(interventions)) {
      for (const item of interventions) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const id = (item as Record<string, unknown>).factor_id ?? (item as Record<string, unknown>).target_node_id
          if (typeof id === 'string') out.add(id)
        }
      }
    }
  }
  return out
}

interface FlaggedGap {
  factor_id: string
  factor_label: string | null
  is_intervention_lever: boolean
}

export function runEvidenceGapValidation(inputs: ValidatorInputs): ValidatorResult {
  const gaps = readEvidenceGaps(inputs.plotResponse)
  if (gaps.length === 0) {
    return assertHonestyRules({
      status: 'unavailable',
      claim_strength: 'unavailable',
      source_paths: ['payloads.plot_response.m1_coaching.evidence_gaps'],
      limitations: ['m1_coaching.evidence_gaps absent or empty in PLoT response.'],
      required_upstream_support: ['plot.response.m1_coaching.evidence_gaps'],
      details: {},
    })
  }

  const levers = readInterventionLevers(inputs.ceeAnalysisReady)
  const flagged: FlaggedGap[] = []
  for (const g of gaps) {
    if (!g || typeof g !== 'object' || Array.isArray(g)) continue
    const obj = g as Record<string, unknown>
    const factor_id =
      typeof obj.factor_id === 'string'
        ? obj.factor_id
        : typeof obj.target_node_id === 'string'
        ? obj.target_node_id
        : null
    if (!factor_id) continue
    const factor_label =
      typeof obj.factor_label === 'string' ? obj.factor_label : null
    flagged.push({
      factor_id,
      factor_label,
      is_intervention_lever: levers.has(factor_id),
    })
  }

  const leakage_count = flagged.filter((f) => f.is_intervention_lever).length
  const status: ValidatorResult['status'] =
    leakage_count === 0 ? 'pass' : 'partial'

  return assertHonestyRules({
    status,
    claim_strength: 'derived',
    source_paths: [
      'payloads.plot_response.m1_coaching.evidence_gaps',
      'canvas.ceeAnalysisReady.options[*].interventions',
    ],
    limitations:
      levers.size === 0
        ? ['No intervention levers known — cannot prove exclusion from evidence gaps.']
        : [],
    required_upstream_support: [],
    details: {
      evidence_gap_count: gaps.length,
      intervention_lever_count: levers.size,
      intervention_leakage_count: leakage_count,
      flagged_gaps: flagged,
    },
  })
}

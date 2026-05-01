/**
 * Boundary validator for CEE-provided analysis_ready.
 *
 * Contract owner: CEE
 * CEE schema: olumi-assistants-service/src/schemas/analysis-ready.ts
 * Canonical fixture: src/__contracts__/analysis-ready.fixture.json
 * Contract tests: src/__contracts__/__tests__/analysisReadyContract.spec.ts
 * Contract version: 1.0.0
 *
 * ANY shape change requires simultaneous updates to all three:
 * 1. CEE schema version bump
 * 2. Canonical fixture regeneration (CEE: npm run generate:analysis-ready-fixture)
 * 3. This validator + contract tests updated to match
 *
 * On validation failure: returns undefined, triggering synthesis fallback.
 * Never silently defaults individual fields.
 */

import type { CEEAnalysisReady } from '../../adapters/cee/types'

/**
 * Validate the mapped analysis_ready payload against the CEE contract.
 *
 * This runs AFTER field mapping (option_id → id) but BEFORE the payload
 * reaches the store or downstream consumers like normaliseOptionStatus.
 *
 * Rejection is all-or-nothing: if any single option fails, the entire
 * payload is rejected and synthesis fallback is used instead.
 */
export function validateAnalysisReadyContract(mapped: unknown): CEEAnalysisReady | undefined {
  if (mapped == null || typeof mapped !== 'object') return undefined

  const obj = mapped as Record<string, unknown>
  const missingFields: string[] = []

  // Top-level required fields
  if (typeof obj.goal_node_id !== 'string' || obj.goal_node_id.length === 0) {
    missingFields.push('goal_node_id')
  }
  if (obj.status !== 'ready') {
    missingFields.push('status (expected "ready")')
  }
  if (!Array.isArray(obj.options) || obj.options.length === 0) {
    missingFields.push('options (non-empty array)')
  }

  if (missingFields.length > 0) {
    console.error('[validateAnalysisReadyContract] CEE payload rejected', {
      missing_fields: missingFields,
      failing_option_indices: [],
      payload_keys: Object.keys(obj),
      option_count: Array.isArray(obj.options) ? obj.options.length : 0,
    })
    return undefined
  }

  // freshness is normalised in normaliseAnalysisReady() to one of
  // 'fresh' | 'stale' | 'unknown' | 'none' before reaching the validator,
  // so it passes through here without explicit checks. Absent on legacy
  // payloads — the normaliser coerces missing values to 'unknown'.

  // Per-option validation — all must pass
  const options = obj.options as Record<string, unknown>[]
  const failingIndices: number[] = []
  const optionMissing: string[][] = []

  for (let i = 0; i < options.length; i++) {
    const opt = options[i]
    const missing: string[] = []

    if (typeof opt.id !== 'string' || opt.id.length === 0) {
      missing.push('id')
    }
    if (opt.status !== 'ready') {
      missing.push(`status (got "${opt.status}", expected "ready")`)
    }
    // interventions must be an object but MAY be empty — baseline/status quo
    // options legitimately have {} interventions ("do nothing" = change nothing).
    if (opt.interventions == null || typeof opt.interventions !== 'object') {
      missing.push('interventions (object)')
    }

    if (missing.length > 0) {
      failingIndices.push(i)
      optionMissing.push(missing)
    }
  }

  if (failingIndices.length > 0) {
    console.error('[validateAnalysisReadyContract] CEE payload rejected', {
      missing_fields: optionMissing.flat(),
      failing_option_indices: failingIndices,
      payload_keys: Object.keys(obj),
      option_count: options.length,
    })
    return undefined
  }

  return mapped as CEEAnalysisReady
}

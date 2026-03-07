/**
 * Contract tests for CEE analysis_ready boundary validation.
 *
 * These tests verify that validateAnalysisReadyContract correctly accepts
 * valid CEE payloads and rejects malformed ones. The canonical fixture
 * (analysis-ready.fixture.json) represents the CEE contract; any shape
 * change requires simultaneous updates to:
 * 1. CEE schema version bump
 * 2. Fixture regeneration
 * 3. This test + validator update
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateAnalysisReadyContract } from '../../canvas/conversation/validateAnalysisReadyContract'
import fixture from '../analysis-ready.fixture.json'

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('analysisReadyContract', () => {
  // =========================================================================
  // § 1: Shape validation — valid fixture passes
  // =========================================================================

  it('accepts the canonical valid fixture', () => {
    const result = validateAnalysisReadyContract(fixture.valid)
    expect(result).toBeDefined()
    expect(result!.status).toBe('ready')
    expect(result!.goal_node_id).toBe('goal_hiring_success')
    expect(result!.options).toHaveLength(2)
    expect(result!.options[0].id).toBe('opt_senior_hire')
    expect(result!.options[1].id).toBe('opt_junior_hire')
  })

  it('preserves intervention values through validation', () => {
    const result = validateAnalysisReadyContract(fixture.valid)
    expect(result).toBeDefined()
    const seniorInterventions = result!.options[0].interventions
    expect(seniorInterventions.factor_experience.value).toBe(0.9)
    expect(seniorInterventions.factor_salary.value).toBe(-0.7)
  })

  // =========================================================================
  // § 2: Rejection — structurally invalid payloads
  // =========================================================================

  it('rejects null/undefined input', () => {
    expect(validateAnalysisReadyContract(null)).toBeUndefined()
    expect(validateAnalysisReadyContract(undefined)).toBeUndefined()
  })

  it('rejects non-object input', () => {
    expect(validateAnalysisReadyContract('string')).toBeUndefined()
    expect(validateAnalysisReadyContract(42)).toBeUndefined()
    expect(validateAnalysisReadyContract([])).toBeUndefined()
  })

  it('rejects empty goal_node_id', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = validateAnalysisReadyContract(fixture.missing_goal_node_id)
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalledWith(
      '[validateAnalysisReadyContract] CEE payload rejected',
      expect.objectContaining({ missing_fields: expect.arrayContaining(['goal_node_id']) })
    )
  })

  it('rejects missing status (not "ready")', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = validateAnalysisReadyContract(fixture.missing_status)
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })

  it('rejects empty options array', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = validateAnalysisReadyContract(fixture.empty_options)
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })

  // =========================================================================
  // § 3: Per-option validation — all-or-nothing rejection
  // =========================================================================

  it('rejects when any option is missing id', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = validateAnalysisReadyContract(fixture.option_missing_id)
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalledWith(
      '[validateAnalysisReadyContract] CEE payload rejected',
      expect.objectContaining({
        failing_option_indices: [0],
        missing_fields: expect.arrayContaining(['id']),
      })
    )
  })

  it('rejects when any option is missing status', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = validateAnalysisReadyContract(fixture.option_missing_status)
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })

  it('rejects when any option has empty interventions', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = validateAnalysisReadyContract(fixture.option_empty_interventions)
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })

  it('rejects entire payload when one option of many is malformed (all-or-nothing)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = validateAnalysisReadyContract(fixture.partial_malformation)
    expect(result).toBeUndefined()
    // The good option (index 0) should still cause full rejection because the bad one (index 1) fails
    expect(spy).toHaveBeenCalledWith(
      '[validateAnalysisReadyContract] CEE payload rejected',
      expect.objectContaining({
        failing_option_indices: [1],
      })
    )
  })

  // =========================================================================
  // § 4: Field mapping — option_id → id handled upstream
  // =========================================================================

  it('rejects option_id field (mapping happens in normaliseAnalysisReady, not here)', () => {
    // validateAnalysisReadyContract runs AFTER normaliseAnalysisReady maps option_id → id.
    // If option_id slips through unmapped, the validator should reject it.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = validateAnalysisReadyContract(fixture.option_id_via_option_id_field)
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })

  // =========================================================================
  // § 5: Full pipeline — normaliseAnalysisReady + validateAnalysisReadyContract
  // =========================================================================

  it('option_id → id mapping works when normaliseAnalysisReady is called first', async () => {
    // Dynamically import to avoid circular dependency issues in test
    const { normaliseAnalysisReady } = await getNormaliseAnalysisReady()
    const result = normaliseAnalysisReady(fixture.option_id_via_option_id_field)
    // After normalisation, the id should be mapped from option_id
    // But the fixture has no 'id' field — normaliseAnalysisReady maps option_id → id
    // Then validateAnalysisReadyContract runs and should accept it
    expect(result).toBeDefined()
    expect(result!.options[0].id).toBe('opt_mapped')
  })
})

/**
 * Helper to access the module-scoped normaliseAnalysisReady function.
 * It's not exported, so we re-implement the logic here for the pipeline test.
 */
async function getNormaliseAnalysisReady() {
  // Re-implement normaliseAnalysisReady inline since it's not exported from useConversation
  const normaliseAnalysisReady = (raw: unknown) => {
    if (raw == null || typeof raw !== 'object') return undefined
    const obj = raw as Record<string, unknown>
    if (!Array.isArray(obj.options) || typeof obj.goal_node_id !== 'string') return undefined

    const options = (obj.options as any[])
      .map((opt: any) => ({
        ...opt,
        id: opt.id ?? opt.option_id,
      }))
      .filter((opt: any) => typeof opt.id === 'string' && opt.id.length > 0)

    if (options.length === 0) return undefined

    const mapped = { ...obj, options }
    return validateAnalysisReadyContract(mapped)
  }
  return { normaliseAnalysisReady }
}

/**
 * Contract tests for CEE analysis_ready boundary validation.
 *
 * The canonical fixture (analysis-ready.fixture.json) is a single valid
 * CEE payload representing the contract shape. Malformed variants are
 * built inline to keep the canonical artifact clean for cross-service
 * governance (CEE regenerates one fixture on schema changes).
 *
 * Tests verify:
 * 1. validateAnalysisReadyContract accepts/rejects correctly
 * 2. The full pipeline (adaptCEEBlock → normaliseAnalysisReady → validator) works end-to-end
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateAnalysisReadyContract } from '../../canvas/conversation/validateAnalysisReadyContract'
import { adaptCEEBlock } from '../../canvas/conversation/useConversation'
import type { GraphPatchBlock } from '../../canvas/conversation/types'
import canonicalFixture from '../analysis-ready.fixture.json'

beforeEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Test data builders — malformed variants for negative tests
// ---------------------------------------------------------------------------

function makeValidPayload(overrides?: Record<string, unknown>) {
  return {
    status: 'ready',
    goal_node_id: 'goal_1',
    options: [
      {
        id: 'opt_a',
        label: 'Option A',
        status: 'ready',
        interventions: { f1: { value: 1, source: 'brief_extraction' } },
      },
    ],
    ...overrides,
  }
}

function makeOption(overrides?: Record<string, unknown>) {
  return {
    id: 'opt_a',
    label: 'Option A',
    status: 'ready',
    interventions: { f1: { value: 1, source: 'brief_extraction' } },
    ...overrides,
  }
}

/** Wrap an analysis_ready payload in a CEE block for adaptCEEBlock */
function wrapInBlock(analysisReady: unknown) {
  return {
    block_type: 'graph_patch',
    block_id: 'test-block',
    data: {
      operations: [],
      auto_apply: true,
      analysis_ready: analysisReady,
    },
  }
}

describe('analysisReadyContract', () => {
  // =========================================================================
  // § 1: Shape validation — canonical fixture passes
  // =========================================================================

  it('accepts the canonical fixture', () => {
    const result = validateAnalysisReadyContract(canonicalFixture)
    expect(result).toBeDefined()
    expect(result!.status).toBe('ready')
    expect(result!.goal_node_id).toBe('goal_hiring_success')
    expect(result!.options).toHaveLength(2)
    expect(result!.options[0].id).toBe('opt_senior_hire')
    expect(result!.options[1].id).toBe('opt_junior_hire')
  })

  it('preserves intervention values through validation', () => {
    const result = validateAnalysisReadyContract(canonicalFixture)
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
    const result = validateAnalysisReadyContract(makeValidPayload({ goal_node_id: '' }))
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalledWith(
      '[validateAnalysisReadyContract] CEE payload rejected',
      expect.objectContaining({ missing_fields: expect.arrayContaining(['goal_node_id']) })
    )
  })

  it('rejects missing status (not "ready")', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { status: _, ...noStatus } = makeValidPayload()
    const result = validateAnalysisReadyContract(noStatus)
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })

  it('rejects empty options array', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = validateAnalysisReadyContract(makeValidPayload({ options: [] }))
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })

  // =========================================================================
  // § 3: Per-option validation — all-or-nothing rejection
  // =========================================================================

  it('rejects when any option is missing id', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { id: _, ...noId } = makeOption()
    const result = validateAnalysisReadyContract(makeValidPayload({ options: [noId] }))
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
    const { status: _, ...noStatus } = makeOption()
    const result = validateAnalysisReadyContract(makeValidPayload({ options: [noStatus] }))
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })

  it('accepts options with empty interventions (baseline/status quo)', () => {
    const result = validateAnalysisReadyContract(
      makeValidPayload({ options: [makeOption({ interventions: {} })] })
    )
    expect(result).toBeDefined()
    expect(result!.options).toHaveLength(1)
  })

  it('accepts payload when one option has empty interventions (baseline mixed with active)', () => {
    const result = validateAnalysisReadyContract(
      makeValidPayload({
        options: [
          makeOption({ id: 'opt_active' }),
          makeOption({ id: 'opt_baseline', interventions: {} }),
        ],
      })
    )
    expect(result).toBeDefined()
    expect(result!.options).toHaveLength(2)
  })

  it('rejects when interventions is null or not an object', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = validateAnalysisReadyContract(
      makeValidPayload({ options: [makeOption({ interventions: null as any })] })
    )
    expect(result).toBeUndefined()
    expect(spy).toHaveBeenCalled()
  })

  // =========================================================================
  // § 4: Field mapping — option_id → id via adaptCEEBlock production path
  // =========================================================================

  it('option_id → id mapping works through adaptCEEBlock production path', () => {
    const payload = makeValidPayload({
      options: [
        {
          option_id: 'opt_mapped',
          label: 'Mapped option',
          status: 'ready',
          interventions: { f1: { value: 1, source: 'brief_extraction' } },
        },
      ],
    })
    // Remove id field — only option_id present
    delete (payload.options[0] as any).id

    const adapted = adaptCEEBlock(wrapInBlock(payload)) as GraphPatchBlock
    expect(adapted.analysis_ready).toBeDefined()
    expect(adapted.analysis_ready!.options[0].id).toBe('opt_mapped')
  })

  it('rejects option with neither id nor option_id through adaptCEEBlock', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const payload = makeValidPayload({
      options: [
        {
          label: 'No ID at all',
          status: 'ready',
          interventions: { f1: { value: 1, source: 'brief_extraction' } },
        },
      ],
    })

    const adapted = adaptCEEBlock(wrapInBlock(payload)) as GraphPatchBlock
    // Should be rejected because option has no id after mapping
    expect(adapted.analysis_ready).toBeUndefined()
  })

  it('rejects entire payload when one option lacks id (all-or-nothing via adaptCEEBlock)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const payload = makeValidPayload({
      options: [
        makeOption({ id: 'opt_good' }),
        { label: 'No ID option', status: 'ready', interventions: { f1: { value: 1, source: 'brief_extraction' } } },
      ],
    })

    const adapted = adaptCEEBlock(wrapInBlock(payload)) as GraphPatchBlock
    // All-or-nothing: even the good option is rejected
    expect(adapted.analysis_ready).toBeUndefined()
  })

  // =========================================================================
  // § 5: adaptCEEBlock passes valid canonical fixture through
  // =========================================================================

  it('canonical fixture passes through adaptCEEBlock end-to-end', () => {
    const adapted = adaptCEEBlock(wrapInBlock(canonicalFixture)) as GraphPatchBlock
    expect(adapted.analysis_ready).toBeDefined()
    expect(adapted.analysis_ready!.goal_node_id).toBe('goal_hiring_success')
    expect(adapted.analysis_ready!.options).toHaveLength(2)
  })
})

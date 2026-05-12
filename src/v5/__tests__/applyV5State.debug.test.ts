/**
 * Phase 1 — [v5-state] debug logging contract.
 *
 * Verifies that each step of applyV5State emits one filterable console.info
 * line when VITE_V5_STATE_DEBUG is 'true' and nothing when it's off.
 * Asserts that log content is keys/status-only, never user text.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

import type { OlumiResponse } from '@talchain/schemas/boundary'
import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

function makeStore(): V5ApplicatorStore {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    nodes: [],
    edges: [],
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
  }
}

function makeMinimalAnalyseResponse(): OlumiResponse {
  return {
    turn_id: 't1',
    assistant_text: null,
    blocks: [],
    stage_indicator: { stage: 'analyse', confidence: 'high', source: 'inferred' },
    analysis_ready: {
      goal_node_id: 'goal_1',
      status: 'ready',
      options: [
        { id: 'opt_1', label: 'A', status: 'ready', interventions: {} },
      ],
    },
  } as unknown as OlumiResponse
}

describe('applyV5State [v5-state] debug logging', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let infoSpy: any

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    infoSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it('emits nothing when VITE_V5_STATE_DEBUG is unset (default)', () => {
    vi.stubEnv('VITE_V5_STATE_DEBUG', '')
    applyV5State(makeMinimalAnalyseResponse(), makeStore())
    expect(infoSpy).not.toHaveBeenCalled()
  })

  it('emits one [v5-state] line per step when VITE_V5_STATE_DEBUG=true', () => {
    vi.stubEnv('VITE_V5_STATE_DEBUG', 'true')
    applyV5State(makeMinimalAnalyseResponse(), makeStore())
    const calls = (infoSpy.mock.calls as unknown[][]).filter((c) => c[0] === '[v5-state]')
    // 5 numbered steps, each logs exactly once per applyV5State invocation
    // (step 5 is results hydration, added 2026-05-12)
    expect(calls.length).toBe(5)
    const stepNumbers = calls
      .map((c) => (c[1] as { step_number: number }).step_number)
      .sort()
    expect(stepNumbers).toEqual([1, 2, 3, 4, 5])
  })

  it('never includes user text — only keys/counts/enum values', () => {
    vi.stubEnv('VITE_V5_STATE_DEBUG', 'true')
    applyV5State(makeMinimalAnalyseResponse(), makeStore())
    for (const call of infoSpy.mock.calls as unknown[][]) {
      const ctx = call[1] as Record<string, unknown>
      const serialised = JSON.stringify(ctx)
      // Sentinel text that would appear in a real user message / option label
      expect(serialised).not.toContain('Raise Price')
      expect(serialised).not.toContain('Subscription')
      // The payload should only carry field names, step identifiers, counts
      expect(typeof ctx.step_number).toBe('number')
      expect(typeof ctx.step_name).toBe('string')
      expect(Array.isArray(ctx.input_keys)).toBe(true)
      expect(Array.isArray(ctx.output_keys)).toBe(true)
      expect(typeof ctx.applied).toBe('boolean')
    }
  })

  it('reports skip_reason when a step is a no-op', () => {
    vi.stubEnv('VITE_V5_STATE_DEBUG', 'true')
    // Conversational turn with no analysis_ready → step 4 skips with reason
    const conversational = {
      turn_id: 't2',
      assistant_text: 'hi',
      blocks: [],
      stage_indicator: { stage: 'ideate', confidence: 'high', source: 'inferred' },
    } as unknown as OlumiResponse
    applyV5State(conversational, makeStore())
    const step4 = (infoSpy.mock.calls as unknown[][])
      .filter((c) => c[0] === '[v5-state]')
      .map((c) => c[1] as { step_number: number; skip_reason?: string; applied: boolean })
      .find((c) => c.step_number === 4)
    expect(step4).toBeDefined()
    expect(step4!.applied).toBe(false)
    expect(step4!.skip_reason).toBe('missing_on_conversational_turn')
  })
})

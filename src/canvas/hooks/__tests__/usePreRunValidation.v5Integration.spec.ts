/**
 * Integration guard for the V5 analysis_ready → pre-analysis readiness chain.
 *
 * Context: CEE v0.8.1+ sends `analysis_ready` on the V5 response; the V5
 * applicator writes it to the canvas store. When the payload says
 * status === 'ready' with all options ready, the pre-analysis panel must NOT
 * render an OPTIONS_NEED_MAPPING blocker, and no blocker message may contain
 * the decision node label (which a broken legacy fallback in
 * validateOptions used to surface when ceeAnalysisReady was null).
 *
 * This test exercises the full applyV5State → captured payload → validateBeforeRun
 * path so a regression at either end is caught.
 */
import { describe, it, expect, vi } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'
import type { Node } from '@xyflow/react'

import { applyV5State, type V5ApplicatorStore } from '../../../v5/applyV5State'
import { validateBeforeRun } from '../usePreRunValidation'

function makeApplicatorStore(): {
  store: V5ApplicatorStore
  setCeeAnalysisReady: ReturnType<typeof vi.fn>
} {
  const setCeeAnalysisReady = vi.fn()
  return {
    store: {
      setCurrentStage: vi.fn(),
      updateNode: vi.fn(),
      updateEdgeData: vi.fn(),
      setRunMeta: vi.fn(),
      setCeeAnalysisReady,
      nodes: [],
      edges: [],
    },
    setCeeAnalysisReady,
  }
}

describe('applyV5State → usePreRunValidation integration', () => {
  it('populated analysis_ready → no OPTIONS_NEED_MAPPING, no decision label leakage', () => {
    const { store, setCeeAnalysisReady } = makeApplicatorStore()

    applyV5State(
      {
        response_version: 2,
        assistant_text: '',
        blocks: [],
        suggested_actions: [],
        insights: [],
        stage_indicator: 'analyse',
        analysis_ready: {
          status: 'ready',
          goal_node_id: 'goal-1',
          options: [
            {
              id: 'opt-a',
              label: 'Option A',
              status: 'ready',
              interventions: { 'factor-1': { value: 1 } },
            },
          ],
        },
      } as unknown as OlumiResponse,
      store,
    )

    expect(setCeeAnalysisReady).toHaveBeenCalledTimes(1)
    const analysisReady = setCeeAnalysisReady.mock.calls[0][0]

    const decisionLabel = 'Engineering Hiring Decision'
    const nodes = [
      { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Goal' } },
      { id: 'dec-1', type: 'decision', position: { x: 0, y: 0 }, data: { kind: 'decision', label: decisionLabel } },
      { id: 'opt-a', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Option A' } },
      { id: 'factor-1', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Factor 1' } },
    ] as unknown as Node[]

    const result = validateBeforeRun('goal-1', nodes, [], analysisReady)

    expect(result.blockers.some((b) => b.code === 'OPTIONS_NEED_MAPPING')).toBe(false)
    for (const blocker of result.blockers) {
      expect(blocker.message).not.toContain(decisionLabel)
    }
  })
})

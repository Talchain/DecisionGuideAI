/**
 * Seamlessness R2 — V5 server-applied graph_patch blocks fire the
 * applied-edit pulse (wiring only; behaviour covered by
 * appliedEditPulse.spec.ts). V5 patches arrive already applied — the exact
 * "AI edited your graph silently" moment R2 exists for.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OlumiResponse } from '@talchain/schemas/boundary'

const { pulseMock } = vi.hoisted(() => ({ pulseMock: vi.fn() }))
vi.mock('../../canvas/utils/appliedEditPulse', () => ({
  pulseAppliedTargets: pulseMock,
  __resetAppliedEditPulseForTests: vi.fn(),
  PULSE_COALESCE_MS: 100,
  PULSE_DURATION_MS: 2000,
}))

import { applyV5State, type V5ApplicatorStore } from '../applyV5State'

function baseResponse(overrides: Partial<OlumiResponse> = {}): OlumiResponse {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'frame',
    ...overrides,
  }
}

function makeStore(
  nodes: V5ApplicatorStore['nodes'] = [],
  edges: V5ApplicatorStore['edges'] = [],
): V5ApplicatorStore {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    setGoalConstraints: vi.fn(),
    backfillGoalThreshold: vi.fn(),
    nodes,
    edges,
  }
}

const factorNode = { id: 'node-1', data: { label: 'Factor', observedState: {} } } as any
const anEdge = { id: 'edge-1', source: 'node-1', target: 'node-2', data: {} } as any

beforeEach(() => {
  pulseMock.mockClear()
})

describe('applyV5State — applied-edit pulse wiring', () => {
  it('pulses ONCE with the union of applied node and edge targets', () => {
    const store = makeStore([factorNode], [anEdge])
    applyV5State(
      baseResponse({
        blocks: [
          {
            type: 'graph_patch',
            status: 'applied',
            operation: 'set_factor_value',
            target_id: 'node-1',
            after: { value: 42 },
          } as any,
          {
            type: 'graph_patch',
            status: 'applied',
            operation: 'adjust_edge_strength',
            target_id: 'edge-1',
            after: { weight: 0.8 },
          } as any,
        ],
      }),
      store,
    )
    expect(pulseMock).toHaveBeenCalledTimes(1)
    const arg = pulseMock.mock.calls[0][0]
    expect(arg.nodeIds).toEqual(['node-1'])
    expect(arg.edgeIds).toEqual(['edge-1'])
  })

  it('does not pulse when no graph_patch block actually applied', () => {
    const store = makeStore([factorNode], [])
    applyV5State(
      baseResponse({
        blocks: [
          // status not 'applied' → skipped by the applicator → no pulse
          {
            type: 'graph_patch',
            status: 'proposed',
            operation: 'set_factor_value',
            target_id: 'node-1',
            after: { value: 42 },
          } as any,
          // applied but target missing → deferred, not applied → no pulse
          {
            type: 'graph_patch',
            status: 'applied',
            operation: 'set_factor_value',
            target_id: 'ghost',
            after: { value: 1 },
          } as any,
        ],
      }),
      store,
    )
    expect(pulseMock).not.toHaveBeenCalled()
  })
})

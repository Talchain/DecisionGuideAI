/**
 * Cross-boundary integration test: AI add_option patch → reconciler → V2 request.
 *
 * This test exercises the full path that broke in the original bug:
 *   1. Start with a graph from a real draft (analysisReady populated, options on canvas).
 *   2. Apply an `add_option` graph_patch via applyAutoApplyPatch (the same code that
 *      runs in production when CEE responds with an add_option tool call).
 *   3. Build the V2 request from the resulting state.
 *   4. Assert: every option in the request has non-empty interventions, including
 *      the newly added one whose interventions live on node.data.interventions.
 *
 * Distinct from the unit tests in adapter.spec.ts: those isolate the reconciler
 * contract; this test proves the full handoff from patch acceptance to V2 request
 * works at the boundary.
 *
 * Module isolation: this file mocks the canvas store *only* for itself. The mock
 * is module-scoped via vi.mock and does not leak into adapter.spec.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Node, Edge } from '@xyflow/react'

import { applyAutoApplyPatch } from '../../../../canvas/conversation/utils/applyPatch'
import { buildV2RequestFromAnalysisReady } from '../adapter'
import type { GraphPatchBlock } from '../../../../canvas/conversation/types'
import type { CEEAnalysisReady } from '../../../cee/types'

// ---------------------------------------------------------------------------
// Mock canvas store — minimal surface required by applyAutoApplyPatch
// ---------------------------------------------------------------------------

let storeNodes: any[] = []
let storeEdges: any[] = []

vi.mock('../../../../canvas/store', () => ({
  useCanvasStore: Object.assign(vi.fn(), {
    getState: () => ({
      nodes: storeNodes,
      edges: storeEdges,
      outcomeNodeId: 'goal_1',
      ceeAnalysisReady: null,
      applyLayout: vi.fn(() => Promise.resolve()),
      setPendingLayout: vi.fn(),
      setOutcomeNode: vi.fn(),
      currentScenarioId: null,
      pushHistory: vi.fn(),
      beginExternalGraphMutation: vi.fn(),
      endExternalGraphMutation: vi.fn(),
    }),
    setState: vi.fn((update: any) => {
      if (update.nodes) storeNodes = update.nodes
      if (update.edges) storeEdges = update.edges
    }),
  }),
}))

vi.mock('../../../../canvas/store/scenarios', () => ({
  saveAutosave: vi.fn(),
}))

// ---------------------------------------------------------------------------

function consoleWarnSpyFor(test: () => void) {
  const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    test()
    return spy.mock.calls
  } finally {
    spy.mockRestore()
  }
}

describe('cross-boundary: add_option patch → reconcile → V2 request', () => {
  beforeEach(() => {
    // Seed the store with a drafted state: 1 goal, 2 factors, 1 original option
    // (whose interventions live ONLY on analysisReady, mirroring production where
    // backfillInterventionsOntoOptionNodes does not run on raw drafts).
    storeNodes = [
      { id: 'goal_1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Goal' } },
      { id: 'fac_a', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Factor A' } },
      { id: 'fac_b', type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Factor B' } },
      { id: 'opt_original', type: 'option', position: { x: 0, y: 0 }, data: { kind: 'option', label: 'Original' } },
    ]
    storeEdges = [
      { id: 'e_a', source: 'fac_a', target: 'goal_1', data: { weight: 0.5, direction: 'positive', beliefExists: 0.8 } },
      { id: 'e_b', source: 'fac_b', target: 'goal_1', data: { weight: 0.5, direction: 'positive', beliefExists: 0.8 } },
    ]
  })

  it('AI add_option op carries interventions through patch acceptance into the V2 request', () => {
    // The drafted-graph snapshot — analysisReady has the original option's interventions.
    const analysisReady: CEEAnalysisReady = {
      goal_node_id: 'goal_1',
      options: [
        {
          id: 'opt_original',
          label: 'Original',
          status: 'ready',
          interventions: {
            fac_a: { value: 0.8, source: 'brief_extraction' },
            fac_b: { value: -0.3, source: 'brief_extraction' },
          },
        },
      ],
    }

    // Simulate CEE's add_option response: a graph_patch with one add_node op
    // whose data carries `interventions`. This is exactly the shape buildNode in
    // applyPatch.ts spreads into node.data via `...rest`.
    const patchBlock: GraphPatchBlock = {
      block_type: 'graph_patch',
      auto_apply: true,
      operations: [
        {
          op: 'add_node',
          target_id: 'opt_added',
          data: {
            kind: 'option',
            label: 'AI Added',
            interventions: { fac_a: 0.5, fac_b: 0.2 },
          },
        },
      ],
    }

    // Apply the patch through the production code path.
    const calls = consoleWarnSpyFor(() => {
      applyAutoApplyPatch(patchBlock)
    })
    void calls

    // The store should now hold both option nodes; the new one must carry
    // node.data.interventions populated by buildNode's `...rest` spread.
    const optionNodes = storeNodes.filter((n) => n.data?.kind === 'option')
    expect(optionNodes).toHaveLength(2)
    const added = optionNodes.find((n) => n.id === 'opt_added')
    expect(added?.data?.interventions).toEqual({ fac_a: 0.5, fac_b: 0.2 })

    // Build the V2 request from the post-patch state.
    // Note: analysisReady was NOT refreshed by the patch (mirrors the bug — CEE
    // does not always attach a fresh analysis_ready to add_option blocks).
    const v2WarnCalls = consoleWarnSpyFor(() => {
      const { request } = buildV2RequestFromAnalysisReady(
        storeNodes as Node[],
        storeEdges as Edge[],
        analysisReady,
        undefined,
        'goal_1',
      )

      // The cross-boundary invariant: BOTH options reach PLoT with non-empty interventions.
      expect(request.options).toHaveLength(2)
      const original = request.options.find((o) => o.id === 'opt_original')
      const newOption = request.options.find((o) => o.id === 'opt_added')

      expect(original?.interventions).toEqual({ fac_a: 0.8, fac_b: -0.3 })
      expect(newOption?.interventions).toEqual({ fac_a: 0.5, fac_b: 0.2 })
    })

    // Observability: exactly one fallback warning fired (for opt_added only).
    const fallbackWarnings = v2WarnCalls.filter((args) =>
      typeof args[0] === 'string' && args[0].includes('reconcileOptions: backfilled'),
    )
    expect(fallbackWarnings).toHaveLength(1)
    expect(fallbackWarnings[0][0]).toContain('opt_added')
  })
})

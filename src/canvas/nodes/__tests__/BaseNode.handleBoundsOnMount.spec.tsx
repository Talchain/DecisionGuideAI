/**
 * ⭐⭐ EVERY MOUNTED NODE REGISTERS ITS HANDLE BOUNDS — WITHOUT THIS THE CANVAS
 * DRAWS NO EDGES AT ALL.
 *
 * ── THE DEFECT THIS PINS, MEASURED ON THE DEPLOYED BUILD ──────────────────
 * React Flow positions an edge from `node.internals.handleBounds`. It fills
 * that in when it measures a node — and if the handles are not in the DOM at
 * that moment, `getHandleBounds` returns null, `handleBounds` stays undefined,
 * and `getEdgePosition` then returns null for EVERY edge touching that node. So
 * `EdgeWrapper` renders nothing. Silently: no warning, no error, no fallback,
 * and `measured` is still populated so the node looks perfectly healthy.
 *
 * Driven on deployed `a0587e0d` as a guest, on a saved model:
 *
 *   nodes handed to React Flow ....... 14      DOM `.react-flow__node` ... 14
 *   edges handed to React Flow ....... 22      DOM `.react-flow__edge` ...  0
 *   store `edgeLookup.size` .......... 22      `nodesInitialized` ....... true
 *   nodes with `handleBounds` .......... 0  of 14
 *
 * Pushing `updateNodeInternals` for the 14 mounted nodes took handleBounds to
 * 14 of 14 and all 22 edges appeared immediately. The model's entire causal
 * structure — the thing that makes it a reasoning model rather than a list of
 * boxes — was invisible.
 *
 * The one existing `updateNodeInternals` call lived inside `handleExpandToggle`,
 * so bounds were registered only for a node whose chevron a user clicked.
 *
 * ⚠ WHY THIS IS A UNIT PIN AND NOT A RENDERED-EDGE ASSERTION. jsdom has no
 * layout: every `getBoundingClientRect` is zero, so React Flow cannot compute
 * real handle bounds here and an "edges appear" test would be measuring the
 * test environment, not the fix. What is checkable — and what actually broke —
 * is whether the node ASKS to be measured. The rendered-edge half of this claim
 * belongs to a browser drive on the deployed build, and was done that way.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'

const { updateNodeInternals } = vi.hoisted(() => ({ updateNodeInternals: vi.fn() }))

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...(actual as object),
    Handle: () => null,
    useUpdateNodeInternals: () => updateNodeInternals,
  }
})

vi.mock('../../store', () => {
  const state = {
    edges: [],
    nodes: [{ id: 'node-a' }],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    editedSinceRunNodeIds: new Set(),
    analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    ceeAnalysisReady: null,
    lodActive: false,
    viewMode: 'expert',
    olumiAttention: null,
    selectNodeWithoutHistory: vi.fn(),
  }
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(state))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

const baseProps = {
  id: 'node-a',
  type: 'decision',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  data: { label: 'Should we hire?', type: 'decision' },
}

const renderNode = (props: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <DecisionNode {...({ ...baseProps, ...props } as never)} />
    </ReactFlowProvider>,
  )

// The registration is deferred by one animation frame so the commit can settle
// and the handles are in the DOM before React Flow re-measures.
async function flushFrame() {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BaseNode — handle bounds are registered on mount', () => {
  it('asks React Flow to re-measure this node, by id, without any user interaction', async () => {
    renderNode()
    // Precondition: nothing was clicked. The old call site was the chevron
    // handler, so a test that interacted first would pass against the defect.
    await flushFrame()

    expect(updateNodeInternals).toHaveBeenCalledWith('node-a')
  })

  it('registers for the id it was actually given, not a hard-coded one', async () => {
    renderNode({ id: 'node-zebra' })
    await flushFrame()

    expect(updateNodeInternals).toHaveBeenCalledWith('node-zebra')
    expect(updateNodeInternals).not.toHaveBeenCalledWith('node-a')
  })

  // ⚠ THE OPPOSITE HARM. `updateNodeInternals` driven per-render is a known
  // starvation source in this codebase (`readinessStore.churnStarvation.spec.ts`
  // records a ResizeObserver → updateNodeInternals stack). Registering once per
  // mounted node is bounded by the node count; re-measurement after that is the
  // ResizeObserver's job. A fix for invisible edges must not buy them with a
  // render loop.
  it('registers ONCE per node, not on every render', async () => {
    const { rerender } = renderNode()
    await flushFrame()
    expect(updateNodeInternals).toHaveBeenCalledTimes(1)

    for (let i = 0; i < 5; i++) {
      rerender(
        <ReactFlowProvider>
          <DecisionNode {...({ ...baseProps, selected: i % 2 === 0 } as never)} />
        </ReactFlowProvider>,
      )
    }
    await flushFrame()

    expect(updateNodeInternals).toHaveBeenCalledTimes(1)
  })

  it('cancels the pending frame on unmount rather than measuring a gone node', async () => {
    const { unmount } = renderNode()
    unmount()
    await flushFrame()

    expect(updateNodeInternals).not.toHaveBeenCalled()
  })
})

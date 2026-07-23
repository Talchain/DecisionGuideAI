/**
 * BaseNode — top-right corner STACK (Codex P1-5).
 *
 * The sensitivity-rank badge and the on-canvas coaching marker both used to
 * render at `absolute -top-2 -right-2 z-10` with identical z, so a ranked node
 * that also had a coaching item drew the rank OVER the coaching marker (Paul's
 * screenshot: the "#1" slot obscured the coaching badge). The fix routes both
 * through ONE absolutely-positioned flex container that owns the corner; the
 * two render as static flex siblings, so they can no longer occupy the same
 * point.
 *
 * These pins assert STRUCTURE (jsdom cannot measure pixels — see the honesty
 * note on the non-overlap test):
 *   - both present  → both rendered, inside the shared stack, rank first, and
 *                     neither child carries its own absolute/offset classes
 *                     (the layout-relevant signal that they can't self-collide)
 *   - each alone    → renders in its place inside the stack
 *   - click-through → the coaching button's onClick still fires with the rank
 *                     badge present (it is a sibling, never covered)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// Hoisted so the vi.mock factory (also hoisted) can close over these spies.
const { selectNodeWithoutHistory, setShowInspectorPanel } = vi.hoisted(() => ({
  selectNodeWithoutHistory: vi.fn(),
  setShowInspectorPanel: vi.fn(),
}))

vi.mock('../../store', () => {
  const state = {
    edges: [],
    nodes: [],
    results: { status: 'complete', report: null },
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
    selectNodeWithoutHistory,
    setShowInspectorPanel,
  }
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(state))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})

// sensitivityRank drives the rank badge; toggled per test.
let sensitivityRank: number | null = null
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
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

function makeItem(overrides: Partial<GuidanceItem> = {}): GuidanceItem {
  return {
    item_id: 'item-1',
    category: 'should_fix',
    source: 'structural',
    title: 'Review this node',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
    target_object: { type: 'node', id: 'node-a' },
    ...overrides,
  }
}

const renderNode = () =>
  render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as never)} />
    </ReactFlowProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  sensitivityRank = null
  useGuidanceStore.getState().clearGuidanceItems()
})

describe('BaseNode — top-right corner stack (rank + coaching)', () => {
  it('BOTH present: rank and coaching render inside ONE stack, rank first, no overlapping offsets', () => {
    sensitivityRank = 1
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderNode()

    const stack = screen.getByTestId('node-corner-stack-node-a')
    const rank = screen.getByTestId('sensitivity-rank-node-a')
    const coaching = screen.getByTestId('node-coaching-marker-node-a')

    // Both live inside the single positioned container.
    expect(stack).toContainElement(rank)
    expect(stack).toContainElement(coaching)

    // Deterministic order: rank FIRST, coaching beside it.
    const kids = Array.from(stack.children)
    expect(kids[0]).toBe(rank)
    expect(kids[1]).toBe(coaching)

    // The STACK owns the corner + z; children carry NO absolute/offset of their
    // own, so they cannot independently land on the same point. jsdom cannot
    // prove pixels — this asserts the layout-relevant class contract that makes
    // a same-corner overlap structurally impossible (true-pixel spacing is a
    // browser concern, verified separately).
    expect(stack.className).toContain('absolute')
    expect(stack.className).toContain('-top-2')
    expect(stack.className).toContain('-right-2')
    expect(stack.className).toContain('z-10')
    expect(stack.className).toContain('flex')
    expect(rank.className).not.toContain('absolute')
    expect(coaching.className).not.toContain('absolute')
    expect(coaching.className).not.toContain('-right-2')
  })

  it('RANK alone: rank badge renders in the stack, no coaching marker', () => {
    sensitivityRank = 2
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    expect(stack).toContainElement(screen.getByTestId('sensitivity-rank-node-a'))
    expect(screen.queryByTestId('node-coaching-marker-node-a')).not.toBeInTheDocument()
  })

  it('COACHING alone: coaching marker renders in the stack, no rank badge', () => {
    sensitivityRank = null
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    expect(stack).toContainElement(screen.getByTestId('node-coaching-marker-node-a'))
    expect(screen.queryByTestId('sensitivity-rank-node-a')).not.toBeInTheDocument()
  })

  it('CLICK-THROUGH: coaching onClick still fires with the rank badge present', () => {
    sensitivityRank = 1
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'the-item' })])
    renderNode()

    // Rank present alongside — the coaching button must remain clickable.
    expect(screen.getByTestId('sensitivity-rank-node-a')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('node-coaching-marker-node-a'))

    expect(selectNodeWithoutHistory).toHaveBeenCalledWith('node-a')
    expect(setShowInspectorPanel).toHaveBeenCalledWith(true)
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('the-item')
  })
})

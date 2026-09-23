/**
 * "WORTH REVIEWING" in the card corner — one aggregated marker (locked Canvas
 * design, 23 Sep 2026; rules in `nodes/shared/nodeAttention.ts`).
 *
 * Pins, on the REAL BaseNode (the plan is supplied through its hook seam):
 *   - a node in the plan shows ONE marker whose accessible name lists its reasons;
 *   - the marker TAKES THE RANK BADGE'S SLOT — never a fourth stack sibling
 *     (`BaseNode.cornerStack.spec.tsx` pins the stack's layout);
 *   - a ranked node outside the plan keeps the rank badge exactly as before;
 *   - a node with no reasons shows nothing new;
 *   - at the far rung (body hidden) the marker gives way to a scalable card
 *     outline, and there is no outline at reading zoom.
 */
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
 * The edited-since-run dot (Codex P2) was a third, independently-positioned
 * element in this same corner (`-top-1 -right-1`, default z) — the coaching
 * marker at `-top-2 -right-2 z-10` drew fully OVER it. It is now folded into the
 * same stack as a static middle child (rank · edited-dot · coaching), so the
 * same non-overlap guarantee covers all three.
 *
 * These pins assert STRUCTURE (jsdom cannot measure pixels — see the honesty
 * note on the non-overlap test):
 *   - both present  → both rendered, inside the shared stack, rank first, and
 *                     neither child carries its own absolute/offset classes
 *                     (the layout-relevant signal that they can't self-collide)
 *   - all three     → rank · edited-dot · coaching, three distinct siblings in
 *                     order, the dot carrying no absolute/offset of its own
 *   - each alone    → renders in its place inside the stack
 *   - click-through → the coaching button's onClick still fires with the rank
 *                     badge (and with the edited dot) present — it is a sibling,
 *                     never covered
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ComponentProps } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// Hoisted so the vi.mock factory (also hoisted) can close over these spies.
// `editedNodeIds` is a mutable set the store mock reads for isEditedSinceRun; a
// test opts a node in via editedNodeIds.add(id) and beforeEach clears it.
const { selectNodeWithoutHistory, editedNodeIds, lodRungRef, attention } = vi.hoisted(() => ({
  selectNodeWithoutHistory: vi.fn(),
  editedNodeIds: new Set<string>(),
  lodRungRef: { value: 'full' as 'full' | 'quiet' | 'line' },
  attention: { reasons: null as null | Array<{ kind: string; priority: number; label: string }> },
}))

vi.mock('../../hooks/useNodeAttention', () => ({ useNodeAttention: () => attention.reasons }))

vi.mock('../../store', () => {
  const state = {
    edges: [],
    // `openNodeInspector` fail-closes on a node that is not on the graph, so
    // the double must actually contain the node under test.
    nodes: [{ id: 'node-a' }],
    results: { status: 'complete', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    editedSinceRunNodeIds: editedNodeIds,
    analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    ceeAnalysisReady: null,
    get lodRung() { return lodRungRef.value },
    viewMode: 'expert',
    selectNodeWithoutHistory,
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
      <DecisionNode {...(baseProps as unknown as ComponentProps<typeof DecisionNode>)} />
    </ReactFlowProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  sensitivityRank = null
  editedNodeIds.clear()
  useGuidanceStore.getState().clearGuidanceItems()
})


function marker() {
  return screen.queryByTestId('attention-marker-node-a')
}

beforeEach(() => {
  attention.reasons = null
  lodRungRef.value = 'full'
  sensitivityRank = null
  editedNodeIds.clear()
  useGuidanceStore.getState().setGuidanceItems([])
})

const REASONS = [
  { kind: 'decision_flip', priority: 1, label: 'A turning point was found: this could change the decision' },
  { kind: 'top_driver', priority: 3, label: 'Driver #1 in this analysis' },
]

describe('BaseNode — the "Worth reviewing" marker', () => {
  it('a node in the attention plan shows ONE marker naming its reasons', () => {
    attention.reasons = REASONS
    renderNode()
    const m = marker()
    expect(m).not.toBeNull()
    expect(m!.getAttribute('aria-label')).toBe(
      'Worth reviewing: A turning point was found: this could change the decision · Driver #1 in this analysis',
    )
    expect(screen.getAllByTestId(/^attention-marker-/)).toHaveLength(1)
  })

  it('it TAKES the rank badge slot: a ranked node in the plan shows the marker, not the badge — stack still three at most', () => {
    attention.reasons = REASONS
    sensitivityRank = 1
    editedNodeIds.add('node-a')
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderNode()
    expect(screen.queryByTestId('sensitivity-rank-node-a')).toBeNull()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    expect(stack).toContainElement(marker())
    expect(Array.from(stack.children)).toHaveLength(3)
  })

  it('CONTROL: a ranked node OUTSIDE the plan keeps the rank badge and shows no marker', () => {
    sensitivityRank = 2
    renderNode()
    expect(screen.getByTestId('sensitivity-rank-node-a')).toBeTruthy()
    expect(marker()).toBeNull()
  })

  it('CONTROL: no reasons, no rank → nothing new in the corner', () => {
    renderNode()
    expect(marker()).toBeNull()
  })

  it('click opens the EXISTING inspector for this node (select first)', () => {
    attention.reasons = REASONS
    renderNode()
    fireEvent.click(marker()!)
    expect(selectNodeWithoutHistory).toHaveBeenCalledWith('node-a')
  })

  it('FAR RUNG: no tiny marker; the card carries a scalable warning outline instead', () => {
    attention.reasons = REASONS
    lodRungRef.value = 'line'
    renderNode()
    expect(marker()).toBeNull()
    const card = screen.getByRole('group', { name: /Should we hire\?/ })
    expect(card.className).toMatch(/ring-warning/)
  })

  it('CONTROL: at reading zoom there is no outline', () => {
    attention.reasons = REASONS
    renderNode()
    const card = screen.getByRole('group', { name: /Should we hire\?/ })
    expect(card.className).not.toMatch(/ring-warning/)
  })
})

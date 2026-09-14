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
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'
import { sensitivityRankBadgeAccessibleName } from '../shared/metricVocabulary'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

// Hoisted so the vi.mock factory (also hoisted) can close over these spies.
// `editedNodeIds` is a mutable set the store mock reads for isEditedSinceRun; a
// test opts a node in via editedNodeIds.add(id) and beforeEach clears it.
const { selectNodeWithoutHistory, editedNodeIds } = vi.hoisted(() => ({
  selectNodeWithoutHistory: vi.fn(),
  editedNodeIds: new Set<string>(),
}))

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
    lodRung: 'full',
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
      <DecisionNode {...(baseProps as never)} />
    </ReactFlowProvider>,
  )

beforeEach(() => {
  vi.clearAllMocks()
  sensitivityRank = null
  editedNodeIds.clear()
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

    /**
     * ⭐⭐ THE RANK BADGE MUST CARRY ITS OWN MEANING, AND NOT VIA `title`.
     *
     * It had `title="Key driver #N: ranked by influence…"` sitting on the SAME
     * element as `pointerEvents: 'none'`. A `title` needs a hover the browser
     * never raises there, so the tooltip could not fire — while reading, in
     * source and in review, exactly like an explanation already provided. A
     * screen reader got the bare string "#1".
     *
     * ⛔ ASSERTED BOTH WAYS ON PURPOSE. Only checking the accessible name would
     * stay green if someone re-added the dead `title` beside it, and the point
     * is that a title on this element is NOT a way to explain the badge.
     */
    expect(rank).toHaveAccessibleName(/^Key driver #\d+: one of the factors the result is most sensitive to$/)
    expect(rank).not.toHaveAttribute('title')

    /**
     * ⭐⭐ THE OTHER HALF OF THE COUPLING, AND NOT REDUNDANT WITH THE LITERAL
     * ABOVE. `metricVocabulary.spec.ts` proves the builder AGREES with the
     * legend row; it cannot see this component dropping the builder and
     * re-typing the sentence, which is how the defect arrived (a comment
     * claiming a derivation with no import behind it). This binds the RENDERED
     * name to the builder's output for THIS number, so a re-inlined literal
     * REDs here while the register guard stays green. The literal stays — it is
     * the corpus that notices a wrong sentence (CLAUDE.md trap 12d).
     */
    // `sensitivityRank` is 1 in this test's fixture — bound by identity, not by
    // a pattern another rank could satisfy.
    expect(rank).toHaveAccessibleName(sensitivityRankBadgeAccessibleName(1))

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

  it('ALL THREE present: rank, edited-dot and coaching are distinct siblings in order, none absolute', () => {
    sensitivityRank = 1
    editedNodeIds.add('node-a')
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderNode()

    const stack = screen.getByTestId('node-corner-stack-node-a')
    const rank = screen.getByTestId('sensitivity-rank-node-a')
    const edited = screen.getByTestId('edited-since-run-node-a')
    const coaching = screen.getByTestId('node-coaching-marker-node-a')

    // Three distinct children, all inside the single positioned stack.
    expect(stack).toContainElement(rank)
    expect(stack).toContainElement(edited)
    expect(stack).toContainElement(coaching)

    // Deterministic order: rank · edited-dot · coaching (smallest in the middle).
    const kids = Array.from(stack.children)
    expect(kids).toHaveLength(3)
    expect(kids[0]).toBe(rank)
    expect(kids[1]).toBe(edited)
    expect(kids[2]).toBe(coaching)

    // The edited dot is a static flex child — no absolute/offset of its own, so
    // it can no longer be drawn under the coaching marker (the P2 defect).
    expect(edited.className).not.toContain('absolute')
    expect(edited.className).not.toContain('-right-1')
    expect(edited.className).not.toContain('-top-1')
  })

  it('EDITED alone: the edited-since-run dot renders in the stack, no rank or coaching', () => {
    editedNodeIds.add('node-a')
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    expect(stack).toContainElement(screen.getByTestId('edited-since-run-node-a'))
    expect(screen.queryByTestId('sensitivity-rank-node-a')).not.toBeInTheDocument()
    expect(screen.queryByTestId('node-coaching-marker-node-a')).not.toBeInTheDocument()
  })

  it('CLICK-THROUGH with edited dot present: coaching onClick still fires', () => {
    editedNodeIds.add('node-a')
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'edit-item' })])
    renderNode()

    expect(screen.getByTestId('edited-since-run-node-a')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('node-coaching-marker-node-a'))
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('edit-item')
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
    let inspectorOpened = false
    const onOpen = () => { inspectorOpened = true }
    window.addEventListener('olumi:open-full-inspector', onOpen)
    sensitivityRank = 1
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'the-item' })])
    renderNode()

    // Rank present alongside — the coaching button must remain clickable.
    expect(screen.getByTestId('sensitivity-rank-node-a')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('node-coaching-marker-node-a'))

    // The marker used to write `showInspectorPanel`, a store field with zero
    // render consumers — so this assertion passed while the control opened
    // nothing. It now asserts the LIVE seam: select, then raise the inspector
    // via the event ReactFlowGraph actually listens for.
    expect(selectNodeWithoutHistory).toHaveBeenCalledWith('node-a')
    expect(inspectorOpened).toBe(true)
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('the-item')
    window.removeEventListener('olumi:open-full-inspector', onOpen)
  })
})

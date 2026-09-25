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
 *
 * ⭐ Locked Canvas design (23 Sep 2026), ED 02:31Z D1a: "RETIRE the Key-driver
 * badge once the body driver line is present." The rank is now stated once, by
 * the factor card's driver line ("Driver N of M analysed"), never in this
 * corner. ITS SLOT is held by the ONE "Worth reviewing" marker
 * (`attention-marker-<id>`, spec §2, ED 02:31Z D1b), so every structural pin
 * below is re-pointed from the rank badge to that marker — the same slot, the
 * same non-overlap contract (marker · edited-dot · coaching) — and each case
 * that set a rank now also asserts the retired badge does NOT render.
 *
 * The attention PLAN (which elements are marked, and why) is pure and pinned in
 * `shared/__tests__/nodeAttention.spec.ts`; this file is about the corner's
 * geometry, so `useNodeAttention` is stubbed to a marked / unmarked answer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CANVAS_CORNER_STACK_CLASSES } from '../shared/canvasGlyphScale'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'
import { sensitivityRankBadgeLabel } from '../shared/metricVocabulary'
import { attentionSentence, type AttentionReason } from '../shared/nodeAttention'
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

// sensitivityRank used to drive the rank badge; it is still toggled per test so
// each case proves the RETIRED badge stays gone even when a rank is present.
let sensitivityRank: number | null = null

// The "Worth reviewing" marker now holds the rank's slot. Stubbed per test (see
// the header): `attentionMarked` toggles whether this node is in the budgeted
// selection. The reason is a real plan reason's shape and wording.
const REASON: AttentionReason = {
  kind: 'fragile_link',
  order: 1,
  label: 'The comparison depends on a link from here. How sure are you of it?',
}
let attentionMarked = false
vi.mock('../shared/useNodeAttention', () => ({
  useNodeAttention: vi.fn(() =>
    attentionMarked
      ? { reasons: [REASON], marked: true, markedCount: 1, candidateCount: 1 }
      : { reasons: [], marked: false, markedCount: 0, candidateCount: 0 },
  ),
}))
/** The marker's one sentence — visible tooltip AND accessible name. */
const MARKER_SENTENCE = attentionSentence([REASON], { unconfirmedEstimate: false, marked: 1, candidates: 1 })
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
  attentionMarked = false
  editedNodeIds.clear()
  useGuidanceStore.getState().clearGuidanceItems()
})

describe('BaseNode — top-right corner stack (rank + coaching)', () => {
  it('BOTH present: the attention marker (the rank badge\'s slot) and coaching render inside ONE stack, marker first, no overlapping offsets', () => {
    // A rank IS present in the metadata — the retired badge must not come back.
    sensitivityRank = 1
    attentionMarked = true
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderNode()

    const stack = screen.getByTestId('node-corner-stack-node-a')
    const marker = screen.getByTestId('attention-marker-node-a')
    const coaching = screen.getByTestId('node-coaching-marker-node-a')

    // Locked Canvas design (23 Sep 2026), ED 02:31Z D1a: the Key-driver badge is
    // RETIRED — no test id, no word, no bare numeral, even with a rank present.
    expect(screen.queryByTestId('sensitivity-rank-node-a')).toBeNull()
    expect(stack.textContent).not.toContain(sensitivityRankBadgeLabel(1))
    expect(stack.textContent).not.toContain('#')

    // Both live inside the single positioned container.
    expect(stack).toContainElement(marker)
    expect(stack).toContainElement(coaching)

    /**
     * ⭐⭐ THE SLOT'S OCCUPANT MUST CARRY ITS OWN MEANING, AND NOT VIA `title`.
     *
     * The retired badge taught this: a `title` on a corner member read, in
     * source and review, like an explanation already provided, while it could
     * never fire. The marker explains itself through a focusable tooltip AND its
     * accessible name (ED 02:31Z: native title is not full-text recovery), built
     * ONCE by `attentionSentence` — so both are bound here by identity, and a
     * re-added `title` REDs.
     */
    expect(marker).toHaveAccessibleName(MARKER_SENTENCE)
    expect(marker.getAttribute('aria-label')!.startsWith('Worth reviewing:')).toBe(true)
    // The shared Tooltip blanks any native title (`title=""`) — so assert there
    // is no native-title TEXT, which is the explanation-by-title this rules out.
    expect(marker.getAttribute('title') ?? '').toBe('')

    // Deterministic order: the marker FIRST (the rank's old position), coaching beside it.
    const kids = Array.from(stack.children)
    expect(kids[0]).toBe(marker)
    expect(kids[1]).toBe(coaching)

    // The STACK owns the corner + z; children carry NO absolute/offset of their
    // own, so they cannot independently land on the same point. jsdom cannot
    // prove pixels — this asserts the layout-relevant class contract that makes
    // a same-corner overlap structurally impossible (true-pixel spacing is a
    // browser concern, verified separately).
    // ⚠ DERIVED FROM THE COMPONENT'S OWN CONSTANT, NOT A COPY OF IT. This read
    // `toContain('-top-2')` / `toContain('-right-2')` — the measuring stick,
    // not the property in this test's title. The `-top-2` half was an UNSCALED
    // 8px anchor holding counter-scaled content, which put the `Needs input`
    // pill in the card header at the settle zoom and nowhere at zoom >= 1.
    // Asserting the exported constant keeps the invariant that matters (the
    // stack owns the corner; its children carry no positioning) while letting
    // the anchor move in one place.
    expect(stack.className).toContain('absolute')
    expect(stack.className).toBe(CANVAS_CORNER_STACK_CLASSES)
    expect(stack.className).toContain('z-10')
    expect(stack.className).toContain('flex')
    expect(marker.className).not.toContain('absolute')
    expect(coaching.className).not.toContain('absolute')
    expect(coaching.className).not.toContain('-right-2')
  })

  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-11, DESIGN-GAP-AUDIT-20260924.md row 11; Paul
   * v3.1 pt14). This used to be "ALL THREE present" — marker, edited-dot,
   * coaching. The edited-since-run dot is REMOVED from the per-card corner
   * entirely: it duplicated the single graph-level stale cue
   * (`AnalysisStateCue`) the canvas already carries, and pt14 asks for ONE
   * overall analysis-state cue, not one repeated per card. `editedNodeIds`
   * below is now a no-op setup — kept to prove the removal is UNCONDITIONAL
   * (setting the store slice that used to drive the dot no longer puts
   * anything in the corner), not merely that this particular test stopped
   * asking for it.
   */
  it('marker and coaching are distinct siblings in order, none absolute — the edited-dot is gone even when the store says edited', () => {
    sensitivityRank = 1
    attentionMarked = true
    editedNodeIds.add('node-a')
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderNode()

    const stack = screen.getByTestId('node-corner-stack-node-a')
    // Locked Canvas design (23 Sep 2026): the marker holds the retired rank badge's slot.
    const marker = screen.getByTestId('attention-marker-node-a')
    const coaching = screen.getByTestId('node-coaching-marker-node-a')
    expect(screen.queryByTestId('sensitivity-rank-node-a')).toBeNull()
    // GAP-11: never rendered, even with `editedNodeIds` opted in above.
    expect(screen.queryByTestId('edited-since-run-node-a')).toBeNull()

    // Two distinct children, both inside the single positioned stack.
    expect(stack).toContainElement(marker)
    expect(stack).toContainElement(coaching)

    // Deterministic order: marker first, coaching beside it — unchanged by
    // the dot's removal since it always sat BETWEEN them.
    const kids = Array.from(stack.children)
    expect(kids).toHaveLength(2)
    expect(kids[0]).toBe(marker)
    expect(kids[1]).toBe(coaching)
    expect(marker.className).not.toContain('absolute')
  })

  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-11): "EDITED alone" used to render the dot and
   * nothing else. With the dot removed, opting a node into
   * `editedSinceRunNodeIds` alone now puts NOTHING in the corner — the stack
   * is empty, matching the "none of the five gates fire" case.
   */
  it('EDITED alone (store opts the node in): the corner stays EMPTY — the dot no longer reads that flag', () => {
    editedNodeIds.add('node-a')
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    expect(screen.queryByTestId('edited-since-run-node-a')).not.toBeInTheDocument()
    expect(screen.queryByTestId('sensitivity-rank-node-a')).not.toBeInTheDocument()
    expect(screen.queryByTestId('attention-marker-node-a')).not.toBeInTheDocument()
    expect(screen.queryByTestId('node-coaching-marker-node-a')).not.toBeInTheDocument()
    expect(stack.children).toHaveLength(0)
  })

  /**
   * ⛔ UPDATED 24 Sep 2026 (GAP-11): this used to prove coaching's onClick
   * fires with the edited dot present as a sibling. The dot is gone, so the
   * click-through property this protects is now fully covered by "CLICK-
   * THROUGH: coaching onClick still fires with the attention marker present"
   * below; this case is repurposed to keep proving `editedNodeIds` is inert.
   */
  it('CLICK-THROUGH with the store opted-in (no dot to be a sibling): coaching onClick still fires', () => {
    editedNodeIds.add('node-a')
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'edit-item' })])
    renderNode()

    expect(screen.queryByTestId('edited-since-run-node-a')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('node-coaching-marker-node-a'))
    expect(useGuidanceStore.getState().activeGuidanceItemId).toBe('edit-item')
  })

  // Locked Canvas design (23 Sep 2026), ED 02:31Z D1a: a rank ALONE no longer
  // puts anything in the corner — the badge is retired and the rank is stated by
  // the factor card's driver line. The stack is empty rather than holding it.
  it('RANK alone: the retired rank badge does NOT render — the corner stays empty', () => {
    sensitivityRank = 2
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    expect(screen.queryByTestId('sensitivity-rank-node-a')).not.toBeInTheDocument()
    expect(stack.textContent).not.toContain(sensitivityRankBadgeLabel(2))
    expect(stack.textContent).not.toContain('#2')
    expect(stack.children).toHaveLength(0)
    expect(screen.queryByTestId('node-coaching-marker-node-a')).not.toBeInTheDocument()
  })

  // The slot's new occupant, alone — the old "RANK alone" case at its new identity.
  it('ATTENTION alone: the "Worth reviewing" marker renders in the stack, no coaching marker', () => {
    attentionMarked = true
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    const marker = screen.getByTestId('attention-marker-node-a')
    expect(stack).toContainElement(marker)
    expect(Array.from(stack.children)).toEqual([marker])
    expect(screen.queryByTestId('node-coaching-marker-node-a')).not.toBeInTheDocument()
  })

  it('COACHING alone: coaching marker renders in the stack, no rank badge', () => {
    sensitivityRank = null
    useGuidanceStore.getState().setGuidanceItems([makeItem()])
    renderNode()
    const stack = screen.getByTestId('node-corner-stack-node-a')
    expect(stack).toContainElement(screen.getByTestId('node-coaching-marker-node-a'))
    expect(screen.queryByTestId('sensitivity-rank-node-a')).not.toBeInTheDocument()
    expect(screen.queryByTestId('attention-marker-node-a')).not.toBeInTheDocument()
  })

  it('CLICK-THROUGH: coaching onClick still fires with the attention marker (the rank\'s slot) present', () => {
    let inspectorOpened = false
    const onOpen = () => { inspectorOpened = true }
    window.addEventListener('olumi:open-full-inspector', onOpen)
    sensitivityRank = 1
    attentionMarked = true
    useGuidanceStore.getState().setGuidanceItems([makeItem({ item_id: 'the-item' })])
    renderNode()

    // Locked Canvas design (23 Sep 2026): the marker holds the retired badge's
    // slot, and it is a BUTTON now (it opens the inspector itself) — so the
    // coaching button beside it must still receive its own click.
    expect(screen.queryByTestId('sensitivity-rank-node-a')).toBeNull()
    expect(screen.getByTestId('attention-marker-node-a')).toBeInTheDocument()
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

/**
 * B3/B5 Model convergence.
 *
 * The legacy stack used to duplicate every entity and expose local-only edits.
 * The connected v2 outline is now the sole mounted route. Cross-panel section
 * requests front that route instead of reviving a hidden second editor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))
vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

const mockGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }
function getMockState() {
  return {
    nodes: mockGraph.nodes,
    edges: mockGraph.edges,
    updateNode: vi.fn(),
    updateEdge: vi.fn(),
    ceePipelineTrace: null,
    highlightedNodes: new Set<string>(),
    highlightedEdges: new Set<string>(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
    currentScenarioId: null,
    currentStage: null,
    graphEditedSinceLastRun: false,
    goalThreshold: null,
    goalThresholdRepresentation: null,
  }
}
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (state: unknown) => unknown) => selector(getMockState())),
    { getState: getMockState },
  ),
}))
vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ModelTabBody } from '../ModelTabBody'
import { useUIStore } from '../../../stores/uiStore'
import { MODEL_GROUP_IDS } from '../../model-tab-v2/types'

const NODES: Node[] = [
  {
    id: 'goal_margin',
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Protect gross margin' },
  },
  {
    id: 'fac_budget',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Budget',
      category: 'observable',
      observedState: { value: 0.5, source: 'cee_inference' },
    },
  },
] as Node[]
/**
 * ⚠ THE FIXTURE NEEDS A REAL RELATIONSHIP, and that is not decoration.
 *
 * The assertions below say "the row the user asked for is on screen". With an
 * empty edge list that sentence has no object: the row would be absent because
 * the model has none, not because the section is shut, and the spec would pass
 * or fail for a reason that has nothing to do with the deep link. Neither
 * endpoint is a decision/option node, so `getCausalEdges` keeps it and
 * `toModelRows` projects it into the `relationships` group with `id === edge.id`.
 */
const REL_ID = 'edge_budget_margin'
const EDGES: Edge[] = [
  {
    id: REL_ID,
    source: 'fac_budget',
    target: 'goal_margin',
    data: { type: 'causal', weight: 0.6 },
  },
] as unknown as Edge[]
const DEFAULT_PROPS = {
  showDebug: false,
  hasDiagnostics: false,
  diagnostics: null,
  hasTrim: false,
  effectiveCorrelationId: null,
  correlationMismatch: false,
  correlationIdHeader: null,
  robustness: null,
}

const scrollContexts: Element[] = []
let originalScrollIntoView: unknown

function renderTab() {
  return render(<ModelTabBody {...DEFAULT_PROPS} nodes={NODES} edges={EDGES} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGraph.nodes = NODES
  mockGraph.edges = EDGES
  scrollContexts.length = 0
  originalScrollIntoView = (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
  ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView =
    function (this: Element) { scrollContexts.push(this) }
  useUIStore.setState({ pendingModelTabSection: null })
})

afterEach(() => {
  if (originalScrollIntoView === undefined) {
    delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
  } else {
    ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView = originalScrollIntoView
  }
  useUIStore.setState({ pendingModelTabSection: null })
})

describe('the Model tab mounts one connected editor', () => {
  it('contains the v2 outline and no legacy stack or legacy sections', () => {
    renderTab()
    const tab = screen.getByTestId('model-tab')
    expect(tab.contains(screen.getByTestId('model-tab-v2-panel'))).toBe(true)
    expect(screen.queryByTestId('model-tab-v1-stack')).not.toBeInTheDocument()
    expect(screen.queryByTestId('model-goal-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('model-factors-section')).not.toBeInTheDocument()
    expect(screen.queryByTestId('model-relationships-section')).not.toBeInTheDocument()
  })

  it('keeps the connected Model filter as the sole search surface', () => {
    renderTab()
    expect(screen.getAllByRole('searchbox')).toHaveLength(1)
    expect(screen.getByRole('searchbox')).toHaveAttribute('data-testid', 'model-tab-v2-filter')
  })
})

describe('cross-panel section requests front the connected route', () => {
  /**
   * ⚠⚠ THIS SPEC USED TO PASS WHILE THE USER STARED AT A CLOSED DOOR.
   *
   * Its only assertions were that `scrollContexts` contained the section
   * element and that the store field had been drained. BOTH ARE TRUE OF A
   * COLLAPSED GROUP: `ModelOutline` renders the `<section>` wrapper regardless
   * of open state, so `document.querySelector('[data-testid="model-group-v2-
   * relationships"]')` resolves, `scrollIntoView` fires on it, and the request
   * clears — while `{group.open && …}` renders nothing inside. The user clicks
   * "See all 12 relationships in model tab ›", lands on a heading, and the
   * assistant's `applied[]` ledger records the gesture as successful.
   *
   * The wrapper is the wrong object. These assertions bind to a ROW.
   */

  /** Every group whose header currently reads open. The discriminator's object. */
  const openGroupIds = (): string[] =>
    MODEL_GROUP_IDS.filter(
      id =>
        screen.queryByTestId(`model-group-v2-${id}-toggle`)?.getAttribute('aria-expanded')
        === 'true',
    )

  it('PRECONDITION: the target section is SHUT and NON-EMPTY before the request', () => {
    renderTab()
    // Shut — so "the row is absent" below is closure, not an empty model...
    expect(
      screen.getByTestId('model-group-v2-relationships-toggle').getAttribute('aria-expanded'),
      'the outline no longer opens closed — this whole spec is then about nothing',
    ).toBe('false')
    // ...and non-empty, which the COLLAPSED header states for itself. Without
    // this the content assertion could pass vacuously against a model with no
    // relationships in it at all.
    expect(
      screen.getByTestId('model-group-v2-relationships-toggle').textContent,
      'the fixture projects no relationship row — the content assertion would have no object',
    ).toContain('1')
    expect(screen.queryByTestId(`model-row-v2-${REL_ID}`)).toBeNull()
  })

  it('OPENS the requested section, so the row the user asked for is on screen', async () => {
    renderTab()
    act(() => { useUIStore.getState().requestModelTabSection('relationships') })

    // THE LOAD-BEARING ASSERTION: content, not the wrapper. A section that
    // scrolls into view and renders nothing is the defect, not the fix.
    expect(
      screen.getByTestId(`model-row-v2-${REL_ID}`),
      'the requested section scrolled into view but rendered nothing inside it',
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('model-group-v2-relationships-toggle').getAttribute('aria-expanded'),
    ).toBe('true')
  })

  it('DISCRIMINATOR: ONLY the requested section opens', () => {
    // Without this, "open everything on any request" satisfies the assertion
    // above and restores the 1,817px dump #1275 existed to remove.
    renderTab()
    act(() => { useUIStore.getState().requestModelTabSection('relationships') })
    const opened = openGroupIds()
    expect(
      opened,
      `a section request may open only its own group; these opened: ${opened.join(', ')}`,
    ).toEqual(['relationships'])
  })

  it('the reader can still close what the deep link opened', () => {
    // The request is an EVENT, not a lock. If `open` were computed as
    // "requested OR user-opened" the group could never be shut again, and the
    // one control on the header would silently do nothing.
    renderTab()
    act(() => { useUIStore.getState().requestModelTabSection('relationships') })
    fireEvent.click(screen.getByTestId('model-group-v2-relationships-toggle'))
    expect(
      screen.getByTestId('model-group-v2-relationships-toggle').getAttribute('aria-expanded'),
    ).toBe('false')
    expect(screen.queryByTestId(`model-row-v2-${REL_ID}`)).toBeNull()
  })

  it('a REPEAT request re-opens a section the reader had closed', async () => {
    // The store drains to null after every request, so the same section
    // requested twice arrives as null → id → null → id. A fix that opened only
    // on a CHANGE of value would fire once and then go quiet.
    renderTab()
    act(() => { useUIStore.getState().requestModelTabSection('relationships') })
    fireEvent.click(screen.getByTestId('model-group-v2-relationships-toggle'))
    expect(screen.queryByTestId(`model-row-v2-${REL_ID}`)).toBeNull()

    act(() => { useUIStore.getState().requestModelTabSection('relationships') })
    expect(screen.getByTestId(`model-row-v2-${REL_ID}`)).toBeInTheDocument()
  })

  it('scrolls to the requested section and consumes the request', async () => {
    renderTab()
    act(() => { useUIStore.getState().requestModelTabSection('relationships') })
    const target = screen.getByTestId('model-group-v2-relationships')
    await waitFor(() => expect(scrollContexts).toContain(target))
    expect(useUIStore.getState().pendingModelTabSection).toBeNull()
  })

  it('does not scroll when no section is requested', async () => {
    renderTab()
    await Promise.resolve()
    expect(scrollContexts).toHaveLength(0)
  })

  it('an unrequested mount opens nothing (contrast control)', () => {
    // The counterpart to the discriminator: with no request in flight the
    // outline is still entirely shut, so "only relationships opened" above is a
    // statement about the request rather than about this fixture.
    renderTab()
    expect(openGroupIds()).toEqual([])
  })
})

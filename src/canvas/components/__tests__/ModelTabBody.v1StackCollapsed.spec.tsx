/**
 * The Model tab opens showing the v2 outline, with the v1 stack COLLAPSED —
 * present, mounted and expandable.
 *
 * ── WHAT THIS PINS, AND WHERE IT CAME FROM ──────────────────────────────────
 *
 * NOT a fixture. A fresh guest on a brand-new browser profile, entering as a
 * guest and drafting their own substantive brief, on deployed build
 * `d4b9f981`, was observed to receive TWO complete editors of the SAME model,
 * stacked:
 *
 *   1280×800, no analysis   dock body 669px, content 2991px  — 4.47 screens
 *   1440×900, no analysis   dock body 769px, content 3012px  — 3.92 screens
 *   1280×800, post-analysis dock body 669px, content 2882px  — 4.31 screens
 *
 * `model-tab` 2967px = `model-tab-v2-panel` 1947 + 15 + the v1 block 844 +
 * `model-footer` 43. The lower block addressed NO entity the outline did not
 * already address (8 shared ids, 0 v1-only).
 *
 * ── WHY COLLAPSE AND NOT DELETE ─────────────────────────────────────────────
 *
 * The stacked block is NOT dead. Six capabilities have no v2 equivalent —
 * contested-edge adjudication, CEE structural repairs, the model card / audit
 * trail, goal-target editing, edge strength/direction/likelihood editing, and
 * factor prior-range + baseline editing. The same fresh observation measured
 * the v2 outline as 15-controls-disabled on exactly those rows, each saying so
 * in its own `aria-label` ("Editing is not connected yet"). Removing the lower
 * block would remove the ONLY working editor for them.
 *
 * So this is a DEFAULT, not a removal, and half these tests point the OPPOSITE
 * WAY: they exist to fail if the collapse ever costs a capability. A fix that
 * makes the tab tidier by making capability unreachable is a worse defect than
 * the one it closes.
 *
 * ── BOUND TO THE MOUNT PATH (trap 3b) ───────────────────────────────────────
 *
 * Every assertion renders `ModelTabBody` — the container `OutputsDock` renders
 * for the Model tab — never a child in isolation, and asserts containment
 * within `model-tab`. This estate has twice shipped a component whose entire
 * suite pointed at a surface the deployment does not mount: RED-first, a full
 * mutant kit and a positive control all passed while the user saw nothing.
 *
 * ── THE DEEP LINK IS THE DANGEROUS PART ─────────────────────────────────────
 *
 * `ModelTabBody`'s cross-panel handoff resolves its scroll target with
 * `document.querySelector('[data-testid="model-{section}-section"]')`. If the
 * collapsed stack were UNMOUNTED, that returns null and `el?.scrollIntoView`
 * no-ops — the assistant's `open_section` directive, PreAnalysisPanel's "See
 * all relationships" and ContestedSection would all fail SILENTLY, with no
 * throw and no red anywhere. `it('keeps the v1 sections MOUNTED…')` and the
 * deep-link tests below are the guard on that, and they bind the scroll to its
 * receiver BY IDENTITY: a scroll that lands on some other element does not
 * satisfy them.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    vi.fn((selector: (s: unknown) => unknown) => selector(getMockState())),
    { getState: getMockState },
  ),
}))

vi.mock('../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { ModelTabBody } from '../ModelTabBody'
import { useUIStore } from '../../../stores/uiStore'

const FACTOR_ID = 'fac_budget'
const GOAL_ID = 'goal_margin'

function factorNode(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Budget',
      category: 'observable',
      observedState: { value: 0.5, source: 'cee_inference' },
    },
  } as unknown as Node
}

function goalNode(): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { label: 'Protect gross margin' },
  } as unknown as Node
}

const NODES: Node[] = [goalNode(), factorNode()]
const EDGES: Edge[] = []

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

function renderTab() {
  return render(<ModelTabBody {...DEFAULT_PROPS} nodes={NODES} edges={EDGES} />)
}

/**
 * `scrollIntoView` does not exist in jsdom at all, so installing this IS the
 * instrument — and it records the RECEIVER, not just the fact of a call. An
 * assertion that merely counts calls would pass on a scroll to any element;
 * `contexts` is what lets the deep-link tests bind by identity.
 */
const scrollContexts: Element[] = []
let originalScrollIntoView: unknown

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

// ── The instrument itself ────────────────────────────────────────────────────

describe('instrument health', () => {
  it('the scroll spy can SEE a scroll (positive control)', () => {
    renderTab()
    expect(scrollContexts).toHaveLength(0)
    const el = screen.getByTestId('model-tab')
    el.scrollIntoView()
    expect(scrollContexts).toEqual([el])
  })
})

// ── (c) The stacked duplicate ────────────────────────────────────────────────

describe('the Model tab opens with the v1 stack collapsed', () => {
  it('mounts BOTH surfaces inside the Model tab (the mount path)', () => {
    renderTab()
    const tab = screen.getByTestId('model-tab')
    expect(tab.contains(screen.getByTestId('model-tab-v2-panel'))).toBe(true)
    expect(tab.contains(screen.getByTestId('model-tab-v1-stack'))).toBe(true)
  })

  it('shows the v2 outline and HIDES the v1 stack by default', () => {
    renderTab()
    // The outline is what a fresh guest reads first.
    expect(screen.getByTestId('model-tab-v2-panel')).toBeVisible()
    // The stacked second editor is not stacked on it any more.
    expect(screen.getByTestId('model-tab-v1-stack-content')).not.toBeVisible()
  })

  it('the disclosure declares its collapsed state to assistive tech', () => {
    renderTab()
    const disclosure = screen.getByTestId('model-tab-v1-disclosure')
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(disclosure).toHaveAttribute('aria-controls', 'model-tab-v1-stack-content')
    // aria-controls must resolve — a dangling reference is worse than none.
    expect(document.getElementById('model-tab-v1-stack-content')).toBe(
      screen.getByTestId('model-tab-v1-stack-content'),
    )
  })

  it('⚠ keeps the v1 sections MOUNTED while collapsed', () => {
    renderTab()
    // Hidden, but IN THE DOCUMENT. This is the precondition the deep-link
    // `document.querySelector` depends on; unmounting breaks it silently.
    for (const testId of [
      'model-goal-section',
      'model-factors-section',
      'model-relationships-section',
      'model-risks-section',
    ]) {
      const el = screen.getByTestId(testId)
      expect(el).toBeInTheDocument()
      expect(document.querySelector(`[data-testid="${testId}"]`)).toBe(el)
    }
  })
})

// ── The opposite direction: collapse must cost NO capability ─────────────────

describe('the collapsed v1 stack stays reachable and functional', () => {
  it('expands on click and reveals the stack', async () => {
    const user = userEvent.setup()
    renderTab()
    await user.click(screen.getByTestId('model-tab-v1-disclosure'))

    expect(screen.getByTestId('model-tab-v1-disclosure')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('model-tab-v1-stack-content')).toBeVisible()
  })

  it('once expanded, a v1-ONLY capability is present and enabled', async () => {
    const user = userEvent.setup()
    renderTab()
    await user.click(screen.getByTestId('model-tab-v1-disclosure'))

    // Goal-target editing is one of the six with no v2 equivalent: the v2
    // outline renders the goal row DISABLED. If collapsing ever cost this,
    // the product would have no way to set a success target at all.
    const goalTarget = screen.getByTestId('goal-threshold-not-set-display')
    expect(goalTarget).toBeVisible()
    expect(goalTarget).not.toBeDisabled()
  })

  it('collapses again — the disclosure is a toggle, not a one-way door', async () => {
    const user = userEvent.setup()
    renderTab()
    const disclosure = screen.getByTestId('model-tab-v1-disclosure')
    await user.click(disclosure)
    expect(screen.getByTestId('model-tab-v1-stack-content')).toBeVisible()
    await user.click(disclosure)
    expect(screen.getByTestId('model-tab-v1-stack-content')).not.toBeVisible()
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
  })
})

// ── The deep link, bound to its receiver by identity ─────────────────────────

describe('deep-link navigation to a section still works', () => {
  it('a section request EXPANDS the stack and scrolls to THAT section', async () => {
    renderTab()

    act(() => { useUIStore.getState().requestModelTabSection('relationships') })

    // (1) The stack must be open, or the scroll lands on a display:none box.
    await waitFor(() => {
      expect(screen.getByTestId('model-tab-v1-stack-content')).toBeVisible()
    })

    // (2) The scroll must land on the requested section — BY IDENTITY. A count
    //     assertion would be satisfied by a scroll to any element.
    const target = screen.getByTestId('model-relationships-section')
    await waitFor(() => {
      expect(scrollContexts).toContain(target)
    })
  })

  it('a request for a DIFFERENT section scrolls to THAT one, not the first', async () => {
    renderTab()

    act(() => { useUIStore.getState().requestModelTabSection('risks') })

    const risks = screen.getByTestId('model-risks-section')
    await waitFor(() => {
      expect(scrollContexts).toContain(risks)
    })
    // Discrimination: the effect is reading the requested id, not scrolling to
    // a hardcoded section. Without this the test above passes on a constant.
    expect(scrollContexts).not.toContain(screen.getByTestId('model-relationships-section'))
  })

  it('does nothing at all when no section is requested', async () => {
    renderTab()
    await Promise.resolve()
    expect(scrollContexts).toHaveLength(0)
    expect(screen.getByTestId('model-tab-v1-stack-content')).not.toBeVisible()
  })
})

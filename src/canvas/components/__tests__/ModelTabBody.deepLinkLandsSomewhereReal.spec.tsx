/**
 * ⭐⭐ A DEEP LINK THAT LANDS ON A PERMANENTLY EMPTY HEADING — measured on
 * deployed `fa95cf65` / `9748b336`, driven as a guest.
 *
 * `MODEL_SECTION_TARGET` mapped `modelcard → 'model-group-v2-evidence-review'`:
 * the assistant's `open_section` directive for the model card scrolled the user
 * to a group that NO producer can ever fill (see
 * `model-tab-v2/__tests__/everyOutlineGroupCanBePopulated.spec.tsx` for the
 * mechanism). The scroll "succeeded" and the reader arrived at the words
 * "Nothing in this group yet". Meanwhile the real Model card — `ModelHealthSection`,
 * `testId="model-health-section"` — was MOUNTED the whole time, one block up
 * inside `model-scientific-transparency`, outside the
 * `LEGACY_DETAILED_EDITOR_MOUNTED = false` gate.
 *
 * ── AND A SECOND DEFECT IN THE SAME EFFECT, FOUND WHILE FIXING THE FIRST ──
 *
 * The effect opened the target group with
 *     `MODEL_GROUP_IDS.find(g => g === (pendingSection as string))`
 * — i.e. it compared a SECTION id against a GROUP id. Four of the six matched by
 * luck of shared spelling. `risks` did not: its group is `outcomes-risks`, so
 * `openGroupRequest` came back `null` and the assistant's "show me the risks"
 * scrolled to a heading it left SHUT. `modelcard` did not match either.
 *
 * That comparison was a hand-maintained mirror of a mapping the file already
 * held two lines above (trap 12): `MODEL_SECTION_TARGET` knew `risks` meant
 * `outcomes-risks` and the open-request lookup did not consult it. The repair is
 * to make the ONE table carry both facts, so a target and its open-request
 * cannot drift apart again.
 *
 * ⚠ THE PRE-EXISTING PIN COULD NOT SEE EITHER DEFECT.
 * `ModelTabBody.v1StackCollapsed.spec.tsx:128-133` asserts the section ELEMENT
 * was scrolled to — and that element renders whether or not it is open, and
 * whether or not anything can ever be inside it. It binds to the container, not
 * to what the reader sees.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
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
import { useUIStore, MODEL_TAB_SECTION_IDS, type ModelTabSectionId } from '../../../stores/uiStore'

/**
 * A model with one element of every kind that has an outline group, so a deep
 * link to ANY section has real content to land on. A corpus of only factors
 * would let a "the group is open" assertion pass while the group it opened was
 * empty for a reason this spec is not testing.
 */
const NODES: Node[] = [
  { id: 'goal_margin', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Protect gross margin' } },
  { id: 'opt_hire', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hire two AEs' } },
  {
    id: 'fac_budget',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: 'Budget', category: 'observable', observedState: { value: 0.5, source: 'cee_inference' } },
  },
  { id: 'risk_churn', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Churn spike' } },
] as Node[]
const EDGES: Edge[] = [
  { id: 'e_budget_goal', source: 'fac_budget', target: 'goal_margin', data: { weight: 0.6 } },
] as Edge[]

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
  cleanup()
  if (originalScrollIntoView === undefined) {
    delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView
  } else {
    ;(Element.prototype as unknown as Record<string, unknown>).scrollIntoView = originalScrollIntoView
  }
  useUIStore.setState({ pendingModelTabSection: null })
})

async function deepLinkTo(section: ModelTabSectionId): Promise<Element> {
  act(() => { useUIStore.getState().requestModelTabSection(section) })
  await waitFor(() => expect(scrollContexts.length).toBeGreaterThan(0))
  return scrollContexts[scrollContexts.length - 1]
}

describe('⭐ the model card deep link lands on the model card', () => {
  it('scrolls to the MOUNTED model card, not to an outline group', async () => {
    renderTab()
    // Contrast control FIRST: the card really is on screen, so a failure below
    // is about where the link points and not about an unmounted target.
    const card = screen.getByTestId('model-health-section')
    expect(card).toBeInTheDocument()

    const landed = await deepLinkTo('modelcard')
    expect(landed).toBe(card)
  })

  it('and the card it lands on is EXPANDED, even after the reader shut it', async () => {
    renderTab()
    const cardToggle = () =>
      screen.getByTestId('model-health-section').querySelector('[aria-expanded]')!

    // ⚠ THE PRECONDITION IS PINNED IN-TEST, and it is what makes this bite.
    // The card is a CONTROLLED `Accordion` in non-expert mode whose host state
    // starts at `'modelcard'` — so it is already open on arrival, and an
    // assertion made on a fresh render would pass no matter where the deep link
    // pointed or whether it opened anything. Shutting it first is the only way
    // the "true" below is provably this link's doing (trap 13b).
    expect(cardToggle().getAttribute('aria-expanded')).toBe('true')
    act(() => { (cardToggle() as HTMLElement).click() })
    expect(cardToggle().getAttribute('aria-expanded')).toBe('false')

    await deepLinkTo('modelcard')
    await waitFor(() => expect(cardToggle().getAttribute('aria-expanded')).toBe('true'))
  })
})

describe('⭐ a deep link to a group OPENS that group', () => {
  it('`risks` opens `outcomes-risks` — the id it maps to, not the id it is spelt', async () => {
    renderTab()
    const group = screen.getByTestId('model-group-v2-outcomes-risks')
    // RED-first anchor: it starts shut, so "open" below is this link's doing.
    expect(group.getAttribute('data-open')).toBe('false')

    const landed = await deepLinkTo('risks')
    expect(landed).toBe(group)
    await waitFor(() =>
      expect(screen.getByTestId('model-group-v2-outcomes-risks').getAttribute('data-open')).toBe('true'),
    )
  })

  it('CONTRAST CONTROL: a link to `risks` leaves the OTHER groups shut', async () => {
    renderTab()
    await deepLinkTo('risks')
    await waitFor(() =>
      expect(screen.getByTestId('model-group-v2-outcomes-risks').getAttribute('data-open')).toBe('true'),
    )
    // A repair that simply opened everything would satisfy the assertion above.
    expect(screen.getByTestId('model-group-v2-factors').getAttribute('data-open')).toBe('false')
    expect(screen.getByTestId('model-group-v2-goal').getAttribute('data-open')).toBe('false')
  })
})

describe('⭐ TOTAL over the declared section ids — no deep link lands nowhere', () => {
  /**
   * Derived from `MODEL_TAB_SECTION_IDS`, never a second hand-written list: a
   * section id added without a real destination fails HERE rather than
   * degrading silently into the `?? 'model-tab-v2-panel'` coalesce, which is
   * exactly the failure mode `uiStore.ts:95-106` describes and could not catch.
   */
  it.each(MODEL_TAB_SECTION_IDS)(
    '`%s` lands on an element that exists and is showing its content',
    async section => {
      renderTab()
      const landed = await deepLinkTo(section as ModelTabSectionId)

      expect(landed.isConnected, `${section} scrolled to a detached element`).toBe(true)

      // Never the generic top-of-panel coalesce: that is "we did not know where
      // to send you" wearing the costume of a successful navigation.
      expect(landed.getAttribute('data-testid')).not.toBe('model-tab-v2-panel')

      // If it IS an outline group, it must be OPEN — otherwise the reader is
      // looking at a heading, which is what this whole file is about.
      const testId = landed.getAttribute('data-testid') ?? ''
      if (testId.startsWith('model-group-v2-')) {
        await waitFor(() =>
          expect(
            screen.getByTestId(testId).getAttribute('data-open'),
            `${section} scrolled to ${testId} and left it collapsed`,
          ).toBe('true'),
        )
      }
    },
  )
})

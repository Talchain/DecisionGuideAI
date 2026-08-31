/**
 * DecisionNode — the invitations are on the card, not behind a hover.
 *
 * "Explore more options" and "What could go wrong?" are the two most
 * reasoning-shaped affordances the canvas has, on the anchor node of the whole
 * model. They rendered in exactly two places: the Detailed (expert) view, and a
 * HOVER POPOVER.
 *
 * Measured on the deployed build: `viewMode: 'standard'` and NONE of the four
 * coaching chips anywhere on the page, with a contrast control ("Show whole
 * model") proving the probe could read it. So for a default-view user they did
 * not exist, and on a touch device they could not — `hover` is not an input
 * that device has.
 *
 * ⚠ THE STANDARD-VIEW CASE IS THE WHOLE POINT, so every test here runs in
 * Standard. `DecisionNode.spec.tsx` sets `viewMode: 'expert'`, which is exactly
 * the setting under which this defect is invisible: a suite written only there
 * would have stayed green throughout (trap 3b — a test bound to a mode the
 * deployment does not render is not evidence about the deployed surface).
 *
 * CLAUDE.md trap 3: these assert presence and absence of TEXT. jsdom cannot
 * prove visibility and nothing here claims it does.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { DecisionNode } from '../DecisionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null,
    stabilityPercentage: null, winRate: null, isResultsMode: false,
    predictedOutcome: null, valueOfInformation: null, voiRank: null,
  })),
}))

// Transparent popover — the real one sits behind a 300ms hover delay and an
// anchor measurement, neither of which fire in jsdom. Rendering it inline is
// what lets the "not ONLY in the popover" assertion below discriminate.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

const hoisted = vi.hoisted(() => ({ state: null as any }))
vi.mock('../../store', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: (s: any) => unknown) => selector(hoisted.state)),
    { getState: () => hoisted.state },
  ),
}))

/**
 * ⭐ CAPTURES WHAT THE CHIP ACTUALLY SENDS.
 *
 * The assertion at the bottom of this file ("asserts nothing about the model")
 * scanned RENDERED TEXT — and the chip's falsehood was in `message`, which
 * never renders. The guard and the defect were on different strings, so the
 * suite stayed green while "Suggest a third option" went out on every model.
 * These tests click the chip and read the dispatched payload.
 */
const dispatched: Array<Record<string, unknown>> = []
vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: {
    getState: () => ({
      _dispatchAction: (a: Record<string, unknown>) => { dispatched.push(a) },
    }),
  },
}))

const DECISION_ID = 'decision-1'
const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire three' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Hire none' } },
]
const optionEdges = [
  { id: 'e1', source: DECISION_ID, target: 'option-1', data: {} },
  { id: 'e2', source: DECISION_ID, target: 'option-2', data: {} },
]

const setStore = (overrides: Record<string, unknown> = {}) => {
  hoisted.state = {
    edges: optionEdges,
    nodes: [decisionNode, ...optionNodes],
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    // THE DEPLOYED DEFAULT. Not 'expert'.
    viewMode: 'standard',
    selectNodeWithoutHistory: vi.fn(),
    ...overrides,
  }
}

const baseProps = {
  id: DECISION_ID, type: 'decision', position: { x: 0, y: 0 },
  selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  data: { label: 'Should we hire?', type: 'decision' },
}

const renderDecision = () =>
  render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} />
    </ReactFlowProvider>,
  )

/** Everything on the card EXCLUDING the popover — what a non-pointer user gets. */
const outsidePopover = (container: HTMLElement): string => {
  const clone = container.cloneNode(true) as HTMLElement
  clone.querySelectorAll('[data-testid="decision-node-popover"]').forEach(n => n.remove())
  return clone.textContent ?? ''
}

describe('DecisionNode — invitations in Standard view', () => {
  beforeEach(() => { vi.clearAllMocks(); setStore() })
  afterEach(() => cleanup())

  it('offers "Explore more options" WITHOUT hovering', () => {
    const { container } = renderDecision()
    expect(outsidePopover(container)).toContain('Explore more options')
  })

  it('offers "What could go wrong?" WITHOUT hovering', () => {
    const { container } = renderDecision()
    expect(outsidePopover(container)).toContain('What could go wrong?')
  })

  it('⭐ MOVED to the card, not duplicated onto it', () => {
    // The defect was not that the chips were missing; they rendered, in a place
    // a touch user cannot reach. My first fix rendered them in BOTH, which put
    // the same chip on one node twice for a pointer user — worse than either
    // placement alone, and `render-matrix`'s own `getByText` audit caught it.
    // Stripping the popover and asserting what is LEFT is what distinguishes
    // "present" from "reachable"; asserting the popover no longer holds them is
    // what stops the duplication coming back.
    const { container } = renderDecision()
    const popover = screen.queryByTestId('decision-node-popover')
    expect(popover, 'popover fixture missing — this test would pass vacuously').not.toBeNull()
    expect(outsidePopover(container)).toContain('Explore more options')
    expect(within(popover as HTMLElement).queryByText('Explore more options')).toBeNull()
    // The popover keeps what it is uniquely good at.
    expect(popover?.textContent).toContain('Model readiness')
  })

  it('they are real BUTTONS, so tap and keyboard reach them with no key handling of ours', () => {
    renderDecision()
    const chip = screen.getAllByText('Explore more options')[0].closest('button')
    expect(chip).not.toBeNull()
  })

  it('says nothing when the decision has no options — an invitation to explore alternatives to nothing', () => {
    // A door on an empty tier asserts the tier ought to have members. Same rule
    // the reasoning frontier follows.
    setStore({ edges: [], nodes: [decisionNode] })
    const { container } = renderDecision()
    expect(outsidePopover(container)).not.toContain('Explore more options')
  })

  it('the card never carries three chips at once', () => {
    // `preAnalysisCoachingChips` already drops "What could go wrong?" while the
    // Run CTA is up. Pinned here because the body now renders both, so a change
    // to that rule would show up as clutter on the anchor node rather than in a
    // popover nobody opens.
    const { container } = renderDecision()
    const text = outsidePopover(container)
    const chips = ['Explore more options', 'What could go wrong?', 'Run analysis']
      .filter(c => text.includes(c))
    expect(chips.length).toBeLessThanOrEqual(2)
  })

  it('asserts nothing about the model — these are invitations, not findings', () => {
    const { container } = renderDecision()
    const text = outsidePopover(container)
    const JUDGEMENT = /\b(too similar|too few|not enough|weak|incomplete|you should)\b/i
    expect(text).not.toMatch(JUDGEMENT)
  })

  /**
   * ⭐ THE SENT MESSAGE IS A STATEMENT ABOUT THE USER'S MODEL, MADE IN THE
   * USER'S NAME — so it has to be true of the model it is sent from.
   */
  describe('what the chip sends, not what it shows', () => {
    const messageFor = (label: string): string => {
      dispatched.length = 0
      const { container } = renderDecision()
      const btn = Array.from(container.querySelectorAll('button'))
        .find(b => b.textContent?.includes(label))
      if (!btn) throw new Error(`refusing to assert: no "${label}" chip rendered`)
      fireEvent.click(btn)
      if (dispatched.length === 0) throw new Error('refusing to assert: click dispatched nothing')
      return String(dispatched[dispatched.length - 1].message ?? '')
    }

    it('does not claim the model has exactly two options', () => {
      // The hardcoded string read "Suggest a third option I haven't considered
      // for this decision" on every model — asking for a third that would be
      // the second on a one-option model, and a sixth-that-already-exists on a
      // seven-option one.
      expect(messageFor('Explore more options')).not.toMatch(/\ba third option\b/i)
    })

    it('DISCRIMINATION: the message differs between two models of different size', () => {
      // Without this, any fixed replacement string passes the test above. This
      // is the assertion that makes the message model-aware rather than merely
      // differently-generic — the same property #1060 pins for the frontier
      // doors, and the reason this string was worth changing at all.
      const two = messageFor('Explore more options')
      setStore({
        nodes: [decisionNode, ...optionNodes, { id: 'option-3', type: 'option', data: { type: 'option', label: 'Hire one' } }],
        edges: [...optionEdges, { id: 'e3', source: DECISION_ID, target: 'option-3', data: {} }],
      })
      const three = messageFor('Explore more options')
      expect(two).not.toBe(three)
      expect(two).toContain('2 options')
      expect(three).toContain('3 options')
    })

    it('counts, and does not assess', () => {
      // The line this whole surface stays on: how many options exist is
      // observable from the graph. "Too few" or "too similar" would be a claim
      // about the user's reasoning and belongs to the producer.
      const msg = messageFor('Explore more options')
      expect(msg).not.toMatch(/\b(too similar|too few|not enough|weak|incomplete|you should)\b/i)
    })
  })

  /**
   * ⭐ A DUPLICATE EDGE IS NOT A SECOND OPTION.
   *
   * `optionCount` counted outgoing edges, which was harmless while its only
   * readers were `> 0` / `=== 0` tests. The message above is the first thing in
   * the product to say the number OUT LOUD, so the change that removes the
   * generic copy is the change that makes this reachable.
   *
   * Reachable, not theoretical: `store.addEdge` blocks duplicates, but the CEE
   * patch path (`applyPatch.ts:350`) appends edges with no duplicate check, and
   * `useModelHealth.ts:180` already warns on the resulting state.
   */
  describe('counting the model honestly', () => {
    const messageWithEdges = (edges: unknown[], nodes: unknown[]): string => {
      dispatched.length = 0
      setStore({ edges, nodes })
      const { container } = renderDecision()
      const btn = Array.from(container.querySelectorAll('button'))
        .find(b => b.textContent?.includes('Explore more options'))
      if (!btn) throw new Error('refusing to assert: no "Explore more options" chip rendered')
      fireEvent.click(btn)
      if (dispatched.length === 0) throw new Error('refusing to assert: click dispatched nothing')
      return String(dispatched[dispatched.length - 1].message ?? '')
    }

    it('one option linked twice is one option', () => {
      const msg = messageWithEdges(
        [...optionEdges, { id: 'e1-dup', source: DECISION_ID, target: 'option-1', data: {} }],
        [decisionNode, ...optionNodes],
      )
      expect(msg).toContain('2 options')
      expect(msg).not.toContain('3 options')
    })

    it('CONTRAST CONTROL: a genuine third option still counts as three', () => {
      // Without this, the assertion above passes for a count stuck at 2 — or for
      // any implementation that under-counts. The pair is what proves the change
      // removed duplicates rather than removed counting.
      const msg = messageWithEdges(
        [...optionEdges, { id: 'e3', source: DECISION_ID, target: 'option-3', data: {} }],
        [decisionNode, ...optionNodes, { id: 'option-3', type: 'option', data: { type: 'option', label: 'Hire one' } }],
      )
      expect(msg).toContain('3 options')
    })

    it('singular stays singular when the one option is linked twice', () => {
      const msg = messageWithEdges(
        [
          { id: 'e1', source: DECISION_ID, target: 'option-1', data: {} },
          { id: 'e1-dup', source: DECISION_ID, target: 'option-1', data: {} },
        ],
        [decisionNode, optionNodes[0]],
      )
      expect(msg).toContain('1 option ')
      expect(msg).not.toContain('1 options')
    })
  })
})

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
import { render, screen, within, cleanup } from '@testing-library/react'
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
})

/**
 * THE DECISION HEADLINE CARRIES ITS OWN HEDGE — in STANDARD view, not only Detailed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS: A MUTANT SURVIVED
 * ═══════════════════════════════════════════════════════════════════════════
 * The DecisionNode half of this change shipped UNPINNED. Deleting the headline
 * grade entirely left `src/canvas/nodes` at 1155/1155 GREEN — the whole node
 * tree could not see it go. That is the "built but nothing observes it" defect
 * in miniature, caught by the mutation kit rather than by review, and this
 * suite is the mutant's answer.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE HARM
 * ═══════════════════════════════════════════════════════════════════════════
 * "{X} leads in N% of scenarios" is the strongest sentence the canvas speaks,
 * and it renders in BOTH views. This node's pre-existing stability line is
 * `isDetailed`-gated (`showStabilityLine`), i.e. behind a hover popover in the
 * Standard view the founder was actually in. So the claim was always-on and its
 * caveat was not, on a run the producer had graded `very_low`.
 *
 * ⭐ BOTH DIRECTIONS, ALWAYS. A robust run must keep its headline unhedged —
 * a fix that hedged everything would be as dishonest as one that hedged
 * nothing, and only the twin can see it.
 *
 * ⚠ jsdom performs no layout (trap 3): these assert what is MOUNTED, never
 * where it sits or whether it is visible.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

import { DecisionNode } from '../DecisionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

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
const GRADE = 'decision-leader-robustness'

const decisionNode = { id: DECISION_ID, type: 'decision', data: { type: 'decision' } }
const optionNodes = [
  { id: 'option-1', type: 'option', data: { type: 'option', label: 'Hire a Tech Lead' } },
  { id: 'option-2', type: 'option', data: { type: 'option', label: 'Two Developers' } },
]
const optionEdges = [
  { id: 'e1', source: DECISION_ID, target: 'option-1', data: {} },
  { id: 'e2', source: DECISION_ID, target: 'option-2', data: {} },
]

/** A permitted leader claim, with the run's grade supplied by the caller. */
const permittedReport = (robustness: Record<string, unknown>) => ({
  option_probabilities: {
    'option-1': { win_probability: 0.53 },
    'option-2': { win_probability: 0.21 },
  },
  robustness: {
    recommended_option_id: 'option-1',
    near_tie: { is_tie: false, top_option_id: 'option-1' },
    ...robustness,
  },
})

const setStore = (report: unknown, viewMode: string) => {
  hoisted.state = {
    edges: optionEdges,
    nodes: [decisionNode, ...optionNodes],
    results: { status: 'complete', report },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    viewMode,
    selectNodeWithoutHistory: vi.fn(),
  }
}

const baseProps = {
  id: DECISION_ID,
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

function renderDecision(report: unknown, viewMode = 'standard') {
  setStore(report, viewMode)
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DecisionNode — the leader headline carries the run\'s robustness', () => {
  it('PRECONDITION: the fixture actually produces the leader headline', () => {
    // Without this, every "no grade" case below could pass because no headline
    // rendered at all — a suite agreeing with itself (trap 13b).
    renderDecision(permittedReport({ level: 'high' }))
    expect(screen.getByText(/leads in/i)).toBeInTheDocument()
  })

  it.each([
    ['standard', 'Highly sensitive'],
    ['expert', 'Highly sensitive'],
  ])('very_low in %s view: headline AND grade both render', (viewMode, label) => {
    // ⭐ STANDARD IS THE LOAD-BEARING ROW. The node's pre-existing stability
    // line is Detailed-only, which is exactly why the caveat was missing from
    // the view the founder was in.
    renderDecision(permittedReport({ level: 'very_low' }), viewMode)
    expect(screen.getByText(/leads in/i)).toBeInTheDocument()
    expect(screen.getByTestId(GRADE)).toHaveTextContent(label)
  })

  it('low: headline AND grade both render', () => {
    renderDecision(permittedReport({ level: 'low' }))
    expect(screen.getByTestId(GRADE)).toHaveTextContent('Sensitive')
  })

  // ── OPPOSITE-DIRECTION TWINS ─────────────────────────────────────────────
  it.each([['high'], ['moderate']])(
    'TWIN — %s: the headline renders in full and acquires NO caveat',
    (level) => {
      renderDecision(permittedReport({ level }))
      expect(screen.getByText(/leads in/i)).toBeInTheDocument()
      expect(screen.queryByTestId(GRADE)).toBeNull()
    },
  )

  it('TWIN — a fragile run does not suppress the leader sentence', () => {
    renderDecision(permittedReport({ level: 'very_low' }))
    expect(screen.getByText(/Hire a Tech Lead/)).toBeInTheDocument()
  })

  // ── THE DISCLOSURE MAY NOT APPEAR WITHOUT THE SENTENCE ───────────────────
  it('no headline (leader claim withheld) on a fragile run: no grade either', () => {
    // ⚠ THE OBJECT FORM IS REQUIRED, and the first cut of this test used a bare
    // `false`. `readProducerLeaderPermission` returns null for any non-object —
    // a malformed field is "a producer we cannot READ", which fails OPEN by
    // design — so a bare boolean silently left the claim permitted and the test
    // failed on its own fixture rather than on the code.
    const withheld = {
      ...permittedReport({ level: 'very_low' }),
      producer_leader_permission: { permitted: false, withheld_reason: 'separation_unavailable' },
    }
    renderDecision(withheld)
    expect(screen.queryByText(/leads in/i)).toBeNull()
    expect(screen.queryByTestId(GRADE)).toBeNull()
  })

  // ── THE WITHHELD FIELD IS NEVER READ ─────────────────────────────────────
  it('recommendation_stability alone never produces a grade', () => {
    // PLoT withholds this field; it is the leader's win probability relabelled.
    // See `leaderRobustnessGrade.ts` and `withheldFieldReadBan.spec.ts`.
    renderDecision(permittedReport({ recommendation_stability: 0.05 }))
    expect(screen.getByText(/leads in/i)).toBeInTheDocument()
    expect(screen.queryByTestId(GRADE)).toBeNull()
  })
})

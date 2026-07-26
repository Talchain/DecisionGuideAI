/**
 * OWNED LEADER CLAIM — the canvas half (ROADMAP 1.223, gate G-CEE-1).
 *
 * The canvas is where the contradiction was most visible: on a withheld turn
 * the render probe caught the DecisionNode printing "{X} leads in 43% of
 * scenarios" while CEE's own reply, in the dock beside it, said "no option can
 * be put forward yet".
 *
 * Drives the same wire fixture pair as the verdict and results-surface specs
 * (`src/lib/__fixtures__/ownedLeaderClaim.fixtures.ts`) — one run, three
 * suites, no mirror.
 *
 * CLAUDE.md trap 3: these assert the presence/absence of TEXT. jsdom cannot
 * prove visibility and nothing here claims it does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import {
  LEADER_ID,
  LEADER_LABEL,
  PERMITTED_REPORT,
  RUNNER_UP_ID,
  RUNNER_UP_LABEL,
  WITHHELD_REPORT,
} from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'
import { DecisionNode } from '../DecisionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const OPTION_NODES = [
  { id: LEADER_ID, type: 'option', data: { type: 'option', label: LEADER_LABEL } },
  { id: RUNNER_UP_ID, type: 'option', data: { type: 'option', label: RUNNER_UP_LABEL } },
]

const makeStoreState = (report: unknown) => ({
  edges: [],
  nodes: [
    { id: 'decision-1', type: 'decision', data: { type: 'decision' } },
    ...OPTION_NODES,
  ],
  results: { status: 'complete', report },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  viewMode: 'expert',
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'decision-1',
  type: 'decision',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  data: { label: 'Which laptops?', type: 'decision' },
}

function renderWith(report: unknown) {
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector(makeStoreState(report) as any),
  )
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(baseProps as any)} />
    </ReactFlowProvider>,
  )
}

describe('DecisionNode — "{X} leads in N% of scenarios"', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('WITHHELD: the sentence does not render at all', () => {
    renderWith(WITHHELD_REPORT)
    // The whole comparative sentence is withheld — not softened, not
    // re-worded. Previously this read `robustness.recommended_option_id`
    // directly, which answers "WHO leads?" and never "is there a leader?",
    // so it fired on every completed run.
    expect(screen.queryByText(/leads in \d+% of scenarios/i)).toBeNull()
  })

  it('PERMITTED: the sentence renders, with the producer-owned leader named', () => {
    renderWith(PERMITTED_REPORT)
    // Over-suppression control. The node label is split across elements, so
    // match on the distinctive comparative fragment.
    expect(screen.getByText(/leads in 66% of scenarios/i)).toBeDefined()
  })

  it('WITHHELD: the node still renders — the suppression test is not vacuous', () => {
    renderWith(WITHHELD_REPORT)
    // Positive control (TESTING-DISCIPLINE: an absence assertion must first
    // prove it can see a presence). If the component threw or rendered
    // nothing, the queryByText above would pass for the wrong reason.
    expect(screen.getByText('Which laptops?')).toBeDefined()
  })

  // ── Over-suppression guards ─────────────────────────────────────────────
  //
  // The first cut of this fix gated the WHOLE post-analysis block on the
  // leader claim, because the leader sentence, the stability line and the
  // post-analysis chips all lived inside one `{headline ? … }` branch. That
  // silenced two surfaces that make no leader claim at all, and — worse —
  // fell through to the branch's `else`, which is the PRE-ANALYSIS UI.

  it('WITHHELD: the stability disclosure still renders — it is the OTHER axis', () => {
    // `decisionVerdict`'s header is explicit that robustness is disclosed
    // separately from separation. Suppressing fragility along with the leader
    // claim would trade one honesty failure for another.
    renderWith({
      ...WITHHELD_REPORT,
      robustness: { ...WITHHELD_REPORT.robustness, recommendation_stability: 0.42 },
    })
    expect(screen.getByText(/Stability: 42% \(sensitive\)/i)).toBeDefined()
  })

  it('WITHHELD: a completed run does NOT fall back to the pre-analysis UI', () => {
    renderWith(WITHHELD_REPORT)
    // "Run analysis" on a run that has already completed would be a wrong-state
    // regression, not merely a missing sentence.
    expect(screen.queryByText('Run analysis')).toBeNull()
  })
})

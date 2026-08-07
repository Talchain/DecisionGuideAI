/**
 * GoalNode ⇄ GoalPanel — one goal, one target string (ROADMAP 2.315(c)).
 *
 * The staging walk saw the canvas card and Inspector v2 print DIFFERENT
 * strings for the same goal, because each surface hand-rolled its own
 * unit-string mapping over `formatTargetValue`. Both now route through the
 * shared `formatGoalTarget` — CLAUDE.md #12, derive don't mirror.
 *
 * ⚠ WHAT IS STRUCTURAL IS THE FORMATTER, NOT THE AGREEMENT. An earlier draft
 * of this header claimed the two surfaces are byte-identical "by
 * construction". That is overstated and the correction matters. Only the
 * RENDERING is shared; the INPUTS are two different sources — the panel reads
 * the store scalar `goalThreshold`, the card reads `node.data`. Same string
 * out only while those two agree.
 *
 * One reachable divergence, named so nobody mistakes this file for a proof it
 * cannot give: a later graph_patch RAISING the target updates the node through
 * the ungated backfill while the store gate (raw is not superseded by raw)
 * leaves the scalar stale. The card then shows the new figure, the panel the
 * old — and the run sends the old. This is PRE-EXISTING, not a regression:
 * the pristine gate (`goalThreshold == null`, store.ts:4013 at cb957c8c) blocks
 * the same refresh identically, and 2.315 deliberately did not widen it
 * further. Rowed separately by the paired review.
 *
 * So: given equal inputs, the two surfaces cannot disagree — that is what this
 * file pins, and it is the half that was actually broken.
 *
 * This file pins the CARD half. The PANEL half is
 * `src/canvas/ui/inspector-v2/__tests__/GoalPanel.goalTarget.spec.tsx`, which
 * asserts the same literals against the real store and the real panel. Each
 * case here asserts BOTH a hard literal (so a broken helper cannot make the
 * two surfaces agree on garbage) and equality with the helper (so a surface
 * that stops deferring to it REDs).
 *
 * Scope limit (CLAUDE.md trap 3): jsdom pins the rendered string only, never
 * that the card's target line is visible or laid out.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'
import { formatGoalTarget } from '../../../components/results/utils/formatGoalTarget'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
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

import { useCanvasStore } from '../../store'

const baseProps = {
  id: 'goal-1',
  type: 'goal',
  selected: false,
  isConnectable: true,
  position: { x: 0, y: 0 },
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

function cardText(data: Record<string, unknown>) {
  const { container } = render(
    <ReactFlowProvider>
      <GoalNode {...baseProps} data={{ label: 'Grow annual revenue', type: 'goal', ...data }} />
    </ReactFlowProvider>,
  )
  return container.textContent ?? ''
}

describe('GoalNode target string — the canvas half of the one-goal-one-string pair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as never))
  })

  it('renders a currency target as a prefixed, separated magnitude', () => {
    const text = cardText({ goal_threshold_raw: 800000, goal_threshold_unit: '£' })
    expect(text).toContain('£800,000')
    expect(text).toContain(formatGoalTarget(800000, '£'))
    expect(text).not.toContain('800000 £')
  })

  it('suppresses the "count" placeholder — the string Inspector v2 was printing', () => {
    const text = cardText({ goal_threshold_raw: 800000, goal_threshold_unit: 'count' })
    expect(text).toContain('800,000')
    expect(text).toContain(formatGoalTarget(800000, 'count'))
    expect(text).not.toContain('count')
  })

  it('renders a real unit as a suffix', () => {
    const text = cardText({ goal_threshold_raw: 9, goal_threshold_unit: 'months' })
    expect(text).toContain('9 months')
    expect(text).toContain(formatGoalTarget(9, 'months'))
  })

  it('renders percent as a rounded percentage', () => {
    const text = cardText({ goal_threshold_raw: 84.6, goal_threshold_unit: 'percent' })
    expect(text).toContain('85%')
    expect(text).toContain(formatGoalTarget(84.6, 'percent'))
  })
})

/**
 * ⭐ THE TWO CARDS THAT NEVER GOT THE SHARED METRIC ROW.
 *
 * Measured on deployed staging `d4ff3683` across a real 14-node model:
 * `NodeMetricRow` (noun + bar + percentage) was already consistent on 12 of 14
 * cards — factor `Influence 69%`, risk `Strength 45% est.`, outcome
 * `Strength 70% est.`, option `Ahead 17%`. The two that had no bar are the two
 * a reader looks at first:
 *
 *   · GOAL     — `From brief` / `No target set`, and post-analysis a PROSE
 *                sentence `73% chance of reaching target`. A number, no bar.
 *   · DECISION — `{X} supported in 47% of simulated scenarios`. The single most
 *     consequential
 *                figure on the canvas, and the least visually encoded one.
 *
 * ⛔ WHAT THESE TESTS EXIST TO STOP, and it is not "is there a bar".
 * A row that renders whenever the NUMBER exists would satisfy every
 * "the card has a bar" assertion while fabricating a claim the product is not
 * entitled to make. Both cards' figures are permission-gated:
 *
 *   · the decision card may name a leader only where `deriveDecisionVerdict`
 *     says one is owned (ROADMAP 1.223) — and `WITHHELD_REPORT` deliberately
 *     still CARRIES `option_probabilities[LEADER_ID].win_probability`, so the
 *     datum is present and the entitlement is not. That is the discriminating
 *     pair, and each withheld case below PINS ITS OWN PRECONDITION in-test
 *     (CLAUDE.md trap 13b): it asserts the number is there before asserting the
 *     row is not.
 *   · the goal card's figure is gated on the user's own target being SET
 *     (UI-SEM-082) — never on producer value presence alone.
 *
 * Every assertion binds by TEST ID (identity), never by a value predicate
 * another row on the same card could satisfy (CLAUDE.md trap 19).
 *
 * CLAUDE.md trap 3: these assert presence/absence of NODES IN THE TREE. jsdom
 * cannot prove visibility and nothing here claims it does.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { METRIC_NOUN } from '../shared/metricVocabulary'
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
import { GoalNode } from '../GoalNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="decision-node-popover">{children}</div>
  ),
}))

vi.mock('../../ui/inspector-v2/useAnalysisResults', async (importOriginal) => ({
  // Spread the real module. A bare factory REPLACES it, so every export this
  // spec does not name silently disappears -- which is how adding
  // selectHasAnyRealProbability took this whole file red at once.
  ...(await importOriginal<typeof import('../../ui/inspector-v2/useAnalysisResults')>()),
  useHasAnyRealProbability: vi.fn(() => true),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const DECISION_ROW = 'decision-leader-metric-row'
const GOAL_ROW = 'goal-achievement-metric-row'

// ── Decision harness ────────────────────────────────────────────────────────

const OPTION_NODES = [
  { id: LEADER_ID, type: 'option', data: { type: 'option', label: LEADER_LABEL } },
  { id: RUNNER_UP_ID, type: 'option', data: { type: 'option', label: RUNNER_UP_LABEL } },
]

const makeDecisionState = (report: unknown) => ({
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

const decisionProps = {
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

function renderDecision(report: unknown) {
  // `BaseNode` consumes this hook for its corner decorations, so the shared
  // mock needs a shape even on the decision card, which reads none of it.
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({ ...BASE_METADATA } as any)
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector(makeDecisionState(report) as any),
  )
  return render(
    <ReactFlowProvider>
      <DecisionNode {...(decisionProps as any)} />
    </ReactFlowProvider>,
  )
}

// ── Goal harness ────────────────────────────────────────────────────────────

const makeGoalState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'complete', report: { robustness: null } },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'standard',
  ...overrides,
})

const goalProps = {
  id: 'goal-1',
  type: 'goal',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const BASE_METADATA = {
  sensitivityRank: null,
  influence: null,
  confidence: null,
  inSensitivityAnalysis: false,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: false,
  achievementProbabilityBasis: null,
  goalFitAvailable: false,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: true,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
}

function renderGoal(
  metadata: Record<string, unknown>,
  data: Record<string, unknown> = {},
) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector(makeGoalState() as any),
  )
  vi.mocked(useNodeDisplayMetadata).mockReturnValue({
    ...BASE_METADATA,
    ...metadata,
  } as any)
  return render(
    <ReactFlowProvider>
      <GoalNode {...(goalProps as any)} data={{ label: 'Increase revenue', type: 'goal', ...data }} />
    </ReactFlowProvider>,
  )
}

/** The bar's fill element, found INSIDE the named row — never anywhere else. */
function fillWidthWithin(testId: string): string | null {
  const row = screen.queryByTestId(testId)
  if (!row) return null
  const fill = row.querySelector<HTMLElement>('[style*="width"]')
  return fill?.style.width ?? null
}

// ───────────────────────────────────────────────────────────────────────────

/**
 * ⛔ THE `DecisionNode` DESCRIBE IS RETIRED — four arms, all about a row that no
 * longer exists.
 *
 * `decision-leader-metric-row` rendered `option_probabilities[leader]` under
 * `METRIC_NOUN.support`: the same field, caption and scale the most-supported
 * OptionNode already draws. It was a duplicate of the option card's bar sitting
 * under a heading that asks a question, and it is removed with the sentence
 * above it.
 *
 * ⚠ ITS TWO REAL PROPERTIES ARE NOT LOST. "No row on a withheld run" and the
 * non-vacuity control are pinned once, across ALL permission states, in
 * `canvasLeaderAdmission`. The fourth arm — "the sentence the row encodes is
 * STILL IN VISIBLE TEXT" — guarded against folding the claim into the bar and
 * hollowing the leader-claim corpus; with neither surface on this node, it has
 * no subject.
 *
 * ⭐ THE GoalNode DESCRIBE BELOW IS UNTOUCHED. `goal-achievement-metric-row` is
 * this node's OWN quantity, not a copy of another card's, which is exactly the
 * distinction that makes removing the decision row correct and keeping this one
 * correct.
 */
describe('DecisionNode — the leader row is retired, not merely gated', () => {
  /**
   * ⛔ FOUR ARMS BECAME ONE. They pinned `decision-leader-metric-row` against
   * the producer's comparative admission — permitted renders, withheld does
   * not, a non-vacuity control, and "the sentence the row encodes is still in
   * visible text". The row is gone, so three of those have no subject and the
   * fourth guarded against folding the claim INTO the row, which cannot happen
   * to a row that does not exist.
   *
   * ⭐ ONE ARM KEPT, DELIBERATELY, AND IT IS NOT A TOMBSTONE. The row was a
   * duplicate of the option card's bar — same field, same `METRIC_NOUN.support`
   * caption, same scale — under a heading that asks a question. The plausible
   * regression is that a future "the decision card has no bar like the others"
   * observation puts it back, which is exactly how it arrived. This arm makes
   * that a red rather than a review question, in BOTH permission states so a
   * gated reintroduction cannot slip through.
   *
   * The harness below is retained for the same reason: deleting it would orphan
   * `renderDecision`, `decisionProps`, `makeDecisionState` and two fixtures,
   * and the property is worth one live arm.
   */
  it.each([['permitted', PERMITTED_REPORT], ['withheld', WITHHELD_REPORT]])(
    'no leader metric row on the decision card — %s',
    (_label, report) => {
      renderDecision(report)
      expect(screen.queryByTestId(DECISION_ROW)).toBeNull()
      // Not vacuous: the card itself is on screen.
      expect(screen.getByText('Which laptops?')).toBeDefined()
    },
  )
})

describe('GoalNode — the achievement figure gets the shared metric row', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the shared row when a target is set and a figure exists', () => {
    renderGoal(
      { achievementProbability: 0.73 },
      { goal_threshold_raw: '100', goal_threshold_unit: '%' },
    )
    const row = screen.getByTestId(GOAL_ROW)
    expect(row.textContent).toContain(METRIC_NOUN.chance)
    expect(row.textContent).toContain('73%')
    expect(fillWidthWithin(GOAL_ROW)).toContain('73%')
  })

  it('NO TARGET: no row — even though the figure IS available (UI-SEM-082)', () => {
    // Precondition pinned: the producer figure is present and non-null. The
    // row's absence is therefore the TARGET gate's doing, not a missing value.
    const { container } = renderGoal({ achievementProbability: 0.73 }, {})
    expect(vi.mocked(useNodeDisplayMetadata).mock.results[0].value.achievementProbability).toBe(0.73)
    expect(screen.queryByTestId(GOAL_ROW)).toBeNull()
    // Positive control — the card rendered.
    expect(container.textContent).toContain('Increase revenue')
  })

  it('NO FIGURE: no row, and no empty track standing in for one', () => {
    renderGoal(
      { achievementProbability: null },
      { goal_threshold_raw: '100', goal_threshold_unit: '%' },
    )
    expect(screen.queryByTestId(GOAL_ROW)).toBeNull()
    expect(screen.getByText('Increase revenue')).toBeDefined()
  })

  it('MODELLED BASIS: the caveat still renders — the row does not displace it', () => {
    renderGoal(
      { achievementProbability: 0.73, achievementProbabilityIsModelledBasis: true },
      { goal_threshold_raw: '100', goal_threshold_unit: '%' },
    )
    expect(screen.getByTestId(GOAL_ROW)).toBeDefined()
    // The figure must never be shown BARE on a modelled basis. The disclosure
    // that makes it honest is the reason the low-zoom line withholds it.
    expect(screen.getByTestId('goal-fit-basis-caveat-node')).toBeDefined()
  })

  it('the prose sentence the row encodes is UNCHANGED — the row is additive', () => {
    renderGoal(
      { achievementProbability: 0.73 },
      { goal_threshold_raw: '100', goal_threshold_unit: '%' },
    )
    expect(screen.getByText(/73.*% chance of reaching target/)).toBeDefined()
  })
})

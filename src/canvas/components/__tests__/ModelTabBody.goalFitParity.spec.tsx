/**
 * Goal-probability tab parity — journey-walk 2026-08-03 §10.4 (Paul's 2.262
 * tab-parity directive), Model-tab arm.
 *
 * THE WITNESSED GAP (journey-walk-2026-08-03.md §10.4, quartet UI 43fd19e1):
 * per-option goal probability renders on the Analysis tab only ("N% chance of
 * hitting your goal", Goal fit lens) — the Model tab's goal card shows Target
 * only. WIRING GAP, not a design decision, derived at the bytes: ModelTabBody
 * already holds `results.report` and maps report data into sibling sections
 * (conditional winners → OptionsSection, edge e-values → Relationships), and
 * the per-option figures sit in the SAME report at
 * `report.option_probabilities` — GoalSection is simply never handed them.
 *
 * DISCIPLINE (matches the Analysis-tab surfaces exactly):
 *  · ONE chooser: every figure resolves through `selectGoalProbability` —
 *    never a raw read of the owned fields (claim-ownership registration).
 *  · Register-only copy: `GOAL_ANCHOR_COPY.phrase` carries the possessive
 *    gate — the substituted-joint basis withholds "your goal" wording.
 *  · Complete-field gate (the V7 goal lens / OptionCards "Hits target" rule):
 *    rows render only when a target is set AND every option carries an
 *    admissible figure — no partial rankings.
 *  · Modelled-basis caveat: `GOAL_FIT_BASIS_CAVEAT_COPY` adjacent whenever
 *    the number rides `scored_from === 'modelled_outcome_distribution'`.
 *  · Producer order preserved (grouped option order) — no re-sorting, no
 *    winner designation minted here.
 *
 * RED-first at pristine 43fd19e1: the goal card renders no per-option rows,
 * so the first describe fails. Fixture values are the walk's real wire
 * figures (0.0987 / 0.12 / 0.1633 / 0.02 → 10% / 12% / 16% / 2%).
 *
 * CLAIM TYPE: jsdom presence only — never layout or visibility (trap 3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ModelTabBody } from '../ModelTabBody'
import type { Node } from '@xyflow/react'

// ── Mocks (same shape as ModelTabBody.goalDiscuss.spec.tsx) ──────────────────

vi.mock('../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

vi.mock('../../../telemetry/guidanceEvents', () => ({ trackGuidance: vi.fn() }))

const mockGraph: { nodes: unknown[]; edges: unknown[] } = { nodes: [], edges: [] }
let mockResults: unknown = null

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
    results: mockResults,
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

// ── Fixtures — the walk's real option set and wire figures ────────────────────

function makeNodes(): Node[] {
  const mk = (id: string, type: string, label: string, data: Record<string, unknown> = {}): Node =>
    ({ id, type, position: { x: 0, y: 0 }, data: { label, ...data } }) as Node
  return [
    mk('goal_arr', 'goal', 'Reach £1,000,000 ARR', {
      goal_threshold_raw: 1000000,
      goal_threshold_unit: '£',
      goal_threshold: 0.8,
    }),
    mk('opt_content', 'option', 'Invest in Content Marketing'),
    mk('opt_sales', 'option', 'Hire Two Sales Reps'),
    mk('opt_selfserve', 'option', 'Build Self-Serve Tier'),
    mk('opt_statusquo', 'option', 'Continue Current Approach (Status Quo)'),
  ]
}

/** Walk wire figures (journey-walk §2): goal probabilities per option. */
function walkOptionProbabilities(): Record<string, Record<string, unknown>> {
  return {
    opt_content: { win_probability: 0.23, goal_probability: 0.0987 },
    opt_sales: { win_probability: 0.3, goal_probability: 0.12 },
    opt_selfserve: { win_probability: 0.46, goal_probability: 0.1633 },
    opt_statusquo: { win_probability: 0.0145, goal_probability: 0.02 },
  }
}

function setResults(optionProbabilities: Record<string, unknown> | undefined): void {
  mockResults = optionProbabilities
    ? { status: 'complete', report: { option_probabilities: optionProbabilities } }
    : null
}

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

beforeEach(() => {
  vi.clearAllMocks()
  mockResults = null
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Model-tab goal card — per-option goal fit (real ModelTabBody→GoalSection path)', () => {
  it('renders every option with its register-copy goal-fit readout (walk figures)', () => {
    setResults(walkOptionProbabilities())
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={makeNodes()} edges={[]} />)
    const section = screen.getByTestId('model-goal-section')
    const rows = within(section).getByTestId('goal-fit-parity')
    // All four options, producer figures faithfully rounded, register phrase.
    expect(rows).toHaveTextContent('Invest in Content Marketing')
    expect(rows).toHaveTextContent('10% chance of hitting your goal')
    expect(rows).toHaveTextContent('Hire Two Sales Reps')
    expect(rows).toHaveTextContent('12% chance of hitting your goal')
    expect(rows).toHaveTextContent('Build Self-Serve Tier')
    expect(rows).toHaveTextContent('16% chance of hitting your goal')
    expect(rows).toHaveTextContent('Continue Current Approach (Status Quo)')
    expect(rows).toHaveTextContent('2% chance of hitting your goal')
  })

  it('substituted-joint basis withholds the possessive and renders the modelled-basis caveat', () => {
    // The witnessed 2.282 shape: goal_probability absent, joint present,
    // scored from the modelled outcome distribution.
    setResults({
      opt_content: {
        probability_of_joint_goal: 0.0054,
        goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
      },
      opt_sales: {
        probability_of_joint_goal: 0.55,
        goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
      },
      opt_selfserve: {
        probability_of_joint_goal: 0.3,
        goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
      },
      opt_statusquo: {
        probability_of_joint_goal: 0.1,
        goal_fit_basis: { scored_from: 'modelled_outcome_distribution' },
      },
    })
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={makeNodes()} edges={[]} />)
    const rows = screen.getByTestId('goal-fit-parity')
    // The possessive claim names a question the substituted number does not
    // answer — the register's withheld arm renders instead.
    expect(rows).not.toHaveTextContent('chance of hitting your goal')
    expect(rows).toHaveTextContent('chance of meeting every target this run scored')
    // Doctrine B: the caveat must sit adjacent to the number.
    expect(screen.getByTestId('goal-fit-modelled-caveat')).toHaveTextContent(
      "Modelled from the target's projected outcome distribution",
    )
  })
})

describe('honest gates — no partial rankings, no rows without a basis', () => {
  it('one option without an admissible figure → NO rows at all (complete-field rule)', () => {
    const probs = walkOptionProbabilities()
    delete probs.opt_statusquo
    setResults(probs)
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={makeNodes()} edges={[]} />)
    expect(screen.getByTestId('model-goal-section')).toBeInTheDocument()
    expect(screen.queryByTestId('goal-fit-parity')).toBeNull()
  })

  it('no target set on the goal → no rows even with full figures', () => {
    setResults(walkOptionProbabilities())
    const nodes = makeNodes().map(n =>
      n.id === 'goal_arr'
        ? ({ ...n, data: { label: 'Reach £1,000,000 ARR' } } as Node)
        : n,
    )
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={nodes} edges={[]} />)
    expect(screen.getByTestId('model-goal-section')).toBeInTheDocument()
    expect(screen.queryByTestId('goal-fit-parity')).toBeNull()
  })

  it('no analysis results → the goal card is unchanged (target row only)', () => {
    setResults(undefined)
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={makeNodes()} edges={[]} />)
    expect(screen.getByTestId('model-goal-section')).toBeInTheDocument()
    expect(screen.queryByTestId('goal-fit-parity')).toBeNull()
  })

  it('sub-1% figures render the floor readout, never a rounded-to-zero claim', () => {
    const probs = walkOptionProbabilities()
    probs.opt_statusquo = { win_probability: 0.0145, goal_probability: 0.004 }
    setResults(probs)
    render(<ModelTabBody {...DEFAULT_PROPS} nodes={makeNodes()} edges={[]} />)
    expect(screen.getByTestId('goal-fit-parity')).toHaveTextContent('< 1%')
  })
})

/**
 * Render matrix — FactorNode + OptionNode × Standard / Detailed × pre / post analysis.
 *
 * Polish 4 follow-up Item A. The audit table in the polish-4 brief defines
 * the canonical chip / coaching / value-display state per node per phase per
 * view. Without a matrix test, those rules drift one node-edit at a time —
 * a chip migrates between body and popover, a coaching line gets dropped from
 * a gate, the differentiator fires in the wrong view. This file pins the
 * audit table by sweeping all 8 combinations and asserting the visible state.
 *
 * Each case asserts (where applicable):
 *   - chips present / absent per the audit table
 *   - coaching line gated to top-3 (high-priority) factors
 *   - value suppression for scale-no-raw factors
 *   - differentiator line only renders in Standard pre-analysis on options
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { DecisionNode } from '../DecisionNode'
import { GoalNode } from '../GoalNode'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })
  ),
}))
// Spread the real flags module so newly-added flags (e.g. any flag GoalNode
// transitively reads through useAnalysisTrust → useAnalysisStateSource) never go
// silently absent and throw at render — see CLAUDE.md #12 (derive, don't mirror).
// Only the three flags this suite deliberately pins are overridden to false.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../hooks/useScienceIcons', () => ({
  useScienceIcons: vi.fn(() => []),
}))

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

// Make NodePopover transparent so we can read its rendered content directly
// (otherwise the popover is hidden behind a 300ms hover delay).
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="node-popover">{children}</div>
  ),
}))

type ViewMode = 'standard' | 'expert'
type Phase = 'pre' | 'post'

interface MatrixState {
  viewMode: ViewMode
  phase: Phase
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
  ceeAnalysisReady?: { options?: Array<{ id: string; interventions: Record<string, unknown> }> } | null
  goalThreshold?: number | null
  goalConstraints?: Array<Record<string, unknown>>
  report?: Record<string, unknown> | null
}

function buildStoreState(state: MatrixState) {
  return {
    hoveredOptionId: null,
    nodes: state.nodes,
    edges: state.edges,
    ceeAnalysisReady: state.ceeAnalysisReady ?? null,
    results: {
      status: state.phase === 'post' ? 'complete' : 'idle',
      report: state.phase === 'post' ? (state.report ?? {}) : null,
    },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: state.goalThreshold ?? null,
    goalConstraints: state.goalConstraints ?? [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode: state.viewMode,
  }
}

function applyStore(state: MatrixState) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector(buildStoreState(state)),
  )
}

const baseFactorProps = {
  id: 'factor-1',
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const baseOptionProps = { ...baseFactorProps, id: 'option-1', type: 'option' }

function renderFactor(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <FactorNode {...baseFactorProps} data={data} />
    </ReactFlowProvider>
  )
}

function renderOption(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseOptionProps} data={{ label: 'Aggressive plan', type: 'option', ...data }} />
    </ReactFlowProvider>
  )
}

describe('Render matrix — FactorNode × view × phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    } as any)
  })

  // Topology: factor-1 is the rendered top-3 inferred factor on Outcome path.
  // Three other factors exist so the rank computation has something to sort.
  const topInferredTopology = (viewMode: ViewMode, phase: Phase): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Marketing Expertise Available' } },
      { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
      { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
      { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
    ],
    // `weightSource` is REQUIRED on every edge here: the pre-analysis priority
    // ranking is provenance-gated, and with no sourced strength anywhere there
    // is no ranking, so no factor is quieted and the low-priority case below
    // could not be reached at all. These are the weights the ranking is
    // supposed to read.
    edges: [
      { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 1, direction: 'positive', weightSource: 'cee' } },
      { id: 'e2', source: 'factor-2', target: 'outcome-1', data: { weight: 0.1, direction: 'positive', weightSource: 'cee' } },
      { id: 'e3', source: 'factor-3', target: 'outcome-1', data: { weight: 0.1, direction: 'positive', weightSource: 'cee' } },
      { id: 'e4', source: 'factor-4', target: 'outcome-1', data: { weight: 0.1, direction: 'positive', weightSource: 'cee' } },
    ],
  })

  it('Standard pre: top inferred factor shows "What evidence supports this?" body chip and no popover-only duplicate', () => {
    applyStore(topInferredTopology('standard', 'pre'))
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    // Body chip canonical, popover doesn't duplicate it.
    const chips = screen.getAllByText('What evidence supports this?')
    expect(chips).toHaveLength(1)
    // Value suppression: scale-no-raw fractional value is hidden.
    expect(screen.queryByText(/0\.5/)).toBeNull()
    expect(screen.queryByText(/scale/i)).toBeNull()
  })

  it('Standard post: top inferred factor coaching line is gated by isHighPriority and shows', () => {
    applyStore(topInferredTopology('standard', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 0.8,
      confidence: 0.3,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    } as any)
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    // Synthesised coaching line ("High influence, low confidence.") fires.
    expect(screen.getByText(/High influence, low confidence/i)).toBeDefined()
  })

  it('Detailed pre: top inferred factor shows pre-analysis layer 2 coaching ONLY when high-priority', () => {
    applyStore(topInferredTopology('expert', 'pre'))
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    // Item 3: coaching line gated to top-3. factor-1 has the strongest edge,
    // so it ranks #1 → high priority → coaching line renders inline.
    expect(screen.getByText(/Olumi estimated this from your brief/i)).toBeDefined()
  })

  it('Detailed pre: low-priority inferred factor does NOT show the coaching line', () => {
    // Render factor-4 instead — bottom of the 4-factor ranking with weak edges.
    applyStore({
      ...topInferredTopology('expert', 'pre'),
      // Make factor-2 .. factor-4 the rendered node so it ranks low.
    })
    render(
      <ReactFlowProvider>
        <FactorNode
          {...baseFactorProps}
          id="factor-4"
          data={{
            type: 'factor',
            label: 'Low priority factor',
            category: 'controllable',
            observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
          }}
        />
      </ReactFlowProvider>
    )
    // Low-priority → coaching line suppressed in Detailed view too.
    expect(screen.queryByText(/Olumi estimated this from your brief/i)).toBeNull()
  })

  it('Detailed post: factor body shows full layer 2 (no synthesised coaching line — Detailed-specific)', () => {
    applyStore(topInferredTopology('expert', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 0.8,
      confidence: 0.3,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    } as any)
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    // Synthesised coaching line is Standard-only (gate at !isDetailed).
    expect(screen.queryByText(/High influence, low confidence/i)).toBeNull()
  })
})

describe('Render matrix — OptionNode × view × phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    } as any)
  })

  // Two non-baseline options with different intervention magnitudes so the
  // differentiator can fire in pre-analysis Standard.
  const twoOptionTopology = (viewMode: ViewMode, phase: Phase): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'option-1', type: 'option', data: { label: 'Aggressive plan', type: 'option' } },
      { id: 'option-2', type: 'option', data: { label: 'Conservative plan', type: 'option' } },
      {
        id: 'factor-1',
        type: 'factor',
        data: {
          label: 'Hiring rate',
          observedState: { unit: 'engineers', value: 0.3, raw_value: 3, cap: 10 },
        },
      },
    ],
    edges: [],
    ceeAnalysisReady: {
      options: [
        { id: 'option-1', interventions: { 'factor-1': 0.9 } },
        { id: 'option-2', interventions: { 'factor-1': 0.3 } },
      ],
    },
  })

  it('Standard pre non-baseline: shows "What could go wrong?" chip + from→to chip (footer de-duped)', () => {
    applyStore(twoOptionTopology('standard', 'pre'))
    const { container } = renderOption({})
    expect(screen.getByText('What could go wrong?')).toBeDefined()
    // Both options share the top factor (option-1 at 0.9 on engineers cap=10 →
    // "9 engineers"). Brief scope 7: that value shows in the from→to chip
    // ("3 engineers → 9 engineers"), so the duplicate differentiator footer <p>
    // is dropped.
    const chip = screen.getByText((t: string) => t.includes('9 engineers') && t.includes('→'))
    expect(chip).toBeDefined()
    const allPs = container.querySelectorAll('p')
    const differentiatorP = Array.from(allPs).find(p => p.textContent?.includes('→'))
    expect(differentiatorP).toBeUndefined()
  })

  it('Standard pre: identical shared-factor values suppress differentiator on both options', () => {
    // Both options intervene on factor-1 at the same value → dedup suppresses both
    applyStore({
      ...twoOptionTopology('standard', 'pre'),
      ceeAnalysisReady: {
        options: [
          { id: 'option-1', interventions: { 'factor-1': 0.9 } },
          { id: 'option-2', interventions: { 'factor-1': 0.9 } },
        ],
      },
    })
    const { container } = renderOption({})
    // No differentiator <p> should exist — both would produce identical text
    const allPs = container.querySelectorAll('p')
    const differentiatorP = Array.from(allPs).find(
      p => p.textContent?.includes('→') || /key difference/i.test(p.textContent ?? '')
    )
    expect(differentiatorP).toBeUndefined()
  })

  it('Standard post non-leading: shows "What would make this lead?" chip and NO differentiator', () => {
    applyStore(twoOptionTopology('standard', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.4, // not the winner
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.getByText('What would make this lead?')).toBeDefined()
    // Differentiator is pre-analysis only.
    expect(screen.queryByText(/key difference/i)).toBeNull()
  })

  it('Detailed pre non-baseline: differentiator line is hidden (Standard-only)', () => {
    applyStore(twoOptionTopology('expert', 'pre'))
    renderOption({})
    expect(screen.queryByText(/key difference/i)).toBeNull()
    // Pre-analysis chip still present.
    expect(screen.getByText('What could go wrong?')).toBeDefined()
  })

  it('Detailed post: chips render but differentiator never appears', () => {
    applyStore(twoOptionTopology('expert', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.4,
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.queryByText(/key difference/i)).toBeNull()
    expect(screen.getByText('What would make this lead?')).toBeDefined()
  })

  // ---- Graph v2 Task 4: close-call variant ----

  // Topology where option-1 (the rendered node) is non-leader within 5pp
  // of option-2 (the leader). Includes the report so the close-call useMemo
  // can read win probabilities.
  const closeCallTopology = (gapPp: number): MatrixState => ({
    viewMode: 'standard',
    phase: 'post',
    nodes: [
      { id: 'option-1', type: 'option', data: { label: 'Aggressive plan', type: 'option' } },
      { id: 'option-2', type: 'option', data: { label: 'Conservative plan', type: 'option' } },
      {
        id: 'factor-1',
        type: 'factor',
        data: { label: 'Hiring rate', observedState: { unit: 'engineers', value: 0.3, raw_value: 3, cap: 10 } },
      },
    ],
    edges: [],
    ceeAnalysisReady: {
      options: [
        { id: 'option-1', interventions: { 'factor-1': 0.5 } },
        { id: 'option-2', interventions: { 'factor-1': 0.9 } },
      ],
    },
    report: {
      robustness: {
        recommended_option_id: 'option-2',
        // ROADMAP 1.239: the close-call line and the "Behind:" reason now both
        // require an ENTITLED leader, not merely an identified one. This
        // fixture has always MEANT "this run has a leader" — it just never
        // said so, and the deleted win-probability derivation was supplying
        // the entitlement for it. Adding the producer's own near-tie verdict
        // makes the fixture state what it means, and keeps the gap-10pp
        // negative test below honest: without it that test would pass because
        // the claim is withheld, not because 10pp is outside the 5pp window.
        near_tie: { is_tie: false, top_option_id: 'option-2' },
      },
      option_probabilities: {
        'option-1': { win_probability: 0.50 - gapPp / 100 },
        'option-2': { win_probability: 0.50 },
      },
    },
  })

  it('Standard post non-leader, gap 3pp: shows "Close call: within 3 percentage points" and keeps "Behind:" line', () => {
    applyStore(closeCallTopology(3))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.47, // not the leader
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.getByText('Close call: within 3 percentage points')).toBeDefined()
    expect(screen.getByText(/Behind:/)).toBeDefined()
  })

  it('Standard post non-leader, gap 1pp: pluralisation drops the trailing "s"', () => {
    applyStore(closeCallTopology(1))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.49,
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.getByText('Close call: within 1 percentage point')).toBeDefined()
  })

  it('Standard post non-leader, sub-percent gap (0.4pp): floor at 1pp, never reads "0 percentage points"', () => {
    // Gap of 0.004 → Math.round → 0; floor clamps to 1pp so the line never
    // reads the awkward "within 0 percentage points" phrasing.
    applyStore({
      viewMode: 'standard',
      phase: 'post',
      nodes: [
        { id: 'option-1', type: 'option', data: { label: 'Aggressive plan', type: 'option' } },
        { id: 'option-2', type: 'option', data: { label: 'Conservative plan', type: 'option' } },
      ],
      edges: [],
      report: {
        // ROADMAP 1.239: producer signal supplied for the same reason as
        // `closeCallTopology` above — this fixture means "there is a leader".
        robustness: {
          recommended_option_id: 'option-2',
          near_tie: { is_tie: false, top_option_id: 'option-2' },
        },
        option_probabilities: {
          'option-1': { win_probability: 0.496 },
          'option-2': { win_probability: 0.500 },
        },
      },
    })
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.496,
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.getByText('Close call: within 1 percentage point')).toBeDefined()
    expect(screen.queryByText(/within 0 percentage point/)).toBeNull()
  })

  it('Standard post close-call: "What would change this?" chip is added alongside "What would make this lead?"', () => {
    applyStore(closeCallTopology(3))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.47,
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.getByText('What would change this?')).toBeDefined()
    expect(screen.getByText('What would make this lead?')).toBeDefined()
  })

  it('Standard post non-leader, gap 10pp: NO close-call line, NO "What would change this?" chip', () => {
    applyStore(closeCallTopology(10))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.40,
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.queryByText(/Close call:/)).toBeNull()
    expect(screen.queryByText('What would change this?')).toBeNull()
    // The standard "What would make this lead?" chip is still present.
    expect(screen.getByText('What would make this lead?')).toBeDefined()
  })

  it('Standard post leader: NO close-call line on the leader itself', () => {
    applyStore(closeCallTopology(3))
    // Mark this rendered option (option-1) as the leader by giving it the
    // higher win probability and making the report point at it.
    applyStore({
      ...closeCallTopology(3),
      report: {
        robustness: { recommended_option_id: 'option-1' },
        option_probabilities: {
          'option-1': { win_probability: 0.55 },
          'option-2': { win_probability: 0.45 },
        },
      },
    })
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.55,
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.queryByText(/Close call:/)).toBeNull()
  })

  it('Pre Standard non-baseline: close-call line never renders pre-analysis', () => {
    applyStore({ ...closeCallTopology(3), phase: 'pre' })
    renderOption({})
    expect(screen.queryByText(/Close call:/)).toBeNull()
  })
})

// ============================================================================
// Polish 4 review (Improvement B): extend the matrix to Decision/Goal/Outcome/Risk
// so the audit-table chip counts are pinned across every node type, not just
// FactorNode + OptionNode. Each node has its own constraint set per the brief
// audit table — these tests assert chip presence/absence in the body for each
// (phase × view) cell.
// ============================================================================

const baseDecisionProps = {
  ...baseFactorProps,
  id: 'decision-1',
  type: 'decision',
}
const baseGoalProps = { ...baseFactorProps, id: 'goal-1', type: 'goal' }
const baseOutcomeProps = { ...baseFactorProps, id: 'outcome-1', type: 'outcome' }
const baseRiskProps = { ...baseFactorProps, id: 'risk-1', type: 'risk' }

function renderDecision(data: Record<string, unknown> = {}) {
  return render(
    <ReactFlowProvider>
      <DecisionNode {...baseDecisionProps} data={{ label: 'Hiring decision', type: 'decision', ...data }} />
    </ReactFlowProvider>
  )
}
function renderGoal(data: Record<string, unknown> = {}) {
  return render(
    <ReactFlowProvider>
      <GoalNode {...baseGoalProps} data={{ label: 'Reach revenue', type: 'goal', ...data }} />
    </ReactFlowProvider>
  )
}
function renderOutcome(data: Record<string, unknown> = {}) {
  return render(
    <ReactFlowProvider>
      <OutcomeNode {...baseOutcomeProps} data={{ label: 'Revenue growth', type: 'outcome', ...data }} />
    </ReactFlowProvider>
  )
}
function renderRisk(data: Record<string, unknown> = {}) {
  return render(
    <ReactFlowProvider>
      <RiskNode {...baseRiskProps} data={{ label: 'Key person dependency', type: 'risk', ...data }} />
    </ReactFlowProvider>
  )
}

describe('Render matrix — DecisionNode chip audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  // A decision with options so the pre-analysis branch renders.
  //
  // Post-analysis branch: ROADMAP 1.223 routes the "{winner} leads in N% of
  // scenarios" headline through `deriveDecisionVerdict`, and the ENTIRE
  // post-analysis body hangs off that headline — the Detailed stability line
  // and the Detailed post chips included. `recommended_option_id` is no longer
  // sufficient: it answers "who leads?", never "is there a leader at all?".
  // The verdict needs both halves —
  //   · TWO comparable options (below two, "leading" has no meaning), and
  //   · a producer leader claim (PLoT `computeNearTie`) naming the
  //     win-probability RANK-1 option, which is what its identity gate checks.
  // The pre-analysis cells are unaffected: `report` is null there, and the
  // second option keeps optionCount below the 3 that triage rule 4 keys on.
  //
  // Includes a missing-value factor + an inferred factor so the legacy pill
  // code (now removed) would have rendered "1 gap" / "1 estimate" pills — used
  // to assert the pills are gone.
  const decisionTopology = (viewMode: ViewMode, phase: Phase, stability?: number): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'decision-1', type: 'decision', data: { label: 'Hiring decision', type: 'decision' } },
      { id: 'option-1', type: 'option', data: { label: 'Hire 3', type: 'option' } },
      { id: 'option-2', type: 'option', data: { label: 'Hire none', type: 'option' } },
      { id: 'factor-missing', type: 'factor', data: { type: 'factor', label: 'Cost', category: 'controllable' } },
      { id: 'factor-inferred', type: 'factor', data: { type: 'factor', label: 'Demand', category: 'controllable', observedState: { value: 0.5, extractionType: 'inferred' } } },
    ],
    edges: [
      { id: 'e1', source: 'decision-1', target: 'option-1', data: {} },
      { id: 'e2', source: 'decision-1', target: 'option-2', data: {} },
    ],
    report: phase === 'post' ? {
      robustness: {
        recommended_option_id: 'option-1',
        recommendation_stability: stability ?? 0.93,
        // option-1 is the win argmax, so the producer's claim applies to it.
        near_tie: { is_tie: false, top_option_id: 'option-1' },
      },
      option_probabilities: {
        'option-1': { win_probability: 0.7 },
        'option-2': { win_probability: 0.3 },
      },
    } : null,
  })

  it('Standard pre: shows "Explore more options" + ("Run analysis" XOR "What could go wrong?") — never 3 chips', () => {
    applyStore(decisionTopology('standard', 'pre'))
    renderDecision()
    expect(screen.getByText('Explore more options')).toBeDefined()
    // Exactly one of the secondary chips renders, never both at once.
    const runAnalysis = screen.queryAllByText('Run analysis').length
    const couldGoWrong = screen.queryAllByText('What could go wrong?').length
    expect(runAnalysis + couldGoWrong).toBe(1)
    // No legacy "Review model readiness" chip leaks into the popover.
    expect(screen.queryByText('Review model readiness')).toBeNull()
  })

  it('Standard post: shows "Challenge this result" + "Compare options"', () => {
    applyStore(decisionTopology('standard', 'post'))
    renderDecision()
    expect(screen.getByText('Challenge this result')).toBeDefined()
    expect(screen.getByText('Compare options')).toBeDefined()
  })

  it('Detailed pre: same chip set as Standard pre — pre-analysis chip rules are view-agnostic for Decision', () => {
    applyStore(decisionTopology('expert', 'pre'))
    renderDecision()
    expect(screen.getByText('Explore more options')).toBeDefined()
    const runAnalysis = screen.queryAllByText('Run analysis').length
    const couldGoWrong = screen.queryAllByText('What could go wrong?').length
    expect(runAnalysis + couldGoWrong).toBe(1)
  })

  it('Detailed post: same post chips as Standard post', () => {
    applyStore(decisionTopology('expert', 'post'))
    renderDecision()
    expect(screen.getByText('Challenge this result')).toBeDefined()
    expect(screen.getByText('Compare options')).toBeDefined()
  })

  // ---- Graph v2 simplification ----

  it('Standard pre: no health pills (gaps / estimates / biases) render in body', () => {
    applyStore(decisionTopology('standard', 'pre'))
    renderDecision()
    expect(screen.queryByText(/\d+ gap/i)).toBeNull()
    expect(screen.queryByText(/\d+ estimate/i)).toBeNull()
    expect(screen.queryByText(/\d+ bias/i)).toBeNull()
  })

  it('Detailed pre: no health pills render in body', () => {
    applyStore(decisionTopology('expert', 'pre'))
    renderDecision()
    expect(screen.queryByText(/\d+ gap/i)).toBeNull()
    expect(screen.queryByText(/\d+ estimate/i)).toBeNull()
    expect(screen.queryByText(/\d+ bias/i)).toBeNull()
  })

  it('Standard post: no "Stability:" text in body — moved to popover', () => {
    applyStore(decisionTopology('standard', 'post', 0.93))
    renderDecision()
    // The body must not contain "Stability:" — that lives in the Detailed
    // body and the Standard popover. The popover is rendered (via the
    // NodePopover mock) but it appears under data-testid="node-popover".
    const popovers = screen.queryAllByTestId('node-popover')
    // Filter out the popover content and assert no stand-alone "Stability:"
    // sentence outside it.
    const bodyHasStabilityLine = screen.queryAllByText(/Stability:/).length
    // If a "Stability:" line exists at all, it must be inside the popover.
    if (bodyHasStabilityLine > 0) {
      const popoverHtml = popovers.map(p => p.innerHTML).join('')
      expect(popoverHtml).toMatch(/Stability/)
    }
    // The Detailed-style "Stability: 93% (robust)" line never renders in
    // Standard post — assert directly.
    expect(screen.queryByText(/Stability: 93%/)).toBeNull()
  })

  it('Detailed post: stability line renders in body', () => {
    applyStore(decisionTopology('expert', 'post', 0.93))
    renderDecision()
    expect(screen.getByText(/Stability: 93% \(robust\)/)).toBeDefined()
  })

  it('Standard post: popover contains stability label and percentage', () => {
    applyStore(decisionTopology('standard', 'post', 0.93))
    renderDecision()
    const popover = screen.getByTestId('node-popover')
    expect(popover.textContent).toContain('Stability')
    expect(popover.textContent).toContain('93%')
    expect(popover.textContent).toContain('robust')
  })

  it('Standard pre: no science icon header wrapper renders', () => {
    applyStore(decisionTopology('standard', 'pre'))
    const { container } = renderDecision()
    // The science-icon header was an inline-flex span next to the title.
    // useScienceIcons is mocked to [] globally, so even before this change
    // the wrapper was empty — but this assertion pins the expectation that
    // the wrapper itself is gone (no headerSlot prop passed).
    expect(container.querySelector('.inline-flex.items-center.gap-1')).toBeNull()
  })
})

describe('Render matrix — GoalNode chip audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  const goalTopology = (viewMode: ViewMode, phase: Phase, hasThreshold: boolean): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Reach revenue', type: 'goal' } },
    ],
    edges: [],
    goalThreshold: hasThreshold ? 100000 : null,
  })

  it('Goal no-target Standard pre: shows "Help me set a target" only', () => {
    applyStore(goalTopology('standard', 'pre', false))
    renderGoal()
    expect(screen.getByText('Help me set a target')).toBeDefined()
    expect(screen.queryByText('Identify risks')).toBeNull() // removed in audit
    expect(screen.queryByText('Run analysis')).toBeNull()
  })

  it('Goal with-target Standard pre: shows "Run analysis" chip', () => {
    applyStore(goalTopology('standard', 'pre', true))
    renderGoal({ goal_threshold_raw: 100000 })
    expect(screen.getByText('Run analysis')).toBeDefined()
    expect(screen.queryByText('Help me set a target')).toBeNull()
  })

  it('Goal with-target Standard post: shows "Is my target realistic?" chip', () => {
    applyStore(goalTopology('standard', 'post', true))
    renderGoal({ goal_threshold_raw: 100000 })
    // Body chip post-analysis.
    expect(screen.getAllByText('Is my target realistic?').length).toBeGreaterThanOrEqual(1)
  })

  it('Goal no-target Standard post: shows "Help me set a target"', () => {
    applyStore(goalTopology('standard', 'post', false))
    renderGoal()
    expect(screen.getByText('Help me set a target')).toBeDefined()
  })
})

describe('Render matrix — OutcomeNode chip audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  const outcomeTopology = (viewMode: ViewMode, phase: Phase): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'outcome-1', type: 'outcome', data: { label: 'Revenue growth', type: 'outcome' } },
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', type: 'goal' } },
      { id: 'factor-1', type: 'factor', data: { label: 'Hiring rate', type: 'factor' } },
    ],
    edges: [
      { id: 'b1', source: 'outcome-1', target: 'goal-1', data: { weight: 0.5, direction: 'positive' } },
      { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 0.7, exists_probability: 0.9 } },
    ],
  })

  it('Standard pre: shows "What strengthens this?" body chip (added Polish 4)', () => {
    applyStore(outcomeTopology('standard', 'pre'))
    renderOutcome()
    expect(screen.getByText('What strengthens this?')).toBeDefined()
    // Removed popover chip stays gone.
    expect(screen.queryByText('Are there other outcomes that matter?')).toBeNull()
  })

  it('Standard post: no body chip (popover handles post-analysis coaching)', () => {
    applyStore(outcomeTopology('standard', 'post'))
    renderOutcome()
    // No "What strengthens" body chip post-analysis.
    expect(screen.queryByText('What strengthens this?')).toBeNull()
  })

  it('Detailed pre: same chip set — view-agnostic for Outcome', () => {
    applyStore(outcomeTopology('expert', 'pre'))
    renderOutcome()
    expect(screen.getByText('What strengthens this?')).toBeDefined()
  })

  it('Detailed post: no body chip', () => {
    applyStore(outcomeTopology('expert', 'post'))
    renderOutcome()
    expect(screen.queryByText('What strengthens this?')).toBeNull()
  })
})

describe('Render matrix — RiskNode chip audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  const riskTopology = (viewMode: ViewMode, phase: Phase): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'risk-1', type: 'risk', data: { label: 'Key person dependency', type: 'risk' } },
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', type: 'goal' } },
    ],
    edges: [
      { id: 'b1', source: 'risk-1', target: 'goal-1', data: { weight: 0.4, direction: 'negative' } },
    ],
  })

  it('Standard pre: shows BOTH "What reduces this?" + "Add mitigation" (Polish 4 made them both phases)', () => {
    applyStore(riskTopology('standard', 'pre'))
    renderRisk()
    expect(screen.getByText('What reduces this?')).toBeDefined()
    expect(screen.getByText('Add mitigation')).toBeDefined()
    // Removed popover chips stay gone.
    expect(screen.queryByText('Are there other risks?')).toBeNull()
    expect(screen.queryByText("What's the worst case?")).toBeNull()
  })

  it('Standard post: same two chips', () => {
    applyStore(riskTopology('standard', 'post'))
    renderRisk()
    expect(screen.getByText('What reduces this?')).toBeDefined()
    expect(screen.getByText('Add mitigation')).toBeDefined()
  })

  it('Detailed pre: same two chips — view-agnostic for Risk', () => {
    applyStore(riskTopology('expert', 'pre'))
    renderRisk()
    expect(screen.getByText('What reduces this?')).toBeDefined()
    expect(screen.getByText('Add mitigation')).toBeDefined()
  })

  it('Detailed post: same two chips', () => {
    applyStore(riskTopology('expert', 'post'))
    renderRisk()
    expect(screen.getByText('What reduces this?')).toBeDefined()
    expect(screen.getByText('Add mitigation')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// display_value + is_baseline render coverage (audit 2026-04-14, §4A/§4B)
//
// Prior to this block, 125 FactorNode assertions covered zero display_value
// paths. These pin the CEE-verbatim path end-to-end.
// ---------------------------------------------------------------------------
describe('FactorNode — display_value rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    } as any)
  })

  const singleFactorTopology = (viewMode: ViewMode, phase: Phase, factorData: Record<string, unknown>): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'factor-1', type: 'factor', data: { type: 'factor', ...factorData } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
    ],
    edges: [
      { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
    ],
  })

  it('Standard pre: binary factor with value 0 renders display_value verbatim, NOT "0"', () => {
    const data = {
      label: 'Dedicated Tech Lead',
      category: 'controllable',
      observedState: {
        value: 0,
        display_value: 'No tech lead in place',
        factor_type: 'binary',
      },
    }
    applyStore(singleFactorTopology('standard', 'pre', data))
    renderFactor(data)
    expect(screen.getByText('No tech lead in place')).toBeDefined()
    // "0" alone must not appear as the rendered value — display_value took priority.
    expect(screen.queryByText('0', { exact: true })).toBeNull()
  })

  it('Standard pre: currency raw_value + unit takes priority over stale display_value', () => {
    // V5 stale-value-protection: with a stale display_value="£20,000" still on
    // the node, the formatter must still render the fresh raw_value (£49,000)
    // because Pattern 1 (raw_value + meaningful unit) outranks display_value.
    // Before May 2026 the formatter granted display_value absolute priority,
    // which would have rendered "£20,000" here — the discriminatory raw vs
    // stale display values pin the rule properly. The pre-discriminatory
    // version of this test set both fields to "£49,000" and passed regardless
    // of priority (which proved nothing).
    const data = {
      label: 'Salary offer',
      category: 'controllable',
      observedState: {
        value: 0.49,
        raw_value: 49000,
        unit: '£',
        display_value: '£20,000',
      },
    }
    applyStore(singleFactorTopology('standard', 'pre', data))
    renderFactor(data)
    expect(screen.getByText('£49,000')).toBeDefined()
    expect(screen.queryByText('£20,000')).toBeNull()
  })

  // V5 stale-value-protection — live React component path. Mirrors the
  // formatter (formatFactorDisplayValue.spec), shared-entry-point
  // (factorDisplayText), and debug bundle (exportBundle.displayState.spec)
  // tests on the live FactorNode. Pinning the regression at the actual
  // rendered DOM ensures no FactorNode prop wiring change can silently
  // reintroduce stale-display drift even if the formatter test stays green.
  it('Standard pre: V5 stale-currency — raw_value=26000 + unit=£ + stale display_value="£20,000" renders "£26,000" exactly', () => {
    const data = {
      label: 'Advertising Budget Allocated',
      category: 'controllable',
      display_value: '£20,000',
      observedState: {
        value: 0.26,
        raw_value: 26000,
        unit: '£',
        cap: 100000,
        display_value: '£20,000',
      },
    }
    applyStore(singleFactorTopology('standard', 'pre', data))
    renderFactor(data)
    expect(screen.getByText('£26,000')).toBeDefined()
    expect(screen.queryByText('£20,000')).toBeNull()
    // Negative assertions mirror the bundle test — none of the round-1
    // broken shapes can silently re-emerge from a future FactorNode change.
    expect(screen.queryByText('0.26 £')).toBeNull()
    expect(screen.queryByText('£26000')).toBeNull()
  })

  it('Standard pre: display_value=null falls back to heuristic (value suppressed for scale with no raw)', () => {
    const data = {
      label: 'Capability score',
      category: 'controllable',
      observedState: {
        value: 0.3,
        unit: 'scale',
        display_value: null,
      },
    }
    applyStore(singleFactorTopology('standard', 'pre', data))
    renderFactor(data)
    // No display_value → heuristic suppresses scale-only normalised value.
    expect(screen.queryByText(/0\.3/)).toBeNull()
  })

  // Golden-fixture-derived test — pins the real production-wire shape against
  // rendering. CEE emits `display_value` at the top level of the factor node,
  // parallel to `observed_state` (not inside it).
  // Brief Task 4C: "Use a factor from that fixture with its actual display_value
  // to verify the production data shape renders correctly."
  it('Standard pre: renders top-level display_value from golden fixture (real CEE wire shape)', async () => {
    // Import the fixture at test time (dynamic import keeps the matrix top-level
    // synchronous). Pick a factor with display_value at the top of the node.
    const fixture = await import('../../../test/fixtures/golden-path-staging-2026-04-05.json')
    type FixtureNode = {
      id: string
      kind?: string
      label?: string
      display_value?: string
      observed_state?: Record<string, unknown>
      [key: string]: unknown
    }
    const graphNodes = (fixture as any).default?.cee_request?.graph_state?.nodes as FixtureNode[]
    expect(graphNodes).toBeDefined()
    const fac = graphNodes.find(
      (n) => n.kind === 'factor' && typeof n.display_value === 'string' && n.display_value.length > 0,
    )
    expect(fac).toBeDefined()
    // Map snake_case observed_state → camelCase observedState, matching
    // applyDraftResult's node normalisation (src/canvas/utils/applyDraftResult.ts:54).
    const { observed_state, kind, id: _id, ...rest } = fac!
    const data: Record<string, unknown> = {
      ...rest,
      type: kind,
      ...(observed_state ? { observedState: observed_state } : {}),
    }
    applyStore(singleFactorTopology('standard', 'pre', data))
    renderFactor(data)
    expect(screen.getByText(fac!.display_value!)).toBeDefined()
  })
})

describe('OptionNode — is_baseline rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    } as any)
  })

  const optionOnlyTopology = (viewMode: ViewMode, phase: Phase, optionData: Record<string, unknown>): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'option-1', type: 'option', data: { type: 'option', ...optionData } },
      { id: 'option-2', type: 'option', data: { type: 'option', label: 'Alternative' } },
      { id: 'decision-1', type: 'decision', data: { type: 'decision', label: 'D' } },
    ],
    edges: [],
  })

  it('Standard pre: is_baseline=true renders "No changes to factors"', () => {
    const data = { label: 'Any Label', is_baseline: true }
    applyStore(optionOnlyTopology('standard', 'pre', data))
    renderOption(data)
    // Rendered in both the body text and the popover; both are the baseline
    // treatment path so we assert presence (length > 0), not uniqueness.
    expect(screen.getAllByText(/No changes to factors/i).length).toBeGreaterThan(0)
  })

  it('Standard pre: is_baseline=null + "Status Quo" label fires regex fallback (baseline treatment)', () => {
    const data = { label: 'Status Quo', is_baseline: null }
    applyStore(optionOnlyTopology('standard', 'pre', data))
    renderOption(data)
    expect(screen.getAllByText(/No changes to factors/i).length).toBeGreaterThan(0)
  })

  // Correction #7 — critical: explicit `false` must suppress the regex, even
  // if the label happens to match. This is why the detection changed from OR
  // to nullish-coalesce (OptionNode:52-59, 375-379).
  it('Standard pre: is_baseline=false + "Status Quo" label does NOT render baseline treatment', () => {
    const data = { label: 'Status Quo', is_baseline: false }
    applyStore(optionOnlyTopology('standard', 'pre', data))
    renderOption(data)
    expect(screen.queryByText(/No changes to factors/i)).toBeNull()
  })
})

describe('N1 — per-type selection ring', () => {
  const nodeState = (highlightedIds: string[] = []) => ({
    hoveredOptionId: null,
    nodes: [],
    edges: [],
    ceeAnalysisReady: null,
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(highlightedIds),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode: 'expert',
  })
  const applyState = (highlightedIds: string[] = []) =>
    vi.mocked(useCanvasStore).mockImplementation((sel: any) => sel(nodeState(highlightedIds)))

  // @xyflow/react NodeProps require these; baseFactorProps predates that.
  const selProps = { ...baseFactorProps, selected: true, draggable: false, selectable: true, deletable: true }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
      achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  it('a selected factor node wears the factor-type ring, not the old hardcoded info ring', () => {
    applyState()
    render(<ReactFlowProvider><FactorNode {...selProps} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const group = screen.getAllByRole('group')[0]
    expect(group.className).toContain('ring-factor/50')
    expect(group.className).not.toContain('ring-info')
  })

  it('a selected risk node wears the danger-type ring', () => {
    applyState()
    render(<ReactFlowProvider><RiskNode {...selProps} id="risk-1" type="risk" data={{ label: 'Attrition' }} /></ReactFlowProvider>)
    const group = screen.getAllByRole('group')[0]
    expect(group.className).toContain('ring-danger/50')
  })

  it('selected + AI-highlighted: the highlight ring wins, the per-type selection ring is suppressed', () => {
    applyState(['factor-1'])
    render(<ReactFlowProvider><FactorNode {...selProps} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const group = screen.getAllByRole('group')[0]
    // N2: the AI-highlight ring is the info/AI hue (not goal) and wins over selection.
    expect(group.className).toContain('ring-info/60')
    expect(group.className).not.toContain('ring-factor/50')
  })

  it('N2: an AI-highlighted node gets the real pulse class (reduced-motion-safe in CSS)', () => {
    applyState(['factor-1'])
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const group = screen.getAllByRole('group')[0]
    expect(group.className).toContain('ai-highlight-pulse')
    expect(group.className).toContain('ring-info/60')
  })

  it('N3: a node in editedSinceRunNodeIds wears the amber edited dot', () => {
    vi.mocked(useCanvasStore).mockImplementation((sel: any) =>
      sel({ ...nodeState([]), editedSinceRunNodeIds: new Set(['factor-1']) }),
    )
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    expect(screen.getByTestId('edited-since-run-factor-1')).toBeInTheDocument()
  })

  it('N3: the edited dot carries the ratified accessible name (screen readers, not just hover)', () => {
    vi.mocked(useCanvasStore).mockImplementation((sel: any) =>
      sel({ ...nodeState([]), editedSinceRunNodeIds: new Set(['factor-1']) }),
    )
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    // A bare span with only `title` has no accessible name for most screen
    // readers — the ratified N3 spec requires the dot itself to announce
    // "Edited since the last analysis".
    expect(screen.getByRole('img', { name: 'Edited since the last analysis' })).toBe(
      screen.getByTestId('edited-since-run-factor-1'),
    )
  })

  it('N3: no edited dot when the node is not in the set (and no crash without the slice)', () => {
    applyState([])
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    expect(screen.queryByTestId('edited-since-run-factor-1')).toBeNull()
  })

  it('D2: at LOD zoom a factor node hides its title and body (shape only)', () => {
    vi.mocked(useCanvasStore).mockImplementation((sel: any) =>
      sel({ ...nodeState([]), lodActive: true }),
    )
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const title = screen.getAllByTestId('node-title')[0]
    expect(title).toHaveStyle({ visibility: 'hidden' })
  })

  it('D2: at LOD zoom a goal node keeps a boosted, visible title', () => {
    vi.mocked(useCanvasStore).mockImplementation((sel: any) =>
      sel({ ...nodeState([]), lodActive: true }),
    )
    render(<ReactFlowProvider><GoalNode {...selProps} id="goal-1" type="goal" selected={false} data={{ label: 'Ship the roadmap' }} /></ReactFlowProvider>)
    const title = screen.getAllByTestId('node-title')[0]
    expect(title).not.toHaveStyle({ visibility: 'hidden' })
    expect(title.className).toContain('font-semibold')
  })

  it('D2: at normal zoom titles render exactly as before (no LOD classes)', () => {
    applyState([])
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const title = screen.getAllByTestId('node-title')[0]
    expect(title).not.toHaveStyle({ visibility: 'hidden' })
    expect(title.className).not.toContain('text-lg')
  })

  it('N2: a non-highlighted node has no pulse', () => {
    applyState([])
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const group = screen.getAllByRole('group')[0]
    expect(group.className).not.toContain('ai-highlight-pulse')
  })
})

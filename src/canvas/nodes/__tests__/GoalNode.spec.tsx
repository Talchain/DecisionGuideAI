/**
 * GoalNode render tests
 * T10: Stability bar, Marginal badge, threshold context
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { GoalNode } from '../GoalNode'

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

vi.mock('../../../hooks/useCEEInsights', () => ({
  useCEEInsights: vi.fn(() => ({ data: null })),
}))

vi.mock('../../../hooks/useISLValidation', () => ({
  useISLValidation: vi.fn(() => ({ data: null })),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const baseProps = {
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

const renderGoal = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <GoalNode {...baseProps} data={{ label: 'Increase revenue', type: 'goal', ...data }} />
    </ReactFlowProvider>
  )

describe('GoalNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
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
    })
  })

  it('renders label', () => {
    renderGoal()
    expect(screen.getByText('Increase revenue')).toBeDefined()
  })

  it('renders shape indicator (type line removed in v1.1)', () => {
    renderGoal()
    // Type text label removed in v1.1 — shape icon with tooltip replaces it
    expect(screen.getByLabelText(/goal node/i)).toBeDefined()
  })

  // T10: Achievement probability
  it('shows achievement probability when available', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.73,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderGoal()
    expect(screen.getByText(/73.*% chance of reaching target/)).toBeDefined()
  })

  // Display-honesty (ROADMAP 1.6b follow-up, claim-integrity): modelled-basis
  // caveat, same gate/wording as OptionCards' goal_fit_basis caveat.
  it('renders the modelled-basis caveat adjacent to the number when flagged', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.73,
      achievementProbabilityIsModelledBasis: true,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderGoal()
    expect(screen.getByTestId('goal-fit-basis-caveat-node')).toHaveTextContent(
      "Modelled from the target's projected outcome distribution, not a directly-set starting value.",
    )
  })

  it('renders no caveat when the flag is absent (honest default)', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.73,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderGoal()
    expect(screen.queryByTestId('goal-fit-basis-caveat-node')).toBeNull()
  })

  // T10: Stability bar
  it('shows stability bar with percentage from report robustness', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            robustness: {
              recommendation_stability: 0.82,
              level: 'high',
            },
          },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.getByText('Decision stability')).toBeDefined()
    expect(screen.getByRole('progressbar', { name: 'Stability' })).toBeDefined()
  })

  // T10: Marginal badge when stability < 60%
  it('shows Marginal badge when stability < 60%', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            robustness: {
              recommendation_stability: 0.45,
              level: 'low',
            },
          },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.getByText('Marginal')).toBeDefined()
  })

  it('does not show Marginal badge when stability >= 60%', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            robustness: {
              recommendation_stability: 0.75,
              level: 'high',
            },
          },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.queryByText('Marginal')).toBeNull()
  })

  // T10: Threshold context
  it('shows threshold context when goal_threshold_raw is set', () => {
    renderGoal({
      goal_threshold_raw: '500k',
      goal_threshold_unit: '£',
    })
    // Displays "Target: 500k" (threshold with non-numeric raw as string)
    expect(screen.getByText(/Target:/)).toBeDefined()
    expect(screen.getByText(/500k/)).toBeDefined()
  })

  it('has displayName set', () => {
    expect(GoalNode.displayName).toBe('GoalNode')
  })

  // Null-safe paths — most likely regression sources in production
  it('renders "Untitled" when data.label is absent', () => {
    render(
      <ReactFlowProvider>
        <GoalNode {...baseProps} data={{ type: 'goal' }} />
      </ReactFlowProvider>
    )
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('does not show stability bar when report is null', () => {
    renderGoal()
    expect(screen.queryByText('Stability')).toBeNull()
  })

  it('does not show stability bar when report has no robustness key', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
      }) as any)
    )
    renderGoal()
    expect(screen.queryByText('Stability')).toBeNull()
  })

  it('does not show stability bar when robustness has no recommendation_stability', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: { robustness: { level: 'high' } },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.queryByText('Stability')).toBeNull()
  })

  it('does not show stability bar when results status is not complete', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'loading',
          report: { robustness: { recommendation_stability: 0.8, level: 'high' } },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.queryByText('Stability')).toBeNull()
  })

  it('does not show threshold context when goal_threshold_raw is absent', () => {
    renderGoal()
    // No threshold display, shows "Help me set a target" chip instead (v1.1 spec)
    expect(screen.queryByText(/Target:/)).toBeNull()
    expect(screen.getByText(/Help me set a target/)).toBeDefined()
  })

  it('shows threshold without unit when goal_threshold_unit is absent', () => {
    renderGoal({ goal_threshold_raw: '200k' })
    expect(screen.getByText(/Target:/)).toBeDefined()
    expect(screen.getByText(/200k/)).toBeDefined()
  })

  // Task 2: Non-currency units must suffix, not prefix
  it('formats non-currency unit as suffix: "≥ 200 customers"', () => {
    renderGoal({ goal_threshold_raw: 200, goal_threshold_unit: 'customers' })
    const el = screen.getByText(/Target:/)
    expect(el.textContent).toContain('200')
    expect(el.textContent).toContain('customers')
    // Ensure it's "200 customers" not "customers200"
    expect(el.textContent).toMatch(/200\s+customers/)
  })

  it('formats currency unit as prefix: "≥ £200"', () => {
    renderGoal({ goal_threshold_raw: 200, goal_threshold_unit: '£' })
    const el = screen.getByText(/Target:/)
    // "£200" prefix style (no space between symbol and number)
    expect(el.textContent).toContain('£')
    expect(el.textContent).toContain('200')
    // Must not be "200 £"
    expect(el.textContent).not.toMatch(/200\s+£/)
  })

  it('shows threshold when goal_threshold_raw is numeric 0 (falsy)', () => {
    renderGoal({ goal_threshold_raw: 0 })
    expect(screen.getByText(/Target:/)).toBeDefined()
  })

  // Assessment fix: float percent thresholds must be rounded to integer
  it('rounds float percent threshold to integer: 85.5% → 86%', () => {
    renderGoal({ goal_threshold_raw: 85.5, goal_threshold_unit: '%' })
    const el = screen.getByText(/Target:/)
    expect(el.textContent).toContain('86%')
    expect(el.textContent).not.toContain('85.5%')
  })

  // P1.4: null and empty string must NOT display threshold — show coaching prompt instead
  it('shows coaching prompt when goal_threshold_raw is null', () => {
    renderGoal({ goal_threshold_raw: null })
    expect(screen.queryByText(/Target:/)).toBeNull()
    expect(screen.getByText(/Help me set a target/)).toBeDefined()
  })

  it('shows coaching prompt when goal_threshold_raw is empty string', () => {
    renderGoal({ goal_threshold_raw: '' })
    expect(screen.queryByText(/Target:/)).toBeNull()
    expect(screen.getByText(/Help me set a target/)).toBeDefined()
  })

  it('shows coaching prompt when goal_threshold_raw is whitespace-only', () => {
    renderGoal({ goal_threshold_raw: '   ' })
    expect(screen.queryByText(/Target:/)).toBeNull()
    expect(screen.getByText(/Help me set a target/)).toBeDefined()
  })

  // P0.3: Provenance icons removed in v1.1 — verify target still renders with brief source
  it('renders target value when source is brief_extraction (provenance icon removed in v1.1)', () => {
    renderGoal({ observedState: { source: 'brief_extraction' }, goal_threshold_raw: 100, goal_threshold_unit: '%' })
    expect(screen.getByText(/Target:/)).toBeDefined()
  })

  it('does not show provenance icon for user source', () => {
    renderGoal({ observedState: { source: 'user' } })
    expect(screen.queryByTitle('From your brief')).toBeNull()
  })

  it('does not show provenance icon when observedState is absent', () => {
    renderGoal()
    expect(screen.queryByTitle('Generated from your brief')).toBeNull()
  })

  it('does not show achievement probability when it is null outside results mode', () => {
    renderGoal()
    expect(screen.queryByText(/% chance/)).toBeNull()
  })

  // V5: Stability bar uses goal yellow (not info blue)
  it('stability bar uses bg-goal for moderate level', () => {
    const { container } = render(
      <ReactFlowProvider>
        <GoalNode
          {...baseProps}
          data={{ label: 'Increase revenue', type: 'goal' }}
        />
      </ReactFlowProvider>
    )
    // Set up with moderate robustness (no high/low)
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            robustness: { recommendation_stability: 0.65, level: 'moderate' },
          },
        },
      }) as any)
    )
    const { container: c2 } = render(
      <ReactFlowProvider>
        <GoalNode
          {...baseProps}
          data={{ label: 'Increase revenue', type: 'goal' }}
        />
      </ReactFlowProvider>
    )
    // The filled bar div should have bg-goal class
    const filledBar = c2.querySelector('.bg-goal')
    expect(filledBar).not.toBeNull()
    // Must NOT use bg-info (old colour)
    expect(c2.querySelector('.bg-info')).toBeNull()
    void container // suppress unused var
  })

  // V4: Marginal badge uses text-text-body (not text-warning) for WCAG AA contrast
  it('Marginal badge uses text-text-body class', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            robustness: { recommendation_stability: 0.45, level: 'low' },
          },
        },
      }) as any)
    )
    const { container } = renderGoal()
    const badge = Array.from(container.querySelectorAll('span')).find(
      el => el.textContent === 'Marginal'
    )
    expect(badge).toBeDefined()
    expect(badge?.className).toContain('text-text-body')
    expect(badge?.className).not.toContain('text-warning')
  })

  // P1.3 (feedback): full goal threshold unit matrix — all specified unit permutations
  describe('goal threshold unit matrix', () => {
    it('$ currency — prefix format: "≥ $200"', () => {
      renderGoal({ goal_threshold_raw: 200, goal_threshold_unit: '$' })
      const el = screen.getByText(/Target:/)
      expect(el.textContent).toContain('$')
      expect(el.textContent).toContain('200')
      expect(el.textContent).not.toMatch(/200\s+\$/)
    })

    it('% — percent format: "≥ 85%"', () => {
      renderGoal({ goal_threshold_raw: 85, goal_threshold_unit: '%' })
      const el = screen.getByText(/Target:/)
      expect(el.textContent).toContain('85%')
    })

    it('months — suffix format: "≥ 6 months"', () => {
      renderGoal({ goal_threshold_raw: 6, goal_threshold_unit: 'months' })
      const el = screen.getByText(/Target:/)
      expect(el.textContent).toMatch(/6\s+months/)
      expect(el.textContent).not.toContain('months6')
    })

    it('engineers — suffix format: "≥ 10 engineers"', () => {
      renderGoal({ goal_threshold_raw: 10, goal_threshold_unit: 'engineers' })
      const el = screen.getByText(/Target:/)
      expect(el.textContent).toMatch(/10\s+engineers/)
    })

    it('unitless — plain number: "≥ 500"', () => {
      renderGoal({ goal_threshold_raw: 500 })
      const el = screen.getByText(/Target:/)
      expect(el.textContent).toContain('500')
      // No stray unit text
      expect(el.textContent).not.toMatch(/500\s+\w/)
    })

    it('count unit (explicit) — plain number format', () => {
      renderGoal({ goal_threshold_raw: 100, goal_threshold_unit: 'count' })
      const el = screen.getByText(/Target:/)
      expect(el.textContent).toContain('100')
      expect(el.textContent).not.toContain('count')
    })

    // B1: £20,000 with thousands separator
    it('B1: £ currency with 20000 — renders thousands separator', () => {
      renderGoal({ goal_threshold_raw: 20000, goal_threshold_unit: '£' })
      const el = screen.getByText(/Target:/)
      expect(el.textContent).toContain('£')
      expect(el.textContent).toContain('20,000')
    })

    // B2: "≥ 200 customers"
    it('B2: "≥ 200 customers" — number first then unit', () => {
      renderGoal({ goal_threshold_raw: 200, goal_threshold_unit: 'customers' })
      const el = screen.getByText(/Target:/)
      expect(el.textContent).toMatch(/200\s+customers/)
    })

    // B3: "≥ 95%" — no space before %
    it('B3: "≥ 95%" — percent format with no space', () => {
      renderGoal({ goal_threshold_raw: 95, goal_threshold_unit: '%' })
      const el = screen.getByText(/Target:/)
      expect(el.textContent).toContain('95%')
      expect(el.textContent).not.toContain('95 %')
    })

    // B4: no unit → "≥ 200"
    it('B4: no unit renders plain number', () => {
      renderGoal({ goal_threshold_raw: 200 })
      const el = screen.getByText(/Target:/)
      expect(el.textContent).toContain('200')
      // No unit suffix
      expect(el.textContent?.trim().endsWith('200')).toBe(true)
    })
  })

  // B7: threshold_raw=0 is a valid zero target, not a coaching prompt
  it('B7: threshold_raw=0 renders threshold display not coaching prompt', () => {
    renderGoal({ goal_threshold_raw: 0 })
    // Already covered above, but named explicitly for brief traceability
    expect(screen.getByText(/Target:/)).toBeDefined()
    expect(screen.queryByText(/Set a success target/)).toBeNull()
  })

  // B9: Constraint badges pre-analysis — info/neutral styling
  it('B9: constraint badges render pre-analysis with info styling', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        goalConstraints: [
          { id: 'c1', label: '4 months', operator: '≤', confidence: null },
        ],
      }) as any)
    )
    const { container } = renderGoal()
    // Badge should render
    expect(screen.getByText(/4 months/)).toBeDefined()
    // Pre-analysis: info styling (border-info/30 text-text-body)
    const badge = container.querySelector('.border-info\\/30')
    expect(badge).not.toBeNull()
  })

  // B10: Constraint badges post-analysis — colour-coded by probability
  it('B10: constraint badge ≥0.7 probability uses success colour', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            goal_constraints: [
              { id: 'c1', label: '4 months', operator: '≤', probability: 0.75 },
            ],
          },
        },
        goalConstraints: [],
      }) as any)
    )
    const { container } = renderGoal()
    expect(screen.getByText(/4 months/)).toBeDefined()
    const badge = container.querySelector('.border-success\\/40')
    expect(badge).not.toBeNull()
  })

  it('B10: constraint badge 0.4-0.69 probability uses warning colour', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            goal_constraints: [
              { id: 'c1', label: 'constraint', operator: '≤', probability: 0.55 },
            ],
          },
        },
        goalConstraints: [],
      }) as any)
    )
    const { container } = renderGoal()
    const badge = container.querySelector('.border-warning\\/40')
    expect(badge).not.toBeNull()
  })

  it('B10: constraint badge <0.4 probability uses danger colour', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            goal_constraints: [
              { id: 'c1', label: 'constraint', operator: '≤', probability: 0.25 },
            ],
          },
        },
        goalConstraints: [],
      }) as any)
    )
    const { container } = renderGoal()
    const badge = container.querySelector('.border-danger\\/40')
    expect(badge).not.toBeNull()
  })

  // B11: Multiple constraints — all render without overflow
  it('B11: multiple constraints all render', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        goalConstraints: [
          { id: 'c1', label: '4 months', operator: '≤' },
          { id: 'c2', label: '£20,000', operator: '≥' },
          { id: 'c3', label: '95%', operator: '≥' },
        ],
      }) as any)
    )
    renderGoal()
    expect(screen.getByText(/4 months/)).toBeDefined()
    expect(screen.getByText(/£20,000/)).toBeDefined()
    expect(screen.getByText(/95%/)).toBeDefined()
  })

  // J7: Constraint badge containers have descriptive aria-label
  it('J7: constraint badge container has aria-label describing operator and label', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        goalConstraints: [
          { id: 'c1', label: '4 months', operator: '≤', confidence: null },
        ],
      }) as any)
    )
    const { container } = renderGoal()
    const badge = container.querySelector('[aria-label*="4 months"]')
    expect(badge).not.toBeNull()
    expect(badge?.getAttribute('aria-label')).toContain('≤')
    expect(badge?.getAttribute('aria-label')).toContain('4 months')
  })

  it('J7: post-analysis constraint badge aria-label includes probability', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: {
            goal_constraints: [
              { id: 'c1', label: 'budget', operator: '≤', probability: 0.82 },
            ],
          },
        },
        goalConstraints: [],
      }) as any)
    )
    const { container } = renderGoal()
    const badge = container.querySelector('[aria-label*="budget"]')
    expect(badge).not.toBeNull()
    // Should include probability percentage
    expect(badge?.getAttribute('aria-label')).toContain('82%')
  })

  // B5/B6: null and empty string both show coaching prompt
  it('B5: threshold_raw=null → coaching prompt (already covered, regression guard)', () => {
    renderGoal({ goal_threshold_raw: null })
    expect(screen.getByText(/Help me set a target/)).toBeDefined()
  })

  it('B6: threshold_raw="" → coaching prompt', () => {
    renderGoal({ goal_threshold_raw: '' })
    expect(screen.getByText(/Help me set a target/)).toBeDefined()
  })
})

// ─── Audit §8 P1: goal-state copy matrix (threshold × probability) ──────────
describe('GoalNode — goal-state copy matrix (audit §8 P1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
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
    })
  })

  it('target unset + no probability (pre-analysis): keeps the set-a-target coaching', () => {
    renderGoal()
    expect(screen.getByText('Goal target missing')).toBeDefined()
    expect(screen.getByText('Help me set a target')).toBeDefined()
    expect(screen.queryByText(/Rerun the analysis/)).toBeNull()
  })

  it('target SET + no probability (post-analysis): says rerun, no set-a-target chip', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
      }) as any)
    )
    renderGoal({ goal_threshold_raw: '100', goal_threshold_unit: '%' })
    expect(screen.getByText('Target set. Rerun the analysis to update your results.')).toBeDefined()
    // The live bug: card said "Analysis complete. Set a target to see your
    // chances." while a target was set. Must never render here.
    expect(screen.queryByText(/Set a target to see your chances/)).toBeNull()
    expect(screen.queryByText('Help me set a target')).toBeNull()
  })

  it('target set + probability available: probability rendering wins, no rerun line', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.73,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
      }) as any)
    )
    renderGoal({ goal_threshold_raw: '100', goal_threshold_unit: '%' })
    expect(screen.getByText(/73.*% chance of reaching target/)).toBeDefined()
    expect(screen.queryByText(/Rerun the analysis/)).toBeNull()
    expect(screen.queryByText(/Set a target to see your chances/)).toBeNull()
  })

  it('target unset + probability available (auto-threshold): existing behaviour unchanged', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.4,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: { option_comparison: [{ option_id: 'o1', win_probability: 0.5 }] },
        },
      }) as any)
    )
    renderGoal()
    expect(screen.getByText('Analysis complete. Set a target to see your chances.')).toBeDefined()
    expect(screen.queryByText(/Rerun the analysis/)).toBeNull()
  })
})

// ─── Audit §8 P1: stale treatment on the stability bar ──────────────────────
describe('GoalNode — stale stability bar (audit §8 P1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.5,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
  })

  it('dims the stability bar and titles it when the graph changed since the run', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          graphHash: 'hash-at-run',
          report: { robustness: { recommendation_stability: 0.8 } },
        },
        _internal: { graphHash: 'hash-now-different' },
      }) as any)
    )
    const { container } = renderGoal({ goal_threshold_raw: '100', goal_threshold_unit: '%' })
    const staleEl = container.querySelector('[data-stale="true"]')
    expect(staleEl).not.toBeNull()
    expect(staleEl!.getAttribute('title')).toBe('Model changed since this analysis')
    expect(staleEl!.className).toContain('opacity-50')
    expect(staleEl!.textContent).toContain('Decision stability')
  })

  it('leaves the stability bar untouched when hashes match', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          graphHash: 'same-hash',
          report: { robustness: { recommendation_stability: 0.8 } },
        },
        _internal: { graphHash: 'same-hash' },
      }) as any)
    )
    const { container } = renderGoal({ goal_threshold_raw: '100', goal_threshold_unit: '%' })
    expect(container.querySelector('[data-stale="true"]')).toBeNull()
    expect(screen.getAllByText('Decision stability').length).toBeGreaterThan(0)
  })
})

/**
 * Brief 4 — DecisionPanel, OptionPanel, FactorControllablePanel,
 * and GoalPanel Impact empty-state tests.
 *
 * Covers: v6.2 PanelGroup layout adoption, formatWinProbability display,
 * no-raw-model-values in default mode, Impact group presence/absence,
 * ImportanceBar wiring, display_value passthrough.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { DecisionPanel } from '../panels/DecisionPanel'
import { OptionPanel } from '../panels/OptionPanel'
import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { GOAL_STRINGS, OPTION_STRINGS } from '../inspectorStrings'

// ─── Mock useNodeDisplayMetadata so we can drive ImportanceBar from tests ──

vi.mock('../../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn().mockReturnValue({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    valueOfInformation: null,
    inSensitivityAnalysis: false,
    winRate: null,
  }),
}))

import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
const mockDisplayMetadata = useNodeDisplayMetadata as ReturnType<typeof vi.fn>

const baseMetadata = {
  sensitivityRank: null,
  influence: null,
  confidence: null,
  valueOfInformation: null,
  inSensitivityAnalysis: false,
  winRate: null,
}

// ─── Store helpers ─────────────────────────────────────────────────

function setDecisionStore(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'dec1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Launch strategy', description: '' } },
      { id: 'optA', type: 'option', position: { x: 100, y: 0 }, data: { label: 'Option A', interventions: {} } },
      { id: 'optB', type: 'option', position: { x: 100, y: 50 }, data: { label: 'Option B (baseline)', interventions: {}, is_baseline: true } },
    ],
    edges: [
      { id: 'e1', source: 'dec1', target: 'optA', data: {} },
      { id: 'e2', source: 'dec1', target: 'optB', data: {} },
    ],
    results: { status: 'none', report: null },
    ...overrides,
  } as any)
}

function setOptionStore(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'optA', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A', description: '', interventions: { fac1: 0.7 } } },
      { id: 'fac1', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Team size', category: 'controllable', observedState: { value: 0.5, raw_value: 5, unit: 'people' } } },
    ],
    edges: [
      { id: 'e1', source: 'optA', target: 'fac1', data: {} },
    ],
    results: { status: 'none', report: null },
    ...overrides,
  } as any)
}

function setOptionStoreWithDisplayValue(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      {
        id: 'optA',
        type: 'option',
        position: { x: 0, y: 0 },
        data: {
          label: 'Option A',
          description: '',
          interventions: {
            fac1: { value: 0.6, display_value: 'Increase by 20%' },
          },
        },
      },
      { id: 'fac1', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Marketing spend', category: 'controllable', observedState: { value: 0.5, raw_value: 100, unit: '£' } } },
    ],
    edges: [
      { id: 'e1', source: 'optA', target: 'fac1', data: {} },
    ],
    results: { status: 'none', report: null },
    ...overrides,
  } as any)
}

function setFactorControllableStore(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      {
        id: 'fac1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          label: 'Team size',
          description: '',
          category: 'controllable',
          observedState: { raw_value: 5, value: 0.5, unit: 'people', source: 'brief_extraction' },
        },
      },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Throughput' } },
    ],
    edges: [
      { id: 'e1', source: 'fac1', target: 'out1', data: { weight: 0.6, direction: 'positive' } },
    ],
    results: { status: 'none', report: null },
    ...overrides,
  } as any)
}

function setGoalStore(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Profitability', description: '' } },
    ],
    edges: [],
    results: { status: 'none', report: null },
    goalThreshold: null,
    goalConstraints: null,
    ...overrides,
  } as any)
}

const decisionProps = { nodeId: 'dec1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
const optionProps = { nodeId: 'optA', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
const factorProps = { nodeId: 'fac1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
const goalProps = { nodeId: 'goal1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
  mockDisplayMetadata.mockReturnValue(baseMetadata)
})

// ─── Test 1: GoalPanel impact empty-state ──────────────────────────

describe('GoalPanel — Impact group empty-state (Brief 4 Task 1)', () => {
  it('renders impact PanelGroup with impactUnavailable text when isResultsMode=true and probGoal is absent', () => {
    setGoalStore({ results: { status: 'complete', report: {} } })
    const { container } = render(<GoalPanel {...goalProps} />)
    const impactGroup = container.querySelector('[data-panel-group="impact"]')
    expect(impactGroup).not.toBeNull()
    expect(impactGroup?.textContent).toContain(GOAL_STRINGS.impactUnavailable)
  })
})

// ─── Test 2: DecisionPanel win probability ─────────────────────────

describe('DecisionPanel — win probability display (Brief 4 Task 2)', () => {
  it('suppresses win probability pre-analysis and renders whole-percentage post-analysis', () => {
    // Phase 1 — pre-analysis: no percentage text
    setDecisionStore()
    const { container: preContainer, unmount } = render(<DecisionPanel {...decisionProps} />)
    const inputGroupPre = preContainer.querySelector('[data-panel-group="input"]')
    expect(inputGroupPre?.textContent ?? '').not.toMatch(/\d+%/)
    unmount()

    // Phase 2 — post-analysis with 0.754 win probability rounds to 75%
    setDecisionStore({
      results: {
        status: 'complete',
        report: {
          option_comparison: [
            { option_id: 'optA', win_probability: 0.754 },
            { option_id: 'optB', win_probability: 0.246 },
          ],
        },
      },
    })
    const { container: postContainer } = render(<DecisionPanel {...decisionProps} />)
    const inputGroupPost = postContainer.querySelector('[data-panel-group="input"]')
    expect(inputGroupPost?.textContent).toMatch(/75%/)
    expect(inputGroupPost?.textContent).not.toMatch(/75\.4%/)
  })
})

// ─── Test 3: DecisionPanel no SectionTitle ─────────────────────────

describe('DecisionPanel — no SectionTitle uppercase headers (Brief 4 Task 2)', () => {
  it('renders no SectionTitle-style uppercase headers in default or tech mode', () => {
    setDecisionStore()
    const { unmount } = render(<DecisionPanel {...decisionProps} />)
    expect(screen.queryByText('OPTIONS')).toBeNull()
    expect(screen.queryByText('DECISION FRAMING')).toBeNull()
    unmount()

    render(<DecisionPanel {...decisionProps} techMode={true} />)
    expect(screen.queryByText('OPTIONS')).toBeNull()
    expect(screen.queryByText('DECISION FRAMING')).toBeNull()
  })
})

// ─── Test 4: OptionPanel no System: model value: in default mode ────

describe('OptionPanel — no raw system text in default mode (Brief 4 Task 3)', () => {
  it('does not render "System: model value:" when techMode=false and interventions are present', () => {
    setOptionStore()
    const { container } = render(<OptionPanel {...optionProps} />)
    expect(container.textContent).not.toMatch(/System: model value:/)
  })
})

// ─── Test 5: OptionPanel InterventionRow displayValue passthrough ──

describe('OptionPanel — InterventionRow display_value passthrough (Brief 4 Task 3)', () => {
  it('renders the CEE-authored display_value verbatim when present on an intervention', () => {
    setOptionStoreWithDisplayValue()
    render(<OptionPanel {...optionProps} />)
    expect(screen.getByText('Increase by 20%')).toBeTruthy()
  })
})

// ─── Test 6: OptionPanel Impact group absent pre-analysis ──────────

describe('OptionPanel — Impact PanelGroup absent pre-analysis (Brief 4 Task 3)', () => {
  it('does not render the impact PanelGroup when no results are present', () => {
    setOptionStore({ results: { status: 'none', report: null } })
    const { container } = render(<OptionPanel {...optionProps} />)
    expect(container.querySelector('[data-panel-group="impact"]')).toBeNull()
  })
})

// ─── Test 7: FactorControllablePanel no raw normalised value default ─

describe('FactorControllablePanel — no raw normalised value in default mode (Brief 4 Task 4)', () => {
  it('does not render "System: model value:" when techMode=false even with rawValue + value present', () => {
    setFactorControllableStore()
    const { container } = render(<FactorControllablePanel {...factorProps} />)
    expect(container.textContent).not.toMatch(/System: model value:/)
  })
})

// ─── Regression: OptionPanel Impact group non-empty in results mode ─

describe('OptionPanel — Impact group has fallback when results are complete but impact data missing', () => {
  it('renders OPTION_STRINGS.impactUnavailable instead of an empty impact group', () => {
    // Results mode, no option_comparison in report, no winRate on metadata → all
    // content branches are false. Group must render fallback copy, not an
    // empty bordered section.
    setOptionStore({ results: { status: 'complete', report: {} } })
    mockDisplayMetadata.mockReturnValue({
      ...baseMetadata,
      winRate: null,
    })
    const { container } = render(<OptionPanel {...optionProps} />)
    const impactGroup = container.querySelector('[data-panel-group="impact"]')
    expect(impactGroup).not.toBeNull()
    expect(impactGroup?.textContent).toContain(OPTION_STRINGS.impactUnavailable)
  })
})

// ─── Regression: intervention display_value is canonical default-mode text ──

describe('OptionPanel — intervention with display_value does not expose raw numeric text in default mode', () => {
  it('shows display_value and hides the "Currently: X →" numeric editor when techMode=false', () => {
    setOptionStoreWithDisplayValue()
    const { container } = render(<OptionPanel {...optionProps} />)
    // display_value must be visible
    expect(screen.getByText('Increase by 20%')).toBeTruthy()
    // Raw "Currently:" label must NOT appear in default mode
    expect(container.textContent).not.toMatch(/Currently:/)
    // No editable number input surfaced
    const numericInputs = container.querySelectorAll('input[type="text"]')
    expect(numericInputs.length).toBe(0)
  })

  it('exposes the numeric editor in tech mode alongside display_value', () => {
    setOptionStoreWithDisplayValue()
    const techProps = { ...optionProps, techMode: true }
    const { container } = render(<OptionPanel {...techProps} />)
    expect(screen.getByText('Increase by 20%')).toBeTruthy()
    expect(container.textContent).toMatch(/Currently:/)
  })
})

// ─── Test 8: FactorControllablePanel ImportanceBar post-analysis ───

describe('FactorControllablePanel — ImportanceBar present post-analysis (Brief 4 Task 4)', () => {
  it('renders ImportanceBar in the context group when isResultsMode=true with influence/sensitivityRank', () => {
    setFactorControllableStore({ results: { status: 'complete', report: {} } })
    mockDisplayMetadata.mockReturnValue({
      ...baseMetadata,
      sensitivityRank: 1,
      influence: 0.8,
      inSensitivityAnalysis: true,
    })
    const { container } = render(<FactorControllablePanel {...factorProps} />)
    const contextGroup = container.querySelector('[data-panel-group="context"]')
    expect(contextGroup?.querySelector('[data-testid="importance-bar"]')).not.toBeNull()
  })
})

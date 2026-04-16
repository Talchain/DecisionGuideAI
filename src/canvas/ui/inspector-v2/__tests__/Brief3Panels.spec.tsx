/**
 * Brief 3 — GoalPanel, FactorExternalPanel, FactorObservablePanel v6.2 tests.
 *
 * Covers: EmptyDescriptionPrompt, ImportanceBar, quick-set state, click-to-edit,
 * PanelGroup structure, no SectionTitle uppercase headers, coaching placement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { GoalPanel } from '../panels/GoalPanel'
import { FactorExternalPanel } from '../panels/FactorExternalPanel'
import { FactorObservablePanel } from '../panels/FactorObservablePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

// ─── Mock useNodeDisplayMetadata for ImportanceBar tests ───────────
vi.mock('../../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn().mockReturnValue({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    valueOfInformation: null,
    inSensitivityAnalysis: false,
  }),
}))

import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'

const mockDisplayMetadata = useNodeDisplayMetadata as ReturnType<typeof vi.fn>

// ─── Store helpers ─────────────────────────────────────────────────

function setGoalStore(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Profitability', description: '' } },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ],
    edges: [
      { id: 'e1', source: 'out1', target: 'goal1', data: { weight: 0.7, direction: 'positive' } },
    ],
    results: { status: 'none', report: null },
    goalThreshold: null,
    goalConstraints: null,
    ...overrides,
  } as any)
}

function setExternalStore(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      {
        id: 'fac1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          label: 'Market conditions',
          description: '',
          category: 'external',
          prior: { range_min: 0.3, range_max: 0.7 },
        },
      },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ],
    edges: [
      { id: 'e1', source: 'fac1', target: 'out1', data: { weight: 0.5, direction: 'positive' } },
    ],
    results: { status: 'none', report: null },
    ...overrides,
  } as any)
}

function setObservableStore(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      {
        id: 'fac1',
        type: 'factor',
        position: { x: 0, y: 0 },
        data: {
          label: 'Customer NPS',
          description: '',
          category: 'observable',
          observedState: { raw_value: 42, value: 0.6, unit: '', source: 'brief_extraction' },
        },
      },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Retention' } },
    ],
    edges: [
      { id: 'e1', source: 'fac1', target: 'out1', data: { weight: 0.6, direction: 'positive' } },
    ],
    results: { status: 'none', report: null },
    ...overrides,
  } as any)
}

const goalProps = { nodeId: 'goal1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
const externalProps = { nodeId: 'fac1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }
const observableProps = { nodeId: 'fac1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
  mockDisplayMetadata.mockReturnValue({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    valueOfInformation: null,
    inSensitivityAnalysis: false,
  })
})

// ─── GoalPanel ─────────────────────────────────────────────────────

describe('GoalPanel v6.2', () => {
  it('renders EmptyDescriptionPrompt when description is empty', () => {
    setGoalStore()
    render(<GoalPanel {...goalProps} />)
    expect(screen.getByText('Describe what achieving this goal looks like for your team.')).toBeTruthy()
  })

  it('renders description text when description is present', () => {
    setGoalStore()
    const store = useCanvasStore.getState()
    const node = store.nodes.find(n => n.id === 'goal1')!
    ;(node.data as any).description = 'Reach EBITDA positive by Q4'
    useCanvasStore.setState({ nodes: [...store.nodes] })
    render(<GoalPanel {...goalProps} />)
    expect(screen.getByText('Reach EBITDA positive by Q4')).toBeTruthy()
  })

  it('renders ImportanceBar when post-analysis and influence data is present', () => {
    setGoalStore({ results: { status: 'complete', report: {} } })
    mockDisplayMetadata.mockReturnValue({
      sensitivityRank: 1,
      influence: 0.8,
      confidence: null,
      valueOfInformation: null,
      inSensitivityAnalysis: true,
    })
    const { container } = render(<GoalPanel {...goalProps} />)
    expect(container.querySelector('[data-testid="importance-bar"]')).not.toBeNull()
  })

  it('renders GoalProgressChecklist (not ImportanceBar) pre-analysis', () => {
    setGoalStore()
    const { container } = render(<GoalPanel {...goalProps} />)
    // ImportanceBar absent when influence is null (pre-analysis)
    expect(container.querySelector('[data-testid="importance-bar"]')).toBeNull()
  })

  it('has no SectionTitle uppercase headers', () => {
    setGoalStore()
    const { container } = render(<GoalPanel {...goalProps} />)
    // SectionTitle renders text in uppercase via CSS class 'uppercase' or tracking-wider
    // Verify the three forbidden uppercase labels are not present as text nodes
    expect(screen.queryByText('IMPACT')).toBeNull()
    expect(screen.queryByText('WHAT DRIVES THIS')).toBeNull()
    expect(screen.queryByText('YOUR INPUT')).toBeNull()
  })

  it('renders constraints inside Your input PanelGroup', () => {
    setGoalStore({
      goalConstraints: [{ id: 'c1', label: 'Revenue', operator: '>=', value: 100 }],
    })
    const { container } = render(<GoalPanel {...goalProps} />)
    const inputGroup = container.querySelector('[data-panel-group="input"]')
    expect(inputGroup).not.toBeNull()
    expect(inputGroup?.textContent).toContain('Revenue')
  })

  it('shows add-constraint button in pre-analysis mode', () => {
    setGoalStore({ results: { status: 'idle', report: null } })
    render(<GoalPanel {...goalProps} />)
    expect(screen.getByTestId('add-constraint-button')).toBeTruthy()
  })

  it('hides add-constraint button in results mode', () => {
    setGoalStore({ results: { status: 'complete', report: {} } })
    render(<GoalPanel {...goalProps} />)
    expect(screen.queryByTestId('add-constraint-button')).toBeNull()
  })

  it('renders inbound connections in the What drives this group', () => {
    setGoalStore()
    const { container } = render(<GoalPanel {...goalProps} />)
    const connectionsGroup = container.querySelector('[data-panel-group="connections"]')
    expect(connectionsGroup).not.toBeNull()
    expect(connectionsGroup?.textContent).toContain('Revenue')
  })
})

// ─── FactorExternalPanel ───────────────────────────────────────────

describe('FactorExternalPanel v6.2', () => {
  it('renders EmptyDescriptionPrompt when description is empty', () => {
    setExternalStore()
    render(<FactorExternalPanel {...externalProps} />)
    expect(screen.getByText('What is this factor and why does it matter?')).toBeTruthy()
  })

  it('renders both category pill and extraction label in context group', () => {
    setExternalStore()
    // No observedState source → getExtractionLabel(undefined) → 'Estimated by Olumi'
    const { container } = render(<FactorExternalPanel {...externalProps} />)
    const contextGroup = container.querySelector('[data-panel-group="context"]')
    expect(contextGroup?.textContent).toContain('Outside your control')
    expect(contextGroup?.textContent).toContain('Estimated by Olumi')
  })

  it('renders ImportanceBar in context group when post-analysis influence data present', () => {
    setExternalStore({ results: { status: 'complete', report: {} } })
    mockDisplayMetadata.mockReturnValue({
      sensitivityRank: 2,
      influence: 0.65,
      confidence: null,
      valueOfInformation: 0.5,
      inSensitivityAnalysis: true,
    })
    const { container } = render(<FactorExternalPanel {...externalProps} />)
    const contextGroup = container.querySelector('[data-panel-group="context"]')
    expect(contextGroup?.querySelector('[data-testid="importance-bar"]')).not.toBeNull()
  })

  it('quick-set buttons render in Your input group', () => {
    setExternalStore()
    const { container } = render(<FactorExternalPanel {...externalProps} />)
    const inputGroup = container.querySelector('[data-panel-group="input"]')
    expect(inputGroup?.textContent).toContain('Low')
    expect(inputGroup?.textContent).toContain('Moderate')
    expect(inputGroup?.textContent).toContain('High')
    expect(inputGroup?.textContent).toContain('Uncertain')
  })

  it('active quick-set state derived from current range value — moderate selected for 0.3–0.7', () => {
    setExternalStore()
    render(<FactorExternalPanel {...externalProps} />)
    // range_min=0.3 range_max=0.7 → Moderate should be active
    const moderateBtn = screen.getByText('Moderate')
    expect(moderateBtn.className).toContain('text-primary')
  })

  it('does not render "Set by options" section — externals are not intervened', () => {
    setExternalStore()
    render(<FactorExternalPanel {...externalProps} />)
    expect(screen.queryByText('Set by options')).toBeNull()
  })

  it('coaching renders within Your input group', () => {
    setExternalStore()
    const { container } = render(<FactorExternalPanel {...externalProps} />)
    const inputGroup = container.querySelector('[data-panel-group="input"]')
    // InspectorCoaching renders a div or coaching card inside the input group
    expect(inputGroup).not.toBeNull()
    // Input group should have content (coaching + primary card)
    expect(inputGroup!.children.length).toBeGreaterThan(0)
  })

  it('has no SectionTitle uppercase headers', () => {
    setExternalStore()
    render(<FactorExternalPanel {...externalProps} />)
    expect(screen.queryByText('IMPACT')).toBeNull()
    expect(screen.queryByText('VALUE OF INVESTIGATION')).toBeNull()
    expect(screen.queryByText('YOUR ESTIMATE')).toBeNull()
    expect(screen.queryByText('CONNECTIONS')).toBeNull()
  })

  it('renders connection rows in Influences group', () => {
    setExternalStore()
    const { container } = render(<FactorExternalPanel {...externalProps} />)
    const connectionsGroup = container.querySelector('[data-panel-group="connections"]')
    expect(connectionsGroup).not.toBeNull()
    expect(connectionsGroup?.textContent).toContain('Revenue')
  })
})

// ─── FactorObservablePanel ─────────────────────────────────────────

describe('FactorObservablePanel v6.2', () => {
  it('renders EmptyDescriptionPrompt when description is empty', () => {
    setObservableStore()
    render(<FactorObservablePanel {...observableProps} />)
    expect(screen.getByText('What is this factor and why does it matter?')).toBeTruthy()
  })

  it('renders extraction label pill when source is present', () => {
    setObservableStore()
    // source = 'brief_extraction' → getExtractionLabel → 'From your brief'
    render(<FactorObservablePanel {...observableProps} />)
    expect(screen.getByText('From your brief')).toBeTruthy()
  })

  it('renders value as clickable display (not always-visible input)', () => {
    setObservableStore()
    const { container } = render(<FactorObservablePanel {...observableProps} />)
    const valueDisplay = container.querySelector('[data-testid="observable-value-display"]')
    expect(valueDisplay).not.toBeNull()
    // Input should not be visible by default
    expect(container.querySelector('[data-testid="observable-value-input"]')).toBeNull()
  })

  it('click-to-edit: clicking value display shows number input', () => {
    setObservableStore()
    const { container } = render(<FactorObservablePanel {...observableProps} />)
    const valueDisplay = container.querySelector('[data-testid="observable-value-display"]')!
    fireEvent.click(valueDisplay)
    expect(container.querySelector('[data-testid="observable-value-input"]')).not.toBeNull()
    // Display button should now be gone
    expect(container.querySelector('[data-testid="observable-value-display"]')).toBeNull()
  })

  it('does not render quick-set buttons', () => {
    setObservableStore()
    render(<FactorObservablePanel {...observableProps} />)
    expect(screen.queryByText('Low')).toBeNull()
    expect(screen.queryByText('Moderate')).toBeNull()
    expect(screen.queryByText('High')).toBeNull()
    expect(screen.queryByText('Uncertain')).toBeNull()
  })

  it('renders ImportanceBar in context group when post-analysis influence data present', () => {
    setObservableStore({ results: { status: 'complete', report: {} } })
    mockDisplayMetadata.mockReturnValue({
      sensitivityRank: 1,
      influence: 0.9,
      confidence: null,
      valueOfInformation: 0.8,
      inSensitivityAnalysis: true,
    })
    const { container } = render(<FactorObservablePanel {...observableProps} />)
    const contextGroup = container.querySelector('[data-panel-group="context"]')
    expect(contextGroup?.querySelector('[data-testid="importance-bar"]')).not.toBeNull()
  })

  it('renders connection rows in Influences group with full labels', () => {
    setObservableStore()
    const { container } = render(<FactorObservablePanel {...observableProps} />)
    const connectionsGroup = container.querySelector('[data-panel-group="connections"]')
    expect(connectionsGroup).not.toBeNull()
    expect(connectionsGroup?.textContent).toContain('Retention')
  })

  it('has no SectionTitle uppercase headers', () => {
    setObservableStore()
    render(<FactorObservablePanel {...observableProps} />)
    expect(screen.queryByText('IMPACT')).toBeNull()
    expect(screen.queryByText('VALUE OF INVESTIGATION')).toBeNull()
    expect(screen.queryByText('VALUE')).toBeNull()
    expect(screen.queryByText('CONNECTIONS')).toBeNull()
  })
})

// ─── Provenance pill semantics ─────────────────────────────────────

describe('Provenance pill semantics', () => {
  it('FactorExternalPanel context group shows "Outside your control" pill', () => {
    setExternalStore()
    const { container } = render(<FactorExternalPanel {...externalProps} />)
    const contextGroup = container.querySelector('[data-panel-group="context"]')
    expect(contextGroup?.textContent).toContain('Outside your control')
  })

  it('FactorObservablePanel context group shows "You measure this" pill', () => {
    setObservableStore()
    const { container } = render(<FactorObservablePanel {...observableProps} />)
    const contextGroup = container.querySelector('[data-panel-group="context"]')
    expect(contextGroup?.textContent).toContain('You measure this')
  })

  it('FactorExternalPanel context group also shows extraction label alongside category pill', () => {
    setExternalStore()
    const { container } = render(<FactorExternalPanel {...externalProps} />)
    const contextGroup = container.querySelector('[data-panel-group="context"]')
    // Both category pill and extraction label should be present
    expect(contextGroup?.textContent).toContain('Outside your control')
    expect(contextGroup?.textContent).toContain('Estimated by Olumi')
  })

  it('FactorObservablePanel context group shows extraction label when source present', () => {
    setObservableStore()
    // source = 'brief_extraction' -> 'From your brief'
    const { container } = render(<FactorObservablePanel {...observableProps} />)
    const contextGroup = container.querySelector('[data-panel-group="context"]')
    expect(contextGroup?.textContent).toContain('You measure this')
    expect(contextGroup?.textContent).toContain('From your brief')
  })
})

// ─── Em-dash enforcement ───────────────────────────────────────────

describe('Em-dash enforcement — no em-dash in rendered panel output', () => {
  const EM_DASH = '\u2014'

  it('GoalPanel renders no em-dash characters', () => {
    setGoalStore()
    const { container } = render(<GoalPanel {...goalProps} />)
    expect(container.textContent).not.toContain(EM_DASH)
  })

  it('FactorExternalPanel renders no em-dash characters', () => {
    setExternalStore()
    const { container } = render(<FactorExternalPanel {...externalProps} />)
    expect(container.textContent).not.toContain(EM_DASH)
  })

  it('FactorObservablePanel renders no em-dash characters (including empty value copy)', () => {
    // Use a node with no value to trigger the "No value set" copy
    setObservableStore()
    const store = useCanvasStore.getState()
    const node = store.nodes.find(n => n.id === 'fac1')!
    ;(node.data as any).observedState = { raw_value: null, value: null, unit: '', source: null }
    useCanvasStore.setState({ nodes: [...store.nodes] })
    const { container } = render(<FactorObservablePanel {...observableProps} />)
    expect(container.textContent).not.toContain(EM_DASH)
  })
})

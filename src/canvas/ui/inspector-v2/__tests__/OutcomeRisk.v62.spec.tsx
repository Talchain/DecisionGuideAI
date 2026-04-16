/**
 * OutcomePanel + RiskPanel v6.2 — redesign-specific tests.
 *
 * Covers: drivers visible by default, EmptyDescriptionPrompt, goal contribution bar,
 * DriversList rendering without truncation or category badges.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OutcomePanel } from '../panels/OutcomePanel'
import { RiskPanel } from '../panels/RiskPanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

function setOutcomeStore(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'out1', type: 'outcome', position: { x: 0, y: 0 }, data: { label: 'Revenue', description: '' } },
      { id: 'fac1', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Marketing budget' } },
      { id: 'fac2', type: 'factor', position: { x: 200, y: 0 }, data: { label: 'Customer acquisition cost' } },
      { id: 'goal1', type: 'goal', position: { x: 300, y: 0 }, data: { label: 'Profitability' } },
    ],
    edges: [
      { id: 'e1', source: 'fac1', target: 'out1', data: { weight: 0.65, direction: 'positive' } },
      { id: 'e2', source: 'fac2', target: 'out1', data: { weight: 0.3, direction: 'negative' } },
      { id: 'e3', source: 'out1', target: 'goal1', data: { weight: 0.8 } },
    ],
    results: { status: 'none', report: null },
    ...overrides,
  } as any)
}

function setRiskStore(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'risk1', type: 'risk', position: { x: 0, y: 0 }, data: { label: 'Churn risk', description: 'Customer attrition' } },
      { id: 'fac1', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Price sensitivity' } },
    ],
    edges: [
      { id: 'e1', source: 'fac1', target: 'risk1', data: { weight: 0.4, direction: 'positive' } },
    ],
    results: { status: 'none', report: null },
    ...overrides,
  } as any)
}

const outcomeProps = {
  nodeId: 'out1',
  techMode: false,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
}

const riskProps = {
  nodeId: 'risk1',
  techMode: false,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('OutcomePanel v6.2', () => {
  it('shows EmptyDescriptionPrompt when description is empty', () => {
    setOutcomeStore()
    render(<OutcomePanel {...outcomeProps} />)
    expect(screen.getByText('What does this outcome represent in your decision?')).toBeTruthy()
  })

  it('shows description text when present', () => {
    setOutcomeStore()
    // Set description on the node
    const store = useCanvasStore.getState()
    const node = store.nodes.find(n => n.id === 'out1')!
    ;(node.data as any).description = 'Total annual revenue'
    useCanvasStore.setState({ nodes: [...store.nodes] })

    render(<OutcomePanel {...outcomeProps} />)
    expect(screen.getByText('Total annual revenue')).toBeTruthy()
  })

  it('shows drivers list visible by default (not collapsed)', () => {
    setOutcomeStore()
    const { container } = render(<OutcomePanel {...outcomeProps} />)
    const driversList = container.querySelector('[data-testid="drivers-list"]')
    expect(driversList).not.toBeNull()
    // Both factor labels should be readable
    expect(screen.getByText('Marketing budget')).toBeTruthy()
    expect(screen.getByText('Customer acquisition cost')).toBeTruthy()
  })

  it('shows goal contribution bar', () => {
    setOutcomeStore()
    render(<OutcomePanel {...outcomeProps} />)
    expect(screen.getByText('Contributes to your goal')).toBeTruthy()
    expect(screen.getByText('80%')).toBeTruthy()
  })

  it('shows "Based on model structure" text pre-analysis', () => {
    setOutcomeStore()
    render(<OutcomePanel {...outcomeProps} />)
    expect(screen.getByText('Based on model structure')).toBeTruthy()
  })
})

describe('DriversList v6.2 — no truncation, no badges', () => {
  it('renders driver labels without truncate class', () => {
    setOutcomeStore()
    const { container } = render(<OutcomePanel {...outcomeProps} />)
    const driverLabels = container.querySelectorAll('[data-testid="drivers-list"] span')
    // Label spans should have break-words, not truncate
    const labelSpans = Array.from(driverLabels).filter(el => el.textContent === 'Marketing budget' || el.textContent === 'Customer acquisition cost')
    for (const span of labelSpans) {
      expect(span.className).toContain('break-words')
      expect(span.className).not.toContain('truncate')
    }
  })

  it('does not render category badges on driver rows', () => {
    setOutcomeStore()
    const { container } = render(<OutcomePanel {...outcomeProps} />)
    const driversList = container.querySelector('[data-testid="drivers-list"]')
    // No badge text like "You can change this", "Outside your control", etc.
    expect(driversList?.textContent).not.toContain('You can change this')
    expect(driversList?.textContent).not.toContain('Outside your control')
    expect(driversList?.textContent).not.toContain('You measure this')
  })
})

describe('RiskPanel v6.2', () => {
  it('shows description when present', () => {
    setRiskStore()
    render(<RiskPanel {...riskProps} />)
    expect(screen.getByText('Customer attrition')).toBeTruthy()
  })

  it('shows EmptyDescriptionPrompt when description is empty', () => {
    setRiskStore()
    const store = useCanvasStore.getState()
    const node = store.nodes.find(n => n.id === 'risk1')!
    ;(node.data as any).description = ''
    useCanvasStore.setState({ nodes: [...store.nodes] })

    render(<RiskPanel {...riskProps} />)
    expect(screen.getByText('What could go wrong and how would it affect the decision?')).toBeTruthy()
  })

  it('shows drivers list visible by default', () => {
    setRiskStore()
    const { container } = render(<RiskPanel {...riskProps} />)
    const driversList = container.querySelector('[data-testid="drivers-list"]')
    expect(driversList).not.toBeNull()
    expect(screen.getByText('Price sensitivity')).toBeTruthy()
  })

  it('shows risk exposure section title', () => {
    setRiskStore()
    render(<RiskPanel {...riskProps} />)
    expect(screen.getByText('Risk exposure by option')).toBeTruthy()
  })

  it('shows run analysis prompt pre-analysis', () => {
    setRiskStore()
    render(<RiskPanel {...riskProps} />)
    expect(screen.getByText('Run analysis to see how this risk affects the goal.')).toBeTruthy()
  })
})

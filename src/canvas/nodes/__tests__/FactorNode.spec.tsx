/**
 * FactorNode render tests
 * T2: cleanFactorLabel applied to displayed label
 * T3: category label in header row
 * T4: human-readable value display
 * T5: "estimated" pill for inferred values
 * T6: Sensitivity/Evidence tier labels (results mode)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      goalThreshold: null,
      goalConstraints: [],
    })
  ),
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

const renderFactor = (data: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} data={data} />
    </ReactFlowProvider>
  )

describe('FactorNode', () => {
  beforeEach(() => vi.clearAllMocks())

  // T1: No all-caps text
  it('renders label without all-caps', () => {
    renderFactor({ label: 'Hiring rate', type: 'factor' })
    const label = screen.getByText('Hiring rate')
    // CSS uppercase is not checked here — this is a render test
    expect(label).toBeDefined()
    // The type label from registry should be sentence-case (not all-caps)
    expect(screen.getByText('Factor')).toBeDefined()
  })

  // T2: Strip normalisation metadata
  it('strips "(0–1 scale)" from label', () => {
    renderFactor({ label: 'Hiring rate (0–1 scale)', type: 'factor' })
    expect(screen.getByText('Hiring rate')).toBeDefined()
    expect(screen.queryByText(/0–1 scale/)).toBeNull()
  })

  it('strips "(0/1)" from label', () => {
    renderFactor({ label: 'Hired (0/1)', type: 'factor' })
    expect(screen.getByText('Hired')).toBeDefined()
  })

  // F2: Category icon (tooltip via title attribute)
  it('renders controllable icon with correct tooltip', () => {
    const { container } = renderFactor({ label: 'Budget', type: 'factor', category: 'controllable' })
    const icon = container.querySelector('[title="You control this factor"]')
    expect(icon).not.toBeNull()
  })

  it('renders observable icon with correct tooltip', () => {
    const { container } = renderFactor({ label: 'Revenue', type: 'factor', category: 'observable' })
    const icon = container.querySelector('[title="You can measure this"]')
    expect(icon).not.toBeNull()
  })

  it('renders external icon with correct tooltip', () => {
    const { container } = renderFactor({ label: 'Market rate', type: 'factor', category: 'external' })
    const icon = container.querySelector('[title="Outside your control"]')
    expect(icon).not.toBeNull()
  })

  it('omits category icon when category is absent', () => {
    const { container } = renderFactor({ label: 'Unknown', type: 'factor' })
    expect(container.querySelector('[title="You control this factor"]')).toBeNull()
    expect(container.querySelector('[title="You can measure this"]')).toBeNull()
    expect(container.querySelector('[title="Outside your control"]')).toBeNull()
  })

  // T4: Human-readable value
  it('shows raw_value with unit', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { raw_value: '120', unit: 'k', value: 0.6 },
    })
    expect(screen.getByText('120 k')).toBeDefined()
  })

  it('shows raw_value alone when no unit', () => {
    renderFactor({
      label: 'Score',
      type: 'factor',
      observedState: { raw_value: '85', value: 0.85 },
    })
    expect(screen.getByText('85')).toBeDefined()
  })

  it('falls back to None for binary 0 without raw_value', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 0 },
    })
    expect(screen.getByText('None')).toBeDefined()
  })

  it('falls back to Full for binary 1 without raw_value', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 1 },
    })
    expect(screen.getByText('Full')).toBeDefined()
  })

  // T4: External factor with no observedState shows "No baseline"
  it('shows "No baseline" for external factor with no observedState', () => {
    renderFactor({ label: 'Market', type: 'factor', category: 'external' })
    expect(screen.getByText('No baseline')).toBeDefined()
  })

  it('shows "No baseline" for factor with observedState but no value', () => {
    renderFactor({
      label: 'Metric',
      type: 'factor',
      observedState: { unit: 'k' },
    })
    expect(screen.getByText('No baseline')).toBeDefined()
  })

  // T5: "estimated" pill
  it('shows "estimated" pill for inferred extraction type', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'inferred' },
    })
    expect(screen.getByText('estimated')).toBeDefined()
  })

  it('does not show "estimated" pill for explicit extraction type', () => {
    renderFactor({
      label: 'Salary',
      type: 'factor',
      observedState: { value: 0.5, extractionType: 'explicit' },
    })
    expect(screen.queryByText('estimated')).toBeNull()
  })

  // T6: Sensitivity/Evidence tiers (results mode)
  it('shows Sensitivity and Evidence tiers in results mode', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: 0.8,
      confidence: 0.45,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    })
    renderFactor({ label: 'Salary', type: 'factor' })
    expect(screen.getByText('Sensitivity')).toBeDefined()
    expect(screen.getByText('High')).toBeDefined()
    expect(screen.getByText('Evidence')).toBeDefined()
    expect(screen.getByText('Fair')).toBeDefined()
  })

  it('hides Sensitivity/Evidence bars outside results mode', () => {
    renderFactor({ label: 'Salary', type: 'factor' })
    expect(screen.queryByText('Sensitivity')).toBeNull()
    expect(screen.queryByText('Evidence')).toBeNull()
  })

  it('has displayName set', () => {
    expect(FactorNode.displayName).toBe('FactorNode')
  })

  // Null-safe paths — most likely regression sources in production
  it('renders "Untitled" when data.label is absent', () => {
    renderFactor({})
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('renders "Untitled" when data.label is empty string', () => {
    renderFactor({ label: '' })
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('does not crash when observedState is null', () => {
    expect(() => renderFactor({ label: 'X', type: 'factor', observedState: null })).not.toThrow()
  })

  it('does not crash when observedState is undefined', () => {
    expect(() => renderFactor({ label: 'X', type: 'factor' })).not.toThrow()
  })

  it('shows "No baseline" when observedState has only unit (no value)', () => {
    renderFactor({ label: 'X', type: 'factor', observedState: { unit: 'k' } })
    expect(screen.getByText('No baseline')).toBeDefined()
  })

  it('does not show Sensitivity/Evidence bars in results mode when both influence and confidence are null', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    })
    renderFactor({ label: 'X', type: 'factor' })
    expect(screen.queryByText('Sensitivity')).toBeNull()
    expect(screen.queryByText('Evidence')).toBeNull()
  })

  it('does not show Sensitivity bar when influence is exactly 0', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: 0,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    })
    renderFactor({ label: 'X', type: 'factor' })
    expect(screen.queryByText('Sensitivity')).toBeNull()
  })

  it('omits category label when category is an unrecognised string', () => {
    renderFactor({ label: 'X', type: 'factor', category: 'unknown_category' })
    expect(screen.queryByText('Controllable')).toBeNull()
    expect(screen.queryByText('Measurable')).toBeNull()
  })
})

/**
 * OptionNode render tests
 * T7: Win probability bar + Recommended badge
 * T8: Intervention chips with cleaned labels and formatted values
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
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
  id: 'option-1',
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderOption = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} data={{ label: 'Hire 3 engineers', type: 'option', ...data }} />
    </ReactFlowProvider>
  )

describe('OptionNode', () => {
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
    })
  })

  it('renders label', () => {
    renderOption()
    expect(screen.getByText('Hire 3 engineers')).toBeDefined()
  })

  it('shows type label as "Option" (sentence-case)', () => {
    renderOption()
    expect(screen.getByText('Option')).toBeDefined()
  })

  // T7: Win probability
  it('does not show win probability outside results mode', () => {
    renderOption()
    expect(screen.queryByText(/win probability/)).toBeNull()
  })

  it('shows win probability in results mode', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
    })
    renderOption()
    expect(screen.getByText('72%')).toBeDefined()
    expect(screen.getByText('win probability')).toBeDefined()
  })

  // T7: Recommended badge
  it('shows Recommended badge for highest winRate option', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.72,
      isResultsMode: true,
    })
    // Set up store with report that has option win rates
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: { options: { 'option-1': 0.72, 'option-2': 0.28 } },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.getByText('Recommended')).toBeDefined()
  })

  it('does not show Recommended badge for non-highest option', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.28,
      isResultsMode: true,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: { options: { 'option-1': 0.28, 'option-2': 0.72 } },
        },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.queryByText('Recommended')).toBeNull()
  })

  // T8: Intervention chips
  it('shows intervention chips from ceeAnalysisReady', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': 0.6 },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Hiring rate (0–1 scale)', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    renderOption()
    // cleanFactorLabel strips "(0–1 scale)"
    expect(screen.getByText('Hiring rate:')).toBeDefined()
    // formatInterventionValue(0.6, 'fraction') → '60%'
    expect(screen.getByText('60%')).toBeDefined()
  })

  it('has displayName set', () => {
    expect(OptionNode.displayName).toBe('OptionNode')
  })

  // Null-safe paths — most likely regression sources in production
  it('renders "Untitled" when data.label is absent', () => {
    render(
      <ReactFlowProvider>
        <OptionNode {...baseProps} data={{ type: 'option' }} />
      </ReactFlowProvider>
    )
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('does not show intervention chips when ceeAnalysisReady is null', () => {
    renderOption()
    expect(screen.queryByText(/:/)).toBeNull()
  })

  it('does not show intervention chips when options array is empty', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ ceeAnalysisReady: { options: [] } }) as any)
    )
    renderOption()
    expect(screen.queryByText(/:/)).toBeNull()
  })

  it('does not show intervention chips when matching option has no interventions', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: { options: [{ id: 'option-1' }] },
      }) as any)
    )
    renderOption()
    expect(screen.queryByText(/:/)).toBeNull()
  })

  it('formats intervention value correctly when value is nested object {value: N}', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        ceeAnalysisReady: {
          options: [{
            id: 'option-1',
            interventions: { 'factor-1': { value: 0.5 } },
          }],
        },
        nodes: [{
          id: 'factor-1',
          data: { label: 'Budget', observedState: { unit: 'fraction' } },
        }],
      }) as any)
    )
    renderOption()
    // formatInterventionValue(0.5, 'fraction') → '50%'
    expect(screen.getByText('50%')).toBeDefined()
  })

  it('does not show win probability when winRate is null in results mode', () => {
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
    renderOption()
    expect(screen.queryByText(/win probability/)).toBeNull()
  })

  it('does not show Recommended badge when resultsReport has no options key', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.8,
      isResultsMode: true,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: {} },
        nodes: [
          { id: 'option-1', type: 'option', data: { type: 'option' } },
          { id: 'option-2', type: 'option', data: { type: 'option' } },
        ],
      }) as any)
    )
    renderOption()
    expect(screen.queryByText('Recommended')).toBeNull()
  })

  it('does not show Recommended badge when only one option node exists', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 1.0,
      isResultsMode: true,
    })
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: {
          status: 'complete',
          report: { options: { 'option-1': 1.0 } },
        },
        nodes: [{ id: 'option-1', type: 'option', data: { type: 'option' } }],
      }) as any)
    )
    renderOption()
    // isRecommended requires length >= 2
    expect(screen.queryByText('Recommended')).toBeNull()
  })
})

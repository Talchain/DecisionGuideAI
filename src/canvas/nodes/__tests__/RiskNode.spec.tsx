/**
 * RiskNode render tests
 * T9: Bridge edge data — impact on goal + certainty
 * Severity badge rendering
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode } from '../RiskNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  goalThreshold: null,
  goalConstraints: [],
  edges: [],
  nodes: [],
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

const baseProps = {
  id: 'risk-1',
  type: 'risk',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderRisk = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as any)} data={{ label: 'Key person dependency', type: 'risk', ...data }} />
    </ReactFlowProvider>
  )

describe('RiskNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
  })

  it('renders label', () => {
    renderRisk()
    expect(screen.getByText('Key person dependency')).toBeDefined()
  })

  it('shows type label as "Risk" (sentence-case)', () => {
    renderRisk()
    expect(screen.getByText('Risk')).toBeDefined()
  })

  it('has displayName set', () => {
    expect(RiskNode.displayName).toBe('RiskNode')
  })

  // Severity badge
  it('shows High Risk badge when probability is high and impact is high', () => {
    renderRisk({ probability: 0.9, impact: 'high' })
    expect(screen.getByText('High Risk')).toBeDefined()
  })

  it('shows Low Risk badge when probability is low and impact is low', () => {
    renderRisk({ probability: 0.1, impact: 'low' })
    expect(screen.getByText('Low Risk')).toBeDefined()
  })

  it('does not show severity badge when probability and impact are absent', () => {
    renderRisk()
    // Severity badge shows "High Risk", "Medium Risk", etc. — not the plain "Risk" type label
    expect(screen.queryByText(/^(High|Medium|Low) Risk$/)).toBeNull()
  })

  // T9: Bridge edge data
  it('does not show bridge edge data when results status is not complete', () => {
    renderRisk()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('shows bridge edge impact on goal in results mode', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'risk-1',
            target: 'goal-1',
            data: { weight: 0.6, direction: 'negative', beliefExists: null },
          },
        ],
      }) as any)
    )
    renderRisk()
    expect(screen.getByText('Strong negative influence on goal')).toBeDefined()
  })

  it('shows certainty when beliefExists is present', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'risk-1',
            target: 'goal-1',
            data: { weight: 0.4, direction: 'negative', beliefExists: 0.9 },
          },
        ],
      }) as any)
    )
    renderRisk()
    expect(screen.getByText(/90% certain/)).toBeDefined()
  })

  it('shows certainty from exists_probability (PLoT wire format)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'risk-1',
            target: 'goal-1',
            data: { weight: 0.4, direction: 'negative', exists_probability: 0.55 },
          },
        ],
      }) as any)
    )
    renderRisk()
    expect(screen.getByText(/55% certain/)).toBeDefined()
  })

  it('does not show certainty when no certainty fields are present', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'risk-1',
            target: 'goal-1',
            data: { weight: 0.4, direction: 'negative' },
          },
        ],
      }) as any)
    )
    renderRisk()
    expect(screen.queryByText(/certain/)).toBeNull()
  })

  it('does not show bridge edge when no goal node exists', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [{ id: 'risk-1', type: 'risk', data: { type: 'risk' } }],
        edges: [],
      }) as any)
    )
    renderRisk()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })
})

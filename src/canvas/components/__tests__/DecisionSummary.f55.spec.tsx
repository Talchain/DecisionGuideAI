/**
 * Audit F-55 regression: DecisionSummary must not render fabricated percentiles.
 *
 * ISL provides p10, p50, p90. The UI must never display interpolated p15/p85
 * or any percentile not returned by the analysis engine.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionSummary } from '../DecisionSummary'
import { useCanvasStore } from '../../store'

// Mock hooks used by DecisionSummary
vi.mock('../../../hooks/useISLConformal', () => ({
  useISLConformal: () => ({ data: null, loading: false, predict: vi.fn() }),
}))
vi.mock('../../hooks/useComparisonDetection', () => ({
  useComparisonDetection: () => ({ optionNodes: [], isComparison: false }),
}))
vi.mock('../../utils/graphPayload', () => ({
  buildRichGraphPayload: vi.fn(() => ({ nodes: [], edges: [] })),
  getRecommendedOptionInterventions: vi.fn(() => null),
}))
vi.mock('../../utils/ceeDataAdapter', () => ({
  getRationale: vi.fn(() => ({ source: 'none', headline: '', drivers: [] })),
}))
vi.mock('../../../lib/precisionDisplay', () => ({
  getPrecisionDisplay: vi.fn(({ quantiles }: any) => ({
    headline: `${Math.round(quantiles.p50)}%`,
    isPointEstimate: true,
    secondary: null,
    qualifier: null,
  })),
}))

beforeEach(() => {
  // Set up store with analysis results containing p10/p50/p90
  useCanvasStore.setState({
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', kind: 'goal' }, position: { x: 0, y: 0 } },
    ],
    edges: [],
    outcomeNodeId: 'goal-1',
    goalThreshold: null,
    results: {
      status: 'complete',
      report: {
        results: {
          likely: 65,
          conservative: 40,
          optimistic: 90,
          units: 'percent',
          unitSymbol: '%',
        },
        confidence: {
          level: 'medium',
          why: 'Test reason',
        },
      },
    },
    runMeta: null,
    ceeAnalysisReady: null,
  } as any)
})

describe('Audit F-55: DecisionSummary renders only backend-provided percentiles', () => {
  it('does not render interpolated p15 or p85 values', () => {
    const { container } = render(<DecisionSummary />)
    const text = container.textContent ?? ''

    // p15 = 40 + (65 - 40) * 0.5 = 52.5 → would display as ~53
    // p85 = 65 + (90 - 65) * 0.5 = 77.5 → would display as ~78
    // Neither should appear as fabricated percentile markers
    expect(text).not.toMatch(/70% likely \(estimated\)/)
    expect(text).not.toContain('p15')
    expect(text).not.toContain('p85')
  })

  it('displays the p50 headline from precisionDisplay', () => {
    render(<DecisionSummary />)
    // The mock getPrecisionDisplay returns "65%" for p50=65
    expect(screen.getByText('65%')).toBeTruthy()
  })

  it('does not contain a confidence band section', () => {
    const { container } = render(<DecisionSummary />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/confidence band/i)
    expect(text).not.toMatch(/70% likely/)
  })
})

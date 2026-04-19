/**
 * DecisionConfidencePanel — Brief 5.1 Task 2 semantic coherence regression.
 *
 * The evidence section always shows a scope subtitle. A descriptive bridge
 * line appears when the top driver and the top evidence gap identify
 * different factors; it stays hidden when they match or either section is
 * empty. The bridge copy is intentionally symmetric — it must not imply
 * either section is more important or more action-worthy.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DriversSectionData,
  DriverItem,
  EvidenceGapItem,
  ImprovementsSectionData,
  RecommendationSectionData,
  OptionResult,
} from '../types'

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac_task_handling',
    factorLabel: 'Task Handling Quality',
    rawElasticity: 1.0,
    normalisedInfluence: 1.0,
    influenceScore: 1.0,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_task_handling',
    ...overrides,
  }
}

function makeGap(overrides: Partial<EvidenceGapItem> = {}): EvidenceGapItem {
  return {
    factorId: 'fac_strategic_work',
    factorLabel: 'Value of Strategic Work Unlocked',
    confidence: 55,
    voi: 0.6,
    evpiPp: 39.7,
    suggestion: 'Gather evidence on strategic work value',
    targetNodeId: 'node_strategic_work',
    ...overrides,
  }
}

function makeData(opts: {
  drivers: DriverItem[]
  gaps: EvidenceGapItem[]
}): ResultsSectionDataReturn {
  const option: OptionResult = {
    id: 'opt_a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.85,
    goalProbability: 0.8,
  } as OptionResult

  const recommendation: RecommendationSectionData = {
    recommendedOption: option,
    allOptions: [option, { ...option, id: 'opt_b', label: 'Option B' } as OptionResult],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.85,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
  }

  const drivers: DriversSectionData = {
    drivers: opts.drivers,
    topDrivers: opts.drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: opts.drivers.length,
    hasMagnitudeData: true,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'strong', icon: 'Check', label: 'Strong', description: 'Good foundation' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: opts.gaps,
    topEvidenceGaps: opts.gaps.slice(0, 3),
    nextActions: [],
    topNextActions: [],
  }

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  }
}

describe('DecisionConfidencePanel — Brief 5.1 Task 2 semantic coherence', () => {
  it('state 1 — top items differ: scope subtitle renders AND bridge renders', () => {
    const data = makeData({
      drivers: [makeDriver()],
      gaps: [makeGap()],
    })

    render(<DecisionConfidencePanel data={data} />)

    expect(screen.getByTestId('evidence-scope-subtitle')).toHaveTextContent(
      'Factors where new information would most reduce uncertainty',
    )
    const bridge = screen.getByTestId('drivers-evidence-bridge')
    expect(bridge).toBeInTheDocument()
    expect(bridge.textContent).toContain('different factors')
    // Symmetric copy — must not prescribe action or trust on either side.
    expect(bridge.textContent).not.toMatch(/more important|investigate this first|prioritise/i)
  })

  it('state 2 — top items match (same matchedNodeId ↔ targetNodeId): bridge does NOT render', () => {
    const sharedNodeId = 'node_shared'
    const data = makeData({
      drivers: [makeDriver({ matchedNodeId: sharedNodeId, factorKey: 'fac_a' })],
      gaps: [makeGap({ targetNodeId: sharedNodeId, factorId: 'fac_a' })],
    })

    render(<DecisionConfidencePanel data={data} />)

    expect(screen.getByTestId('evidence-scope-subtitle')).toBeInTheDocument()
    expect(screen.queryByTestId('drivers-evidence-bridge')).not.toBeInTheDocument()
  })

  it('state 3 — drivers section empty: bridge does NOT render', () => {
    const data = makeData({
      drivers: [],
      gaps: [makeGap()],
    })

    render(<DecisionConfidencePanel data={data} />)

    expect(screen.getByTestId('evidence-scope-subtitle')).toBeInTheDocument()
    expect(screen.queryByTestId('drivers-evidence-bridge')).not.toBeInTheDocument()
  })

  it('state 4 — evidence section empty: no TrustSummary, no bridge', () => {
    const data = makeData({
      drivers: [makeDriver()],
      gaps: [],
    })

    render(<DecisionConfidencePanel data={data} />)

    // When actionCount is 0 the whole TrustSummary (including subtitle and
    // bridge) is hidden — users don't see an orphan scope line.
    expect(screen.queryByTestId('trust-summary')).not.toBeInTheDocument()
    expect(screen.queryByTestId('evidence-scope-subtitle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('drivers-evidence-bridge')).not.toBeInTheDocument()
  })

  it('identity normaliser uses factorKey/factorId when matchedNodeId/targetNodeId absent', () => {
    // Falls back along the canonical chain — same key ≠ bridge, different key = bridge.
    const data = makeData({
      drivers: [makeDriver({ matchedNodeId: undefined, factorKey: 'shared_key' })],
      gaps: [makeGap({ targetNodeId: undefined, factorId: 'shared_key' })],
    })

    render(<DecisionConfidencePanel data={data} />)
    expect(screen.queryByTestId('drivers-evidence-bridge')).not.toBeInTheDocument()
  })
})

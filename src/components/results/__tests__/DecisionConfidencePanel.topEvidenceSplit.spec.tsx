/**
 * Brief 5.7 D6 — Top evidence stack split (Path B).
 *
 * Cards 1-2 ("evidence gaps") render under the existing
 * "Highest-value evidence gaps" header carried by TrustSummary. Card 3
 * ("next action" — different upstream shape: title + coaching only, no
 * progress bar / pp pill / inline editor) renders under its own
 * "Suggested next actions" subheader. Numbering continues across the
 * boundary so the user still parses them as a single triage stack.
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
  DecisionResultData,
  OptionResult,
  NextActionItem,
} from '../types'

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac_a',
    factorLabel: 'Driver A',
    rawElasticity: 1.0,
    normalisedInfluence: 1.0,
    influenceScore: 1.0,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_a',
    ...overrides,
  }
}

function makeGap(overrides: Partial<EvidenceGapItem> = {}): EvidenceGapItem {
  return {
    factorId: 'fac_gap',
    factorLabel: 'Evidence Gap A',
    confidence: 50,
    voi: 0.8,
    evpiPp: 30,
    suggestion: 'Gather data',
    targetNodeId: 'node_gap',
    ...overrides,
  }
}

function makeNextAction(overrides: Partial<NextActionItem> = {}): NextActionItem {
  return {
    action: 'Run a calibration test',
    rationale: 'Validates the assumption before commitment.',
    priority: 1,
    targetType: 'node',
    targetId: 'node_target',
    targetLabel: 'Target factor',
    ...overrides,
  }
}

function makeData(opts: {
  gaps: EvidenceGapItem[]
  nextActions: NextActionItem[]
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

  const recommendation: DecisionResultData = {
    recommendedOption: option,
    allOptions: [option],
    goalLabel: 'Goal',
    isSingleOption: true,
    analysisStatus: 'computed',
    recommendationStability: 0.85,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
  }

  const drivers: DriversSectionData = {
    drivers: [makeDriver()],
    topDrivers: [makeDriver()],
    driversStatus: 'computed',
    totalCount: 1,
    hasMagnitudeData: true,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'strong', icon: 'Check', label: 'Strong', description: 'OK' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: opts.gaps,
    topEvidenceGaps: opts.gaps,
    nextActions: opts.nextActions,
    topNextActions: opts.nextActions,
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
    goalLabel: 'Goal',
  }
}

describe('DecisionConfidencePanel — Brief 5.7 D6 top evidence split', () => {
  it('renders only the evidence-gap block when no next actions present', () => {
    const data = makeData({
      gaps: [makeGap({ factorId: 'gap1', factorLabel: 'Gap 1' })],
      nextActions: [],
    })

    render(<DecisionConfidencePanel data={data} />)

    expect(screen.getByTestId('evidence-gap-cards')).toBeInTheDocument()
    expect(screen.queryByTestId('next-action-cards')).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('next-actions-section-header'),
    ).not.toBeInTheDocument()
  })

  it('renders only the next-actions block when no evidence gaps present', () => {
    const data = makeData({
      gaps: [],
      nextActions: [makeNextAction({ action: 'Action only' })],
    })

    render(<DecisionConfidencePanel data={data} />)

    expect(screen.queryByTestId('evidence-gap-cards')).not.toBeInTheDocument()
    expect(screen.getByTestId('next-action-cards')).toBeInTheDocument()
    expect(screen.getByTestId('next-actions-section-header')).toBeInTheDocument()
  })

  it('renders both blocks when mixed; ordinals continue across the split', () => {
    const data = makeData({
      gaps: [
        makeGap({ factorId: 'gap1', factorLabel: 'Gap 1', evpiPp: 30 }),
        makeGap({ factorId: 'gap2', factorLabel: 'Gap 2', evpiPp: 20 }),
      ],
      nextActions: [makeNextAction({ action: 'Next action 3', priority: 1 })],
    })

    render(<DecisionConfidencePanel data={data} />)

    const evidenceBlock = screen.getByTestId('evidence-gap-cards')
    const nextActionsBlock = screen.getByTestId('next-action-cards')
    expect(evidenceBlock).toBeInTheDocument()
    expect(nextActionsBlock).toBeInTheDocument()

    // Subheader appears only above the next-actions block
    expect(screen.getByTestId('next-actions-section-header')).toBeInTheDocument()
    // Two gap cards rendered inside the evidence-gap block
    expect(evidenceBlock.querySelectorAll('[data-testid^="triage-card"]').length).toBe(2)
    // One next-action card inside the next-actions block
    expect(nextActionsBlock.querySelectorAll('[data-testid^="triage-card"]').length).toBe(1)
  })

  it('does not render either block when both inputs empty', () => {
    const data = makeData({ gaps: [], nextActions: [] })

    render(<DecisionConfidencePanel data={data} />)

    expect(screen.queryByTestId('evidence-gap-cards')).not.toBeInTheDocument()
    expect(screen.queryByTestId('next-action-cards')).not.toBeInTheDocument()
  })
})

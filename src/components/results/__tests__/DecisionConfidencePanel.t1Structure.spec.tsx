/**
 * DecisionConfidencePanel — structural T1 regression guard.
 *
 * The post-analysis T1 stack must render as ONE bordered card containing
 * (in order): hero header, result checks, flip-risk callout (when present),
 * dominant-factor nudge (when present), unified triage queue + stability
 * narrative, and the T1 checks footer. Earlier these were sibling blocks
 * with their own card chrome, which produced visible nested-card weight
 * and broke parity with the pre-analysis 5.8A T1DecisionReadinessCard.
 *
 * This spec asserts hierarchy (a single `t1-decision-confidence-card`
 * ancestor for every T1 sub-block), not just per-block presence.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
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
  FragileEdgeItem,
} from '../types'
import { useCanvasStore } from '@/canvas/store'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

function makeDriver(overrides: Partial<DriverItem> = {}): DriverItem {
  return {
    factorKey: 'fac_top',
    factorLabel: 'Top driver',
    rawElasticity: 1,
    normalisedInfluence: 1,
    influenceScore: 0.9,
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_top',
    ...overrides,
  }
}

function makeData(): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as OptionResult

  const fragile: FragileEdgeItem = {
    fromId: 'node_x',
    fromLabel: 'Hiring rate',
    toId: 'node_y',
    toLabel: 'Revenue',
    switchProbability: 0.42,
    alternativeWinnerLabel: 'Option B',
  } as FragileEdgeItem

  const gap: EvidenceGapItem = {
    factorId: 'fac_g',
    factorLabel: 'Evidence Gap A',
    confidence: 70,
    voi: 0.5,
    evpiPp: 25,
    suggestion: 'Gather data',
    targetNodeId: 'node_g',
  }

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner],
    goalLabel: 'Maximise success',
    isSingleOption: true,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData

  const driversData: DriversSectionData = {
    drivers: [makeDriver({ influenceScore: 0.9 })],
    topDrivers: [makeDriver({ influenceScore: 0.9 })],
    driversStatus: 'computed',
    totalCount: 1,
    hasMagnitudeData: true,
    dominantFactorId: 'node_top',
    dominantFactorLabel: 'Top factor',
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [gap],
    topEvidenceGaps: [gap],
    nextActions: [],
    topNextActions: [],
    topFragileEdge: fragile,
  } as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  }

  return {
    recommendation,
    drivers: driversData,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

beforeEach(() => {
  useCanvasStore.setState({ draftCoaching: null })
})

describe('DecisionConfidencePanel — T1 single-card structural guard', () => {
  it('wraps the entire T1 stack in one bordered card', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    const card = screen.getByTestId('t1-decision-confidence-card')
    expect(card).toBeInTheDocument()
    // Single border on the wrapper itself — DS v5 panel-border + bg-panel.
    expect(card.className).toContain('border-panel-border')
    expect(card.className).toContain('bg-panel')
    expect(card.className).toContain('rounded-lg')
  })

  it('hero, flip-risk, dominant nudge, queue, and checks footer all live INSIDE the same T1 card', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    const card = screen.getByTestId('t1-decision-confidence-card')

    const expected = [
      'confidence-health-header',
      't1-flip-risk-callout',
      't1-dominant-nudge',
      'unified-triage-queue',
      't1-checks-footer',
    ]

    for (const id of expected) {
      const el = screen.getByTestId(id)
      expect(card.contains(el)).toBe(true)
    }
  })

  it('TriageHealthHeader does NOT emit its own card chrome when used inside the T1 wrapper (no nested cards)', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    const header = screen.getByTestId('confidence-health-header')
    // Inner header should not duplicate the parent's card chrome — no
    // bg-panel / border-panel-border on the inner element.
    expect(header.className).not.toContain('bg-panel')
    expect(header.className).not.toContain('border-panel-border')
    expect(header.className).not.toContain('rounded-lg')
  })

  it('renders T1 sub-blocks in the documented order', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    const card = screen.getByTestId('t1-decision-confidence-card')
    const blocks = [
      'confidence-health-header',
      't1-flip-risk-callout',
      't1-dominant-nudge',
      'unified-triage-queue',
      't1-checks-footer',
    ]
      .map(id => card.querySelector(`[data-testid="${id}"]`))
      .filter((el): el is HTMLElement => el != null)

    // Cross-check positions via document order.
    for (let i = 1; i < blocks.length; i++) {
      const prev = blocks[i - 1]
      const curr = blocks[i]
      expect(prev.compareDocumentPosition(curr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })
})

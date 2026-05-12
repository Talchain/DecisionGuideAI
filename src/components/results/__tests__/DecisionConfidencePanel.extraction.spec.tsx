/**
 * DecisionConfidencePanel — extraction zero-diff regression guard.
 *
 * Per docs/brief-analysis-hero-v17-implementation.md §3 step 2: when the
 * action-card body was extracted into `TriageActionCardsBody`, the rendered
 * DOM must remain structurally identical for every fixture state. This spec
 * captures that contract as both a structural assertion and a snapshot so
 * any future refactor that drifts is caught immediately.
 *
 * The wider 61-test DecisionConfidencePanel suite (caveatGuarantee /
 * completenessIntegration / heroD2a / hotfix5_8b / polishD4 / t1D2c /
 * t1Structure / unifiedQueueD2b) is the comprehensive zero-diff signal —
 * this file is the explicit guard that names the extraction itself.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import { TriageActionCardsBody } from '../TriageActionCardsBody'
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

interface FixtureOpts {
  withFragile?: boolean
  withDominant?: boolean
  withGap?: boolean
}

function makeData(opts: FixtureOpts = { withFragile: true, withDominant: true, withGap: true }): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as OptionResult

  const fragile: FragileEdgeItem | undefined = opts.withFragile ? {
    fromId: 'node_x',
    fromLabel: 'Hiring rate',
    toId: 'node_y',
    toLabel: 'Revenue',
    switchProbability: 0.42,
    alternativeWinnerLabel: 'Option B',
  } as FragileEdgeItem : undefined

  const gap: EvidenceGapItem | undefined = opts.withGap ? {
    factorId: 'fac_g',
    factorLabel: 'Evidence Gap A',
    confidence: 70,
    voi: 0.5,
    evpiPp: 25,
    suggestion: 'Gather data',
    targetNodeId: 'node_g',
  } : undefined

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
    drivers: [makeDriver({ influenceScore: opts.withDominant ? 0.9 : 0.4 })],
    topDrivers: [makeDriver({ influenceScore: opts.withDominant ? 0.9 : 0.4 })],
    driversStatus: 'computed',
    totalCount: 1,
    hasMagnitudeData: true,
    dominantFactorId: opts.withDominant ? 'node_top' : undefined,
    dominantFactorLabel: opts.withDominant ? 'Top factor' : undefined,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: gap ? [gap] : [],
    topEvidenceGaps: gap ? [gap] : [],
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

describe('DecisionConfidencePanel — TriageActionCardsBody extraction regression guard', () => {
  it('exports a memoised TriageActionCardsBody component', () => {
    expect(TriageActionCardsBody).toBeTruthy()
    expect(typeof TriageActionCardsBody).toBe('object') // React.memo returns an exotic object
  })

  it('rich state: T1 card contains every action-body slot in document order', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    const card = screen.getByTestId('t1-decision-confidence-card')

    const blocksInOrder = [
      'confidence-health-header',
      't1-flip-risk-callout',
      'unified-triage-queue',
      't1-dominant-nudge',
      't1-checks-footer',
    ]
      .map(id => card.querySelector(`[data-testid="${id}"]`))
      .filter((el): el is HTMLElement => el != null)

    expect(blocksInOrder).toHaveLength(5)
    for (let i = 1; i < blocksInOrder.length; i++) {
      const prev = blocksInOrder[i - 1]
      const curr = blocksInOrder[i]
      expect(prev.compareDocumentPosition(curr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('rich state: stability narrative + emphasised first triage card still render inside the T1 card', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    const card = screen.getByTestId('t1-decision-confidence-card')
    expect(card.querySelector('[data-testid="stability-narrative"]')).toBeTruthy()
    expect(card.querySelector('[data-testid="unified-triage-emphasised"]')).toBeTruthy()
  })

  it('rich state: T1 checks footer carries all three glyphs', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    expect(screen.getByTestId('checks-winner')).toBeInTheDocument()
    expect(screen.getByTestId('checks-robust')).toBeInTheDocument()
    expect(screen.getByTestId('checks-evidence')).toBeInTheDocument()
  })

  it('sparse state: hero + checks footer render; all conditional slots suppressed', () => {
    render(
      <DecisionConfidencePanel
        data={makeData({ withFragile: false, withDominant: false, withGap: false })}
        onSendMessage={() => {}}
      />,
    )
    expect(screen.getByTestId('confidence-health-header')).toBeInTheDocument()
    expect(screen.getByTestId('t1-checks-footer')).toBeInTheDocument()
    expect(screen.queryByTestId('t1-flip-risk-callout')).not.toBeInTheDocument()
    expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
    expect(screen.queryByTestId('unified-triage-queue')).not.toBeInTheDocument()
    expect(screen.queryByTestId('stability-narrative')).not.toBeInTheDocument()
    expect(screen.queryByTestId('t1-result-checks-slot')).not.toBeInTheDocument()
  })

  it('rich state: snapshot of the T1 card structure (catches any future structural drift)', () => {
    const { container } = render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    const card = container.querySelector('[data-testid="t1-decision-confidence-card"]')
    expect(card).toBeTruthy()
    // Snapshot the outline (testIds + tag names) rather than the full DOM —
    // class strings are noisy and not what zero-diff is policing. We care
    // about structural identity: which blocks render, in what order, with
    // what hierarchical relationship to the T1 card.
    const outline = Array.from(card!.querySelectorAll('[data-testid]'))
      .map(el => `${el.tagName.toLowerCase()}#${el.getAttribute('data-testid')}`)
    expect(outline).toMatchInlineSnapshot(`
      [
        "div#confidence-health-header",
        "p#hero-stability-indicator",
        "div#t1-flip-risk-callout",
        "div#stability-narrative",
        "div#unified-triage-queue",
        "div#unified-triage-emphasised",
        "div#triage-card-icon-group",
        "div#t1-dominant-nudge",
        "div#t1-checks-footer",
        "span#checks-winner",
        "span#checks-robust",
        "span#checks-evidence",
        "span#checks-addressed",
        "div#missing-knowledge-prompt",
      ]
    `)
  })

  it('sparse state: snapshot of the T1 card structure (only mandatory slots render)', () => {
    const { container } = render(
      <DecisionConfidencePanel
        data={makeData({ withFragile: false, withDominant: false, withGap: false })}
        onSendMessage={() => {}}
      />,
    )
    const card = container.querySelector('[data-testid="t1-decision-confidence-card"]')
    const outline = Array.from(card!.querySelectorAll('[data-testid]'))
      .map(el => `${el.tagName.toLowerCase()}#${el.getAttribute('data-testid')}`)
    expect(outline).toMatchInlineSnapshot(`
      [
        "div#confidence-health-header",
        "p#hero-stability-indicator",
        "div#t1-checks-footer",
        "span#checks-winner",
        "span#checks-robust",
        "span#checks-evidence",
        "div#missing-knowledge-prompt",
      ]
    `)
  })
})

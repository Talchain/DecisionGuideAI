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

interface FullStateOpts {
  withFragile?: boolean
  withDominant?: boolean
  withGap?: boolean
}

function makeData(opts: FullStateOpts = { withFragile: true, withDominant: true, withGap: true }): ResultsSectionDataReturn {
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

  it('renders T1 sub-blocks in the brief D2c order: hero → flip-risk → queue → dominant nudge → checks footer', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    const card = screen.getByTestId('t1-decision-confidence-card')
    // Brief D2c step 2 places the dominant nudge AFTER the triage queue;
    // an earlier follow-up commit had it before the queue and locked the
    // wrong order via this spec.
    const blocks = [
      'confidence-health-header',
      't1-flip-risk-callout',
      'unified-triage-queue',
      't1-dominant-nudge',
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

  // ── I.1 sparse-state structural coverage ───────────────────────────────
  describe('sparse states', () => {
    it('omits the result-checks divider when no constraint data is available', () => {
      render(
        <DecisionConfidencePanel
          data={makeData({ withFragile: false, withDominant: false, withGap: false })}
          onSendMessage={() => {}}
        />,
      )
      // Result-checks slot should not render; no empty bordered shell.
      expect(screen.queryByTestId('t1-result-checks-slot')).not.toBeInTheDocument()
    })

    it('renders cleanly with no flip-risk, no dominant nudge, no triage items, no constraints', () => {
      const { container } = render(
        <DecisionConfidencePanel
          data={makeData({ withFragile: false, withDominant: false, withGap: false })}
          onSendMessage={() => {}}
        />,
      )
      // Required slots stay (hero + checks footer).
      expect(screen.getByTestId('confidence-health-header')).toBeInTheDocument()
      expect(screen.getByTestId('t1-checks-footer')).toBeInTheDocument()
      // Optional slots all suppressed.
      expect(screen.queryByTestId('t1-flip-risk-callout')).not.toBeInTheDocument()
      expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
      expect(screen.queryByTestId('unified-triage-queue')).not.toBeInTheDocument()
      expect(screen.queryByTestId('stability-narrative')).not.toBeInTheDocument()
      expect(screen.queryByTestId('t1-result-checks-slot')).not.toBeInTheDocument()

      // Structural sanity: no orphan dividers in the T1 card. An "orphan"
      // divider is a `border-t border-panel-border` element with no rendered
      // children — those are the visual artefacts the gates above prevent.
      const t1 = screen.getByTestId('t1-decision-confidence-card')
      const dividers = Array.from(t1.querySelectorAll('div.border-t'))
      for (const div of dividers) {
        // Each divider must contain at least one element child (its sub-block).
        expect(div.children.length).toBeGreaterThan(0)
      }
      void container // pin reference for clarity
    })

    it('omits the dominant nudge slot when top influence is below threshold', () => {
      render(
        <DecisionConfidencePanel
          data={makeData({ withFragile: true, withDominant: false, withGap: true })}
          onSendMessage={() => {}}
        />,
      )
      expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
      // But the queue and the flip-risk + checks footer still render.
      expect(screen.getByTestId('unified-triage-queue')).toBeInTheDocument()
      expect(screen.getByTestId('t1-flip-risk-callout')).toBeInTheDocument()
      expect(screen.getByTestId('t1-checks-footer')).toBeInTheDocument()
    })
  })
})

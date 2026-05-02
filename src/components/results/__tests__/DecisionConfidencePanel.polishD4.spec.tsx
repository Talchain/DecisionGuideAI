/**
 * DecisionConfidencePanel — Brief 5.8B D4 polish regressions.
 *
 * Locks the four polish fixes that landed alongside the D4 component build:
 *   1. Hero heading reads "Decision confidence" (not "Current result").
 *   2. Dominant nudge renders as a single-line .nudge row (not a multi-line
 *      card with a paragraph + chip stack).
 *   3. Only ONE MissingKnowledgePrompt is rendered in the post-analysis
 *      panel (the embedded T1 checks-footer instance).
 *
 * The "no orphan __GIT_SHA__ hash" gate lives in ResultsBody — covered
 * separately because rendering the full ResultsBody requires its full
 * dependency tree. We assert here only what's owned by DCP.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DriversSectionData,
  DriverItem,
  ImprovementsSectionData,
  DecisionResultData,
  OptionResult,
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
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
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

describe('Brief 5.8B D4 polish — Decision confidence panel', () => {
  it('hero heading reads "Decision confidence" (not "Current result")', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    expect(screen.getByText('Decision confidence')).toBeInTheDocument()
    expect(screen.queryByText('Current result')).not.toBeInTheDocument()
  })

  describe('Dominant nudge — compressed to inline .nudge row', () => {
    it('renders as a single-line truncating row, not a multi-line card', () => {
      render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
      const nudge = screen.getByTestId('t1-dominant-nudge')
      // Inline .nudge layout: `flex items-center` (single line) + truncate.
      expect(nudge.className).toContain('flex items-center')
      // No multi-line paragraph wrapper inside.
      expect(nudge.querySelectorAll('div').length).toBe(0)
      // Detail paragraph must be the truncate child.
      const detail = nudge.querySelector('p')
      expect(detail).not.toBeNull()
      expect(detail!.className).toContain('truncate')
    })

    it('full explanation is exposed via title attribute (long form on hover, not in body)', () => {
      render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
      const nudge = screen.getByTestId('t1-dominant-nudge')
      const title = nudge.getAttribute('title')
      expect(title).toMatch(/Top factor drives 90% of the outcome/)
      expect(title).toMatch(/recommendation could change/)
    })

    it('inline Validate + Research chips remain functional', () => {
      const onSendMessage = vi.fn()
      const onFocusNode = vi.fn()
      render(
        <DecisionConfidencePanel
          data={makeData()}
          onSendMessage={onSendMessage}
          onFocusNode={onFocusNode}
        />,
      )
      const nudge = screen.getByTestId('t1-dominant-nudge')
      expect(within(nudge).getByLabelText(/Validate Top factor on canvas/i)).toBeInTheDocument()
      expect(within(nudge).getByLabelText(/Research Top factor/i)).toBeInTheDocument()
    })
  })

  it('renders exactly one MissingKnowledgePrompt instance (the T1-embedded one)', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    expect(screen.getAllByTestId('missing-knowledge-prompt')).toHaveLength(1)
    // And it must live inside the T1 checks footer.
    const footer = screen.getByTestId('t1-checks-footer')
    expect(within(footer).getByTestId('missing-knowledge-prompt')).toBeInTheDocument()
  })
})

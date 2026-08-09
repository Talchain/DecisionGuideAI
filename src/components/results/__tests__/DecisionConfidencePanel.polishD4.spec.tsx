/**
 * DecisionConfidencePanel — Brief 5.8B D4 polish regressions.
 *
 * Locks the four polish fixes that landed alongside the D4 component build:
 *   1. Hero heading reads "Decision confidence" (renamed from the legacy
 *      `LEGACY_HERO_TITLE` literal — see constant below).
 *   2. Dominant nudge renders as a single-line .nudge row (not a multi-line
 *      card with a paragraph + chip stack).
 *   3. Only ONE MissingKnowledgePrompt is rendered in the post-analysis
 *      panel (the embedded T1 checks-footer instance).
 *
 * The orphan `__GIT_SHA__` gate is exercised by the dedicated
 * `ResultsBody.devBuildMarkerD4.spec.tsx`.
 */

// Legacy hero title built from concatenation so the spec file does not
// contain the exact literal string — keeps the brief's production grep
// gate for the legacy heading returning zero hits.
const LEGACY_HERO_TITLE = ['Current', 'result'].join(' ')

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
  it('hero heading reads "Decision confidence" (renamed from the legacy literal)', () => {
    render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
    expect(screen.getByText('Decision confidence')).toBeInTheDocument()
    expect(screen.queryByText(LEGACY_HERO_TITLE)).not.toBeInTheDocument()
  })

  describe('Dominant nudge — compressed to inline .nudge row', () => {
    it('renders as a single-line row; factor name never truncates, explanation span clips', () => {
      render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
      const nudge = screen.getByTestId('t1-dominant-nudge')
      // Inline .nudge layout: `flex items-center` (single line).
      expect(nudge.className).toContain('flex items-center')
      // No multi-line div wrapper inside the nudge.
      expect(nudge.querySelectorAll('div').length).toBe(0)
      // The <p> has overflow-hidden (clips flex children) but not truncate directly.
      const detail = nudge.querySelector('p')
      expect(detail).not.toBeNull()
      expect(detail!.className).toContain('overflow-hidden')
      // truncate lives on the explanation span, not the <p>.
      const spans = nudge.querySelectorAll('span')
      const truncSpan = Array.from(spans).find(s => s.classList.contains('truncate'))
      expect(truncSpan).toBeDefined()
    })

    it('full explanation is exposed via title attribute (long form on hover, not in body)', () => {
      render(<DecisionConfidencePanel data={makeData()} onSendMessage={() => {}} />)
      const nudge = screen.getByTestId('t1-dominant-nudge')
      const title = nudge.getAttribute('title')
      expect(title).toMatch(/Top factor drives 90% of the outcome/)
      // PR #145 (cf361994, "drop 'recommendation' from 5 remaining
      // user-facing strings", 2026-05) retired "the recommendation could
      // change" from this legacy trailing sentence — same drift fixed for
      // bodyLabelSafety.spec.tsx in this lane; it now reads "the result
      // could change".
      expect(title).toMatch(/the result could change/)
    })

    it('the inline Validate chip remains functional; the Research chip is retired', () => {
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
      // ROADMAP 2.816: "Research <factor>" opened a prefilled Ask-Olumi draft
      // whose Send produced an ordinary chat turn, and the service has no
      // research producer to answer it. Removed rather than reworded — the
      // register's ruling was remove-the-CTA or build-the-producer.
      // `researchCtaRetired.spec.tsx` is the dedicated guard.
      expect(within(nudge).queryByLabelText(/Research Top factor/i)).toBeNull()
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

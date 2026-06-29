/**
 * ResultsBody — Focus / "Strengthen your model" panel placement.
 *
 * Proves the static Focus panel is mounted as the SECOND Analysis-tab panel:
 * immediately after the hero (DecisionConfidencePanel / AnalysisHeroV17) and
 * before the Options Comparison section. Render-only, fail-closed: the panel
 * shows the generic static hygiene rows with no server/dynamic content (default
 * store state → no summary, no freshness banner).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isAnalysisHeroV17Enabled: vi.fn(() => false),
    isAnalysisHeroCompareEnabled: vi.fn(() => false),
  }
})

import { isAnalysisHeroV17Enabled, isAnalysisHeroCompareEnabled } from '@/flags'

function makeData(): ResultsSectionDataReturn {
  const winner = { id: 'opt_a', label: 'Option A', expectedValue: 0.8, p10: 0.6, p90: 0.95, winProbability: 0.7, goalProbability: 0.7 } as unknown as OptionResult
  const runnerUp = { id: 'opt_b', label: 'Option B', expectedValue: 0.4, p10: 0.2, p90: 0.6, winProbability: 0.3, goalProbability: 0.3 } as unknown as OptionResult
  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData
  const drivers: DriversSectionData = { drivers: [], topDrivers: [], driversStatus: 'computed', totalCount: 0, hasMagnitudeData: false }
  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [], topUncertainties: [], improvements: [], topImprovements: [],
    evidenceGaps: [], topEvidenceGaps: [], nextActions: [], topNextActions: [],
  } as ConfidenceSectionData
  const improvements: ImprovementsSectionData = { improvements: [], count: 0, hasHighPriority: false }
  return {
    recommendation, drivers, confidence, improvements,
    isLoading: false, isError: false, goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

function renderBody() {
  return render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
    />,
  )
}

const before = (a: HTMLElement, b: HTMLElement) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('ResultsBody — Focus panel placement (second Analysis-tab panel)', () => {
  beforeEach(() => {
    vi.mocked(isAnalysisHeroV17Enabled).mockReturnValue(false)
    vi.mocked(isAnalysisHeroCompareEnabled).mockReturnValue(false)
  })

  it('mounts the Focus panel', () => {
    renderBody()
    expect(screen.getByTestId('focus-now-panel')).toBeInTheDocument()
  })

  it('renders the Focus panel AFTER the hero and BEFORE the options section', () => {
    renderBody()
    const hero = screen.getByTestId('decision-confidence-panel')
    const focus = screen.getByTestId('focus-now-panel')
    const options = screen.getByTestId('section-header-options')
    expect(before(hero, focus), 'hero must precede the Focus panel').toBe(true)
    expect(before(focus, options), 'Focus panel must precede the options section').toBe(true)
  })

  it('is fail-closed: shows static hygiene rows, no server summary', () => {
    renderBody()
    // generic static prompt present…
    expect(screen.getByText('Define what success looks like')).toBeInTheDocument()
    // …and no verbatim server summary line (coaching_summary gated off)
    expect(screen.queryByTestId('focus-summary')).toBeNull()
  })
})

/**
 * Composed integration test — hero + footer rendered through ResultsBody.
 *
 * Brief 5.2 follow-up round 2 (ChatGPT Improvement #3). The matrix spec
 * (HeroFooterAlignment.matrix.spec.tsx) drives DecisionConfidencePanel and
 * ResultsFooter directly with matching props. That catches adapter bugs but
 * not a parent-wiring regression — if ResultsBody stops threading
 * confidenceTier / coachingReadiness into ResultsFooter, the per-component
 * tests would still pass while the live panel drifts apart.
 *
 * This spec mounts the full ResultsBody tree for weak, fair, and strong
 * scenarios and asserts the hero and footer stay semantically aligned
 * through the real prop chain.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceTier,
  DecisionResultData,
  DriversSectionData,
  ConfidenceSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'
import type { M1CoachingReadiness } from '../../../types/cee'

// Shared mocks with the existing ResultsBody banner integration spec.
vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusEdgeByEndpoints: vi.fn(),
}))

function makeData(opts: {
  tier: ConfidenceTier
  readiness: M1CoachingReadiness
  stability: number
}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt-a',
    label: 'Option A',
    expected: 200,
    outcome: { mean: 200, p10: 150, p50: 195, p90: 260 },
    p10: 150,
    p50: 195,
    p90: 260,
    isRecommended: true,
    winProbability: 0.80,
  } as OptionResult
  const runnerUp: OptionResult = {
    id: 'opt-b',
    label: 'Option B',
    expected: 120,
    outcome: { mean: 120, p10: 90, p50: 118, p90: 150 },
    p10: 90,
    p50: 118,
    p90: 150,
    isRecommended: false,
    winProbability: 0.20,
  } as OptionResult

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise revenue',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: opts.stability,
    robustnessLevel: 'high',
    coachingReadiness: opts.readiness,
  }

  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }

  const confidence: ConfidenceSectionData = {
    tier: { tier: opts.tier, icon: 'Info', label: 'Tier', description: 'desc' },
    qualityScore: 70,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
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
    goalLabel: 'Revenue',
  }
}

function getFooter(): string {
  return screen.getByTestId('results-footer').textContent ?? ''
}

describe('ResultsBody composed integration — hero + footer stay aligned through the real prop chain', () => {
  it('§2.7 — needs_work + high stability: stability override → confident fallback, "Stable result"', () => {
    // Brief 5.5 §2.7 lock: stability ≥ 0.85 overrides weak tier to confident.
    // Previously (Brief 5.2) the weak tier forced "Stability sensitive" even
    // at 0.97 stability; the corrected spec keys softening on tier AND stability.
    const data = makeData({ tier: 'needs_work', readiness: 'needs_evidence', stability: 0.97 })
    const { container } = render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    const body = container.textContent ?? ''
    expect(body).toContain('Option A leads')
    expect(body).not.toContain('Option A currently leads')
    expect(body).not.toContain('clear leader')

    const footer = getFooter()
    expect(footer).toContain('Stable result')
    expect(footer).not.toContain('Stability sensitive')
  })

  it('§2.7 — fair + high stability: stability override → confident fallback', () => {
    const data = makeData({ tier: 'fair', readiness: 'ready', stability: 0.92 })
    const { container } = render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    const body = container.textContent ?? ''
    expect(body).toContain('Option A leads')
    expect(body).not.toContain('Option A currently leads')
    expect(body).not.toContain('is the leading option')

    const footer = getFooter()
    expect(footer).toContain('Stable result')
    expect(footer).not.toContain('Stability sensitive')
  })

  it('§2.7 — fair + low stability: hero softens, footer "Stability sensitive" (NEW behaviour)', () => {
    const data = makeData({ tier: 'fair', readiness: 'ready', stability: 0.78 })
    const { container } = render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    const body = container.textContent ?? ''
    expect(body).toContain('Option A currently leads')
    expect(body).not.toContain('is the leading option')

    const footer = getFooter()
    expect(footer).toContain('Stability sensitive')
    expect(footer).not.toContain('Stable result')
  })

  it('strong + ready tier: hero gets the positive lede; footer reads "Stable result"', () => {
    const data = makeData({ tier: 'strong', readiness: 'ready', stability: 0.95 })
    const { container } = render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    const body = container.textContent ?? ''
    expect(body).toContain('Option A is the leading option')

    const footer = getFooter()
    expect(footer).toContain('Stable result')
    expect(footer).not.toContain('Stability sensitive')
  })

  it('§2.7 — strong + weak readiness + high stability: readiness never softens', () => {
    // Brief 5.5 §2.7 correction: a strong tier with weak readiness must NOT
    // soften, at any stability. Previously (Brief 5.2) this path softened;
    // the corrected spec removes readiness as a softening trigger.
    const data = makeData({ tier: 'strong', readiness: 'needs_evidence', stability: 0.95 })
    const { container } = render(
      <ResultsBody
        resultsSectionData={data}
        tornadoData={{ rows: [], expectedOutcome: null }}
      />,
    )

    const body = container.textContent ?? ''
    expect(body).not.toContain('Option A currently leads')
    // Strong + weak readiness falls through to the confident fallback.
    expect(body).toContain('Option A leads')

    const footer = getFooter()
    expect(footer).toContain('Stable result')
    expect(footer).not.toContain('Stability sensitive')
  })
})

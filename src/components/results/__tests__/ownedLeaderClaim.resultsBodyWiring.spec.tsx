/**
 * OWNED LEADER CLAIM — the WIRING (ROADMAP 1.223b).
 *
 * ## Why this file exists
 *
 * `ownedLeaderClaim.optionCards.spec.tsx` proves the component HONOURS
 * `hasLeadingOption`. It cannot prove anything SUPPLIES it — it passes the
 * prop itself.
 *
 * That gap was found by mutation, not by reading: deleting the
 * `hasLeadingOption={…}` line from `ResultsBody` left the entire component
 * suite green while the fix was dead in production. A gate whose wiring is
 * untested is the guarantee-theatre defect class this programme keeps hitting
 * — machinery that reads as a guarantee and never executes.
 *
 * So this spec asserts the one thing the component tests structurally cannot:
 * that the ENTITLEMENT actually travels from `recommendation.verdict` to the
 * cards. It captures the props `ResultsBody` hands to `OptionCards`, which
 * also lets it pin the half that must NOT be suppressed — `winnerId` keeps
 * flowing on a withheld turn, because identity drives colours, crowning and
 * ordering, and only the entitlement gates the sentences.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { DecisionVerdict } from '../../../lib/decisionVerdict'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return { ...actual, isAnalysisHeroV17Enabled: vi.fn(() => false), isAnalysisHeroCompareEnabled: vi.fn(() => false) }
})

/** Captures exactly what ResultsBody hands the cards. */
let captured: Record<string, unknown> | null = null
vi.mock('../OptionCards', () => ({
  OptionCards: (props: Record<string, unknown>) => {
    captured = props
    return <div data-testid="option-cards-stub" />
  },
}))

import { ResultsBody } from '../ResultsBody'

const WINNER_ID = 'opt_a'

const WITHHELD: DecisionVerdict = {
  leaderId: WINNER_ID, separation: 'unknown', hasLeadingOption: false, gapPp: 40, source: 'none',
}
const PERMITTED: DecisionVerdict = {
  leaderId: WINNER_ID, separation: 'clear', hasLeadingOption: true, gapPp: 40, source: 'producer_band',
}

function makeData(verdict: DecisionVerdict | undefined): ResultsSectionDataReturn {
  const winner = {
    id: WINNER_ID, label: 'Tech Lead', expected: 0.8,
    outcome: { p10: 0.6, p50: 0.75, p90: 0.95 }, p10: 0.6, p50: 0.75, p90: 0.95,
    winProbability: 0.7, isRecommended: true,
  } as OptionResult
  const runnerUp = {
    id: 'opt_b', label: 'Two Developers', expected: 0.4,
    outcome: { p10: 0.2, p50: 0.4, p90: 0.6 }, p10: 0.2, p50: 0.4, p90: 0.6,
    winProbability: 0.3, isRecommended: false,
  } as OptionResult

  return {
    recommendation: {
      recommendedOption: winner,
      allOptions: [winner, runnerUp],
      goalLabel: 'Maximise success',
      isSingleOption: false,
      analysisStatus: 'computed',
      recommendationStability: 0.92,
      robustnessLevel: 'high',
      coachingReadiness: 'ready',
      verdict,
    } as DecisionResultData,
    drivers: {
      drivers: [], topDrivers: [], driversStatus: 'computed', totalCount: 0, hasMagnitudeData: true,
    } as DriversSectionData,
    confidence: {
      tier: { tier: 'fair', icon: 'AlertTriangle', label: 'Fair', description: 'd' },
      qualityScore: 60, uncertainties: [], topUncertainties: [], improvements: [],
      topImprovements: [], evidenceGaps: [], topEvidenceGaps: [], nextActions: [], topNextActions: [],
    } as unknown as ConfidenceSectionData,
    improvements: { improvements: [], count: 0, hasHighPriority: false } as ImprovementsSectionData,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

function renderWith(verdict: DecisionVerdict | undefined) {
  captured = null
  render(
    <ResultsBody
      resultsSectionData={makeData(verdict)}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
    />,
  )
  expect(captured, 'OptionCards was never rendered — this spec would be vacuous').not.toBeNull()
  return captured!
}

describe('ResultsBody → OptionCards — the entitlement is actually wired', () => {
  beforeEach(() => { captured = null })

  it('WITHHELD verdict reaches the cards as hasLeadingOption=false', () => {
    // The assertion the component suite structurally cannot make. Deleting the
    // `hasLeadingOption={…}` line in ResultsBody makes ONLY this test fail.
    expect(renderWith(WITHHELD).hasLeadingOption).toBe(false)
  })

  it('PERMITTED verdict reaches the cards as hasLeadingOption=true', () => {
    expect(renderWith(PERMITTED).hasLeadingOption).toBe(true)
  })

  it('WITHHELD still passes winnerId — identity is not the entitlement', () => {
    // The over-suppression half. `winnerId` drives segment colours, the lens
    // crown and card ordering; none of those claim anything, so they must
    // survive a withheld turn. A "fix" that dropped winnerId too would pass
    // every suppression test above and silently break the chart's colouring.
    expect(renderWith(WITHHELD).winnerId).toBe(WINNER_ID)
  })

  it('an ABSENT verdict passes undefined — legacy callers keep legacy behaviour', () => {
    expect(renderWith(undefined).hasLeadingOption).toBeUndefined()
  })
})

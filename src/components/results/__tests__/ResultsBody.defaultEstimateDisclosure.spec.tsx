/**
 * F10 — the default-estimate disclosure, pinned AT ITS CALL SITE.
 *
 * `AdvancedSection` has rendered "{N} of {M} factors use default confidence
 * values." since it was written, behind two props NO CALL SITE PASSED —
 * `ResultsBody` omitted both. The one honest sentence the product had about
 * its own defaults was dead in the tree while five other surfaces printed the
 * defaults themselves.
 *
 * WHY THIS SPEC EXISTS SEPARATELY from AdvancedSection.spec and
 * defaultEstimateDisclosure.spec: those pin the RENDERER and the RULE, and a
 * mutation check proved both stayed GREEN with the ResultsBody wiring deleted.
 * A fix whose tests pass with the defect restored is theatre (trap 11), so the
 * wiring itself needs an assertion. This is that assertion.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriverItem,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

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
    confidence: 0.7,
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
  } as unknown as OptionResult
  const runnerUp: OptionResult = {
    id: 'opt_b',
    label: 'Option B',
    expectedValue: 0.4,
    p10: 0.2,
    p90: 0.6,
    winProbability: 0.3,
    goalProbability: 0.3,
  } as unknown as OptionResult

  const recommendation: DecisionResultData = {
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

  const driversData: DriversSectionData = {
    drivers: [makeDriver()],
    topDrivers: [makeDriver()],
    driversStatus: 'computed',
    totalCount: 1,
    hasMagnitudeData: true,
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

describe('ResultsBody — the default-estimate disclosure is actually wired (F10)', () => {
  function renderWithDrivers(drivers: DriverItem[]) {
    const data = makeData()
    const withDrivers = {
      ...data,
      drivers: { ...data.drivers, drivers, topDrivers: drivers, totalCount: drivers.length },
    } as ResultsSectionDataReturn
    render(
      <ResultsBody
        resultsSectionData={withDrivers}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('Advanced and receipts'))
  }

  it('states the count when drivers carry defaulted confidences', () => {
    renderWithDrivers([
      makeDriver({ factorKey: 'a', matchedNodeId: 'a', isDefaultedConfidence: true }),
      makeDriver({ factorKey: 'b', matchedNodeId: 'b', isDefaultedConfidence: true }),
      makeDriver({ factorKey: 'c', matchedNodeId: 'c', isDefaultedConfidence: false }),
    ])
    expect(screen.getByText(/2 of 3 factors use default confidence values\./)).toBeInTheDocument()
  })

  it('says nothing when no driver uses a default (never "0 of 3")', () => {
    renderWithDrivers([
      makeDriver({ factorKey: 'a', matchedNodeId: 'a', isDefaultedConfidence: false }),
      makeDriver({ factorKey: 'b', matchedNodeId: 'b', isDefaultedConfidence: false }),
      makeDriver({ factorKey: 'c', matchedNodeId: 'c', isDefaultedConfidence: false }),
    ])
    expect(screen.queryByText(/default confidence values/)).not.toBeInTheDocument()
  })
})

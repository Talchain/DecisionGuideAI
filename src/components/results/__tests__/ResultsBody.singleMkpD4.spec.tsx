/**
 * ResultsBody — single MissingKnowledgePrompt invariant (Brief 5.8B D4 polish).
 *
 * `polishD4.spec.tsx` proves the *DCP-scoped* invariant — that the post-
 * analysis triage panel renders exactly one prompt and that it lives inside
 * the T1 checks footer. This spec extends that guarantee to the *whole*
 * post-analysis body: even with all the surrounding sections present
 * (DCP + Your options + Drivers accordion + Stress-test + Advanced),
 * `[data-testid="missing-knowledge-prompt"]` must remain a singleton.
 *
 * Without this guard, a future regression that re-introduces a sibling
 * MKP render anywhere in `ResultsBody` (or in any of the children it
 * composes) would silently slip through the DCP-scoped test.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
  } as OptionResult
  const runnerUp: OptionResult = {
    id: 'opt_b',
    label: 'Option B',
    expectedValue: 0.4,
    p10: 0.2,
    p90: 0.6,
    winProbability: 0.3,
    goalProbability: 0.3,
  } as OptionResult

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

describe('ResultsBody — single MissingKnowledgePrompt invariant', () => {
  it('renders exactly one MissingKnowledgePrompt in the whole post-analysis body, scoped to T1 checks footer', () => {
    render(
      <ResultsBody
        resultsSectionData={makeData()}
        tornadoData={{ rows: [], expectedOutcome: null }}
        onSendMessage={() => {}}
      />,
    )
    const prompts = screen.getAllByTestId('missing-knowledge-prompt')
    expect(prompts).toHaveLength(1)
    // And the lone prompt must live inside the T1 checks footer (which
    // lives inside the T1 decision-confidence card).
    const checksFooter = screen.getByTestId('t1-checks-footer')
    expect(within(checksFooter).getByTestId('missing-knowledge-prompt')).toBe(prompts[0])
  })
})

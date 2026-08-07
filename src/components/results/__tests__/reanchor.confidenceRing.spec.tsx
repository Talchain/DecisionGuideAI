/**
 * DecisionConfidencePanel ring re-anchoring — BEHAVIOUR CHANGE 2 of 3
 * (map row 3).
 *
 * Before: the ring was filled from the winner COMPARATIVE number and
 * captioned "win probability".
 *
 * After: it is filled from the winner GOAL number and captioned with the A
 * register; when no goal number exists it falls back to the comparative
 * number AND to the comparative caption.
 *
 * ⭐ THE RULE THIS FILE EXISTS TO ENFORCE — never relabel one quantity as
 * another. The score and its caption are ONE claim. Relabelling the caption
 * while leaving the arc filled from the old quantity is strictly worse than
 * the defect being fixed: the user would read a goal figure off a
 * comparative arc. The paired assertions below are the mutant target — the
 * lane mutation-check reverts the score move while keeping the caption and
 * requires this file to go RED.
 *
 * RED-first: every assertion below fails on `bf86f672`.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DecisionConfidencePanel } from '../DecisionConfidencePanel'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DriversSectionData,
  ImprovementsSectionData,
  DecisionResultData,
  OptionResult,
} from '../types'
import { GOAL_ANCHOR_COPY, COMPARATIVE_COPY } from '../utils/goalAnchorCopy'

interface Opts {
  goalProbability?: number | null
  winProbability?: number | null
  goalFitIsSubstitutedJoint?: boolean
}

/**
 * The winner carries a COMPARATIVE number of 70% and a GOAL number of 20%.
 * Any assertion that reads 70 off the ring is reading the old quantity.
 */
function makeData(opts: Opts = {}): ResultsSectionDataReturn {
  const winner = {
    id: 'opt-a',
    label: 'Option A',
    expectedValue: 0.8,
    p10: 0.6,
    p90: 0.95,
    winProbability: 'winProbability' in opts ? opts.winProbability : 0.7,
    goalProbability: 'goalProbability' in opts ? opts.goalProbability : 0.2,
    goalFitIsSubstitutedJoint: opts.goalFitIsSubstitutedJoint ?? false,
  } as unknown as OptionResult

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: [winner],
    goalLabel: 'Maximise success',
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.82,
    robustnessLevel: 'high',
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
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
    goalLabel: 'Maximise success',
  } as ResultsSectionDataReturn
}

describe('DecisionConfidencePanel ring — the score and its caption are ONE claim', () => {
  it('fills the ring from the GOAL number when the run carries one', () => {
    render(<DecisionConfidencePanel data={makeData()} />)
    // 20%, the goal number — not 70%, the comparative one.
    expect(screen.getByLabelText('Decision score: 20%')).toBeInTheDocument()
    expect(screen.queryByLabelText('Decision score: 70%')).not.toBeInTheDocument()
  })

  it('captions the ring with the A register, retiring "win probability"', () => {
    render(<DecisionConfidencePanel data={makeData()} />)
    expect(screen.getByText(GOAL_ANCHOR_COPY.label(false))).toBeInTheDocument()
    expect(screen.queryByText(/^win probability$/i)).not.toBeInTheDocument()
  })

  it('MUTANT TARGET — the A caption appears only alongside the A number', () => {
    render(<DecisionConfidencePanel data={makeData()} />)
    const caption = screen.getByText(GOAL_ANCHOR_COPY.label(false))
    // The caption sits directly under the ring it describes; the ring in the
    // same column must be showing the goal number. Reverting the score move
    // while keeping the caption puts 70% here and reds this assertion.
    const ringColumn = caption.parentElement
    expect(ringColumn?.textContent).toContain('20%')
    expect(ringColumn?.textContent).not.toContain('70%')
  })

  it('withholds the possessive in the caption on the substituted-joint basis', () => {
    render(<DecisionConfidencePanel data={makeData({ goalFitIsSubstitutedJoint: true })} />)
    expect(screen.getByText(GOAL_ANCHOR_COPY.label(true))).toBeInTheDocument()
    expect(screen.queryByText(GOAL_ANCHOR_COPY.label(false))).not.toBeInTheDocument()
  })
})

describe('DecisionConfidencePanel ring — the no-goal-number fallback moves BOTH', () => {
  it('falls back to the comparative number AND the comparative caption together', () => {
    render(<DecisionConfidencePanel data={makeData({ goalProbability: null })} />)
    expect(screen.getByLabelText('Decision score: 70%')).toBeInTheDocument()
    expect(screen.getByText(COMPARATIVE_COPY.label)).toBeInTheDocument()
    // The A caption must never appear over a comparative arc.
    expect(screen.queryByText(GOAL_ANCHOR_COPY.label(false))).not.toBeInTheDocument()
  })

  it('renders no ring caption at all when neither quantity exists', () => {
    render(<DecisionConfidencePanel data={makeData({ goalProbability: null, winProbability: null })} />)
    expect(screen.queryByText(GOAL_ANCHOR_COPY.label(false))).not.toBeInTheDocument()
    expect(screen.queryByText(COMPARATIVE_COPY.label)).not.toBeInTheDocument()
  })
})

/**
 * V12.4 Refix Tests — regression coverage for 6 fix tasks + code review findings.
 *
 * Task 1: Internal critique pattern filtering (AttentionBanner + ConfidenceSection)
 * Task 2: Tornado chart label truncation (already implemented — minimal verification)
 * Task 3: Evidence badge removed from "Your next steps" accordion
 * Task 4: Per-card "Wins" bars removed from OptionCards
 * Task 5: WinGauge legend removed from HeroSection
 * Task 6: Banned copy verification
 * Finding 1: ConfidenceSection worthRefining suppression with humanised exemption
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttentionBanner } from '../AttentionBanner'
import { OptionCards } from '../OptionCards'
import { HeroSection } from '../HeroSection'
import { ConfidenceSection } from '../ConfidenceSection'
import { Accordion } from '../Accordion'
import { SuccessTargetRow } from '../SuccessTargetRow'
import type { HumanisedCritique } from '../utils/humaniseCritique'
import type { OptionResult } from '../types'
import type { ConfidenceSectionData } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────

const threeOptions: OptionResult[] = [
  {
    id: 'opt-a', label: 'Option A', expected: 100,
    outcome: { mean: 100, p10: 80, p50: 100, p90: 120 },
    p10: 80, p50: 100, p90: 120,
    isRecommended: true, winProbability: 0.55, goalProbability: 0.70, rank: 1,
  },
  {
    id: 'opt-b', label: 'Option B', expected: 90,
    outcome: { mean: 90, p10: 70, p50: 90, p90: 110 },
    p10: 70, p50: 90, p90: 110,
    isRecommended: false, winProbability: 0.30, goalProbability: 0.50, rank: 2,
  },
  {
    id: 'opt-c', label: 'Option C', expected: 80,
    outcome: { mean: 80, p10: 60, p50: 80, p90: 100 },
    p10: 60, p50: 80, p90: 100,
    isRecommended: false, winProbability: 0.15, goalProbability: 0.30, rank: 3,
  },
]

const heroBase = {
  winnerLabel: 'Option A',
  winnerId: 'option-a',
  optionCount: 3,
  hasBaseline: false,
  analysisStatus: 'computed' as const,
  recommendationStability: 0.85,
  winnerWinProbability: 0.62,
  runnerUpLabel: 'Option B',
  runnerUpId: 'option-b',
  runnerUpWinProbability: 0.30,
  goalLabel: 'increase revenue',
}

const baseMockData: ConfidenceSectionData = {
  tier: { tier: 'strong' as const, icon: '✓', label: 'Good foundation', description: 'Good.' },
  qualityScore: 75,
  uncertainties: [],
  topUncertainties: [],
  improvements: [],
  topImprovements: [],
  rankingStability: 0.85,
  analysisStatus: 'computed' as const,
  robustnessStatus: 'computed' as const,
  robustnessLevel: 'high' as const,
  hiddenHighRiskCount: 0,
  evidenceGaps: [],
  topEvidenceGaps: [],
  nextActions: [],
  topNextActions: [],
  assumptions: [],
  humanisedCritiques: [],
  m2EvidenceEnhancements: null,
}

// ===========================================================================
// Task 1: Internal critique pattern filtering (AttentionBanner)
// ===========================================================================

describe('V12.4 Task 1: Internal critique filtering', () => {
  it('filters out items matching opt_[a-z_]+ pattern in displayText', () => {
    const items: HumanisedCritique[] = [
      { title: 'Check opt_revenue_growth', displayText: 'Check opt_revenue_growth', description: 'This references opt_revenue_growth internally', factorId: 'f1' },
    ]
    const { container } = render(<AttentionBanner items={items} />)
    expect(container.querySelector('[data-testid="attention-banner"]')).toBeNull()
  })

  it('filters out items matching goal_[a-z_]+ pattern in displayText', () => {
    const items: HumanisedCritique[] = [
      { title: 'Check goal_maximize_profit', displayText: 'Check goal_maximize_profit', description: 'This references goal_maximize_profit', factorId: 'f1' },
    ]
    const { container } = render(<AttentionBanner items={items} />)
    expect(container.querySelector('[data-testid="attention-banner"]')).toBeNull()
  })

  it('passes through clean text items with displayText', () => {
    const items: HumanisedCritique[] = [
      { title: 'Budget needs attention', displayText: 'Budget needs attention', description: 'Please review the budget estimate.', factorId: 'f1' },
    ]
    render(<AttentionBanner items={items} />)
    expect(screen.getByTestId('attention-banner')).toBeInTheDocument()
    expect(screen.getByText('Budget needs attention')).toBeInTheDocument()
  })

  it('filters items without displayText (V14.3 contract)', () => {
    const items: HumanisedCritique[] = [
      { title: 'Budget needs attention', displayText: null, description: 'Review the budget.', factorId: 'f1' },
    ]
    const { container } = render(<AttentionBanner items={items} />)
    expect(container.querySelector('[data-testid="attention-banner"]')).toBeNull()
  })

  it('filters items with constraint_fac_ in displayText', () => {
    const items: HumanisedCritique[] = [
      { title: 'constraint_fac_budget_max is unset', displayText: 'constraint_fac_budget_max is unset', description: 'Internal field leaked', factorId: 'f1' },
    ]
    const { container } = render(<AttentionBanner items={items} />)
    expect(container.querySelector('[data-testid="attention-banner"]')).toBeNull()
  })

  it('filters items with observed_state references in description', () => {
    const items: HumanisedCritique[] = [
      { title: 'Missing value', displayText: 'Missing value', description: 'observed_state.mu is unset for budget', factorId: 'f1' },
    ]
    const { container } = render(<AttentionBanner items={items} />)
    expect(container.querySelector('[data-testid="attention-banner"]')).toBeNull()
  })

  it('+N more path: mixed clean and internal items only shows clean count', () => {
    const items: HumanisedCritique[] = [
      { title: 'Clean item 1', displayText: 'Clean item 1', description: 'Visible', factorId: 'f1' },
      { title: 'Clean item 2', displayText: 'Clean item 2', description: 'Also visible', factorId: 'f2' },
      { title: 'Clean item 3', displayText: 'Clean item 3', description: 'Third visible', factorId: 'f3' },
      { title: 'Internal leak', displayText: 'Internal leak', description: 'constraint_fac_x is bad', factorId: 'f4' },
    ]
    render(<AttentionBanner items={items} />)
    // 3 clean items: first inline, rest collapsed as "and 2 more"
    expect(screen.getByText('and 2 more')).toBeInTheDocument()
  })
})

// ===========================================================================
// Task 3: Evidence badge removed from accordion
// ===========================================================================

describe('V12.4 Task 3: Evidence badge removed', () => {
  it('Accordion without tierLabel/tierVariant does not show evidence badge', () => {
    render(
      <Accordion title="Your next steps" testId="accordion-test" badgeCount={3} badgeVariant="warning">
        <p>Content</p>
      </Accordion>
    )
    // No evidence tier text
    expect(screen.queryByText(/Evidence:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Strong|Fair|Needs work/i)).not.toBeInTheDocument()
    // Accordion still renders
    expect(screen.getByTestId('accordion-test')).toBeInTheDocument()
  })

  it('Accordion renders badge count without tier label', () => {
    render(
      <Accordion title="Your next steps" testId="accordion-test" badgeCount={5} badgeVariant="critical">
        <p>Content</p>
      </Accordion>
    )
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})

// ===========================================================================
// Task 4: Per-card wins bars removed from OptionCards
// ===========================================================================

describe('V12.4 Task 4: Wins bars removed from OptionCards', () => {
  it('no "Wins" label in option cards', () => {
    render(
      <OptionCards
        options={threeOptions}
        winnerId="opt-a"
        decisionState="robust"
        runnerId="opt-b"
      />
    )
    expect(screen.queryByText('Wins')).not.toBeInTheDocument()
  })

  it('win percentage shown as text in header', () => {
    render(
      <OptionCards
        options={threeOptions}
        winnerId="opt-a"
        decisionState="robust"
        runnerId="opt-b"
      />
    )
    expect(screen.getByTestId('win-pct-opt-a')).toBeInTheDocument()
    expect(screen.getByTestId('win-pct-opt-b')).toBeInTheDocument()
    expect(screen.getByTestId('win-pct-opt-c')).toBeInTheDocument()
  })

  it('option names still render', () => {
    render(
      <OptionCards
        options={threeOptions}
        winnerId="opt-a"
        decisionState="robust"
        runnerId="opt-b"
      />
    )
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
    expect(screen.getByText('Option C')).toBeInTheDocument()
  })

  it('"Hits target" stat preserved when hasGoalThreshold is true', () => {
    render(
      <OptionCards
        options={threeOptions}
        winnerId="opt-a"
        decisionState="robust"
        runnerId="opt-b"
        hasGoalThreshold
      />
    )
    const hitsTargetLabels = screen.getAllByText('Hits target')
    expect(hitsTargetLabels.length).toBeGreaterThanOrEqual(1)
  })
})

// ===========================================================================
// Task 5: WinGauge legend removed
// ===========================================================================

describe('WinGauge removed from hero (moved to options section)', () => {
  it('hero does not render WinGauge bar segments', () => {
    const { container } = render(
      <HeroSection
        {...heroBase}
        decisionState="robust"
        optionWinShares={[
          { id: 'a', label: 'Option A', winProbability: 0.55, isWinner: true },
          { id: 'b', label: 'Option B', winProbability: 0.30, isWinner: false },
          { id: 'c', label: 'Option C', winProbability: 0.15, isWinner: false },
        ]}
      />
    )
    // WinGauge uses role="figure" — should not be in hero
    expect(container.querySelector('[role="figure"]')).toBeNull()
  })
})

// ===========================================================================
// Task 6: Banned copy verification
// ===========================================================================

describe('V12.4 Task 6: Banned copy removed', () => {
  it('HeroSection does not contain "outperforms alternatives"', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="robust"
      />
    )
    expect(screen.queryByText(/outperforms alternatives/i)).not.toBeInTheDocument()
  })

  it('SuccessTargetRow does not contain "Run analysis again to compute"', () => {
    render(<SuccessTargetRow goalThreshold={null} />)
    expect(screen.queryByText(/Run analysis again to compute/i)).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Finding 1: ConfidenceSection worthRefining suppression
// ===========================================================================

describe('V12.4 Finding 1: ConfidenceSection internal-leak suppression', () => {
  it('suppresses genericized cards for internal-leak messages without humanised versions', () => {
    const data: ConfidenceSectionData = {
      ...baseMockData,
      uncertainties: [
        {
          code: 'BRAND_NEW_CODE',
          message: 'constraint_fac_churn_max observed_state.value intercept=0',
          affectedNodes: ['fac_churn'],
          severity: 'warning',
        },
      ],
      topUncertainties: [],
      // No humanisedCritiques provided — should suppress entirely
      humanisedCritiques: [],
    }

    render(<ConfidenceSection data={data} />)

    // The generic fallback text should NOT appear
    expect(screen.queryByText(/Check and update this factor/)).not.toBeInTheDocument()
    // The raw internal text should also not appear
    expect(screen.queryByText(/constraint_fac_churn/)).not.toBeInTheDocument()
  })

  it('keeps constraint items that have humanised versions', () => {
    const data: ConfidenceSectionData = {
      ...baseMockData,
      uncertainties: [
        {
          code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
          message: 'observed_state.value is missing for constraint_fac_budget_max',
          affectedNodes: ['fac_budget'],
          severity: 'warning',
        },
      ],
      topUncertainties: [],
      humanisedCritiques: [
        {
          title: 'Budget has no estimate set',
          description: 'Results may be unreliable without a current value for this constraint.',
          suggestion: 'Set estimate',
          factorId: 'fac_budget',
        },
      ],
    }

    render(<ConfidenceSection data={data} />)

    // Humanised title should render
    expect(screen.getByText('Budget has no estimate set')).toBeInTheDocument()
    // Raw internal strings should NOT appear
    expect(screen.queryByText(/observed_state/)).not.toBeInTheDocument()
    expect(screen.queryByText(/constraint_fac_/)).not.toBeInTheDocument()
  })
})

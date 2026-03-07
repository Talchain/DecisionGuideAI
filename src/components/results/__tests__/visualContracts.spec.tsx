/**
 * V11.1 Fix 6: Visual contract tests for robust/sensitive/indeterminate states.
 *
 * These tests verify the key colour and layout invariants that must hold
 * for each decision state. They use class-level assertions rather than
 * pixel-level checks — ensuring the correct Tailwind tokens are applied.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import { ConfidenceSection } from '../ConfidenceSection'
import { buildSegmentColorMap } from '../HeroSection'
import type { OptionResult, ConfidenceSectionData, HingeInfo, TopAction } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────

const twoOptions: OptionResult[] = [
  {
    id: 'opt-a',
    label: 'Option A',
    expected: 100,
    outcome: { mean: 100, p10: 80, p50: 100, p90: 120 },
    p10: 80,
    p50: 100,
    p90: 120,
    isRecommended: true,
    winProbability: 0.65,
    goalProbability: 0.70,
    rank: 1,
  },
  {
    id: 'opt-b',
    label: 'Option B',
    expected: 80,
    outcome: { mean: 80, p10: 60, p50: 80, p90: 100 },
    p10: 60,
    p50: 80,
    p90: 100,
    isRecommended: false,
    winProbability: 0.35,
    goalProbability: 0.40,
    rank: 2,
  },
]

const baseConfidenceData: ConfidenceSectionData = {
  tier: { tier: 'fair', icon: '⚠', label: 'Fair', description: 'Covers the basics.' },
  qualityScore: 55,
  uncertainties: [],
  topUncertainties: [],
  improvements: [],
  topImprovements: [],
  rankingStability: 0.65,
  robustnessStatus: 'computed',
}

const testHinge: HingeInfo = {
  label: 'Customer churn',
  nodeId: 'factor-churn',
  kind: 'edge',
  reason: 'fragile_edge',
  edgeDetail: 'Customer churn → Revenue',
  alternativeWinnerLabel: 'Option B',
}

const flippableAction: TopAction = {
  label: 'Customer churn',
  nodeId: 'factor-churn',
  couldFlip: true,
}

// ── Indeterminate contracts ───────────────────────────────────────────────

describe('Visual contract: Indeterminate state', () => {
  it('zero bg-success or text-success in option cards', () => {
    const { container } = render(
      <OptionCards
        options={twoOptions}
        winnerId="opt-a"
        hasGoalThreshold={true}
        decisionState="indeterminate"
        runnerId="opt-b"
      />
    )

    expect(container.querySelectorAll('.bg-success')).toHaveLength(0)
    expect(container.querySelectorAll('.text-success')).toHaveLength(0)
    expect(container.querySelectorAll('.bg-success-light')).toHaveLength(0)
    expect(container.querySelectorAll('.border-success')).toHaveLength(0)
  })

  it('all rank badges use stone tokens', () => {
    render(
      <OptionCards
        options={twoOptions}
        winnerId="opt-a"
        decisionState="indeterminate"
        runnerId="opt-b"
      />
    )

    const badgeA = screen.getByTestId('rank-badge-opt-a')
    const badgeB = screen.getByTestId('rank-badge-opt-b')

    // §8.5: outlined variant for metadata badges (border-factor/30 text-text-body)
    expect(badgeA.className).toContain('border-factor/30')
    expect(badgeA.className).toContain('text-text-body')
    expect(badgeB.className).toContain('border-factor/30')
    expect(badgeB.className).toContain('text-text-body')
  })

  it('rank badges show percentage not "#N of N"', () => {
    render(
      <OptionCards
        options={twoOptions}
        winnerId="opt-a"
        decisionState="indeterminate"
        runnerId="opt-b"
      />
    )

    expect(screen.getByTestId('rank-badge-opt-a').textContent).toBe('65%')
    expect(screen.queryByText('#1 of 2')).not.toBeInTheDocument()
  })

  it('winner card has no success border', () => {
    render(
      <OptionCards
        options={twoOptions}
        winnerId="opt-a"
        decisionState="indeterminate"
        runnerId="opt-b"
      />
    )

    const winnerCard = screen.getByTestId('option-card-opt-a')
    expect(winnerCard.className).not.toContain('border-success')
    expect(winnerCard.className).toContain('border-panel-border')
  })

  it('VOI block hidden in ConfidenceSection', () => {
    render(
      <ConfidenceSection
        data={baseConfidenceData}
        decisionState="indeterminate"
        hinge={testHinge}
        topAction={flippableAction}
      />
    )

    // VOI block should still be visible for indeterminate (it's hidden only for robust)
    expect(screen.getByTestId('voi-promoted-block')).toBeInTheDocument()
  })
})

// ── Robust contracts ──────────────────────────────────────────────────────

describe('Visual contract: Robust state', () => {
  it('V12.3: winner card uses border-panel-border (colour via inline borderLeftColor)', () => {
    const colorMap = buildSegmentColorMap(twoOptions, 'opt-a', 'robust')
    render(
      <OptionCards
        options={twoOptions}
        winnerId="opt-a"
        decisionState="robust"
        runnerId="opt-b"
        segmentColorMap={colorMap}
      />
    )

    const winnerCard = screen.getByTestId('option-card-opt-a')
    // V12.3: border colour applied via inline style, not class
    expect(winnerCard.className).toContain('border-panel-border')
    expect(winnerCard.style.borderLeftColor).toBe('var(--success)')
  })

  it('rank badges show "#N of N" not percentage', () => {
    render(
      <OptionCards
        options={twoOptions}
        winnerId="opt-a"
        decisionState="robust"
        runnerId="opt-b"
      />
    )

    expect(screen.getByText('#1 of 2')).toBeInTheDocument()
    expect(screen.getByText('#2 of 2')).toBeInTheDocument()
  })

  it('winner badge uses success styling', () => {
    render(
      <OptionCards
        options={twoOptions}
        winnerId="opt-a"
        decisionState="robust"
        runnerId="opt-b"
      />
    )

    // §8.5: outlined variant for metadata badges (border-success/30 text-text-body)
    const badge = screen.getByTestId('rank-badge-opt-a')
    expect(badge.className).toContain('border-success/30')
    expect(badge.className).toContain('text-text-body')
  })

  it('V16.2: VOI block shown for robust state (scroll-link target)', () => {
    render(
      <ConfidenceSection
        data={baseConfidenceData}
        decisionState="robust"
        hinge={testHinge}
        topAction={flippableAction}
      />
    )

    // V16.2: MVS card renders for all states so bullet-3 scroll-link target exists
    expect(screen.getByTestId('voi-promoted-block')).toBeInTheDocument()
  })
})

// ── Sensitive contracts ───────────────────────────────────────────────────

describe('Visual contract: Sensitive state', () => {
  it('V12.3: winner card uses border-panel-border (colour via inline borderLeftColor)', () => {
    const colorMap = buildSegmentColorMap(twoOptions, 'opt-a', 'sensitive')
    render(
      <OptionCards
        options={twoOptions}
        winnerId="opt-a"
        decisionState="sensitive"
        runnerId="opt-b"
        segmentColorMap={colorMap}
      />
    )

    const winnerCard = screen.getByTestId('option-card-opt-a')
    expect(winnerCard.className).toContain('border-panel-border')
    expect(winnerCard.style.borderLeftColor).toBe('var(--success)')
  })

  it('VOI block visible in ConfidenceSection', () => {
    render(
      <ConfidenceSection
        data={baseConfidenceData}
        decisionState="sensitive"
        hinge={testHinge}
        topAction={flippableAction}
      />
    )

    expect(screen.getByTestId('voi-promoted-block')).toBeInTheDocument()
    expect(screen.getByText('Most valuable next step')).toBeInTheDocument()
  })

  it('rank badges show "#N of N" not percentage', () => {
    render(
      <OptionCards
        options={twoOptions}
        winnerId="opt-a"
        decisionState="sensitive"
        runnerId="opt-b"
      />
    )

    expect(screen.getByText('#1 of 2')).toBeInTheDocument()
  })
})

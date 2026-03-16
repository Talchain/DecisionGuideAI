/**
 * HeroSection — A3 Goal-achievement probability display tests
 *
 * Uses golden fixture data from resultsPanelV7.rich.hook.ts
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroSection, type HeroSectionProps, type OptionGoalProbability } from '../HeroSection'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusByTarget: vi.fn(),
  focusNodeById: vi.fn(),
  focusEdgeByEndpoints: vi.fn(),
}))

vi.mock('../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))

const baseProps: HeroSectionProps = {
  winnerLabel: 'Build in-house',
  winnerId: 'opt-build',
  optionCount: 3,
  hasBaseline: false,
  analysisStatus: 'computed',
  goalLabel: 'Annual recurring revenue',
  goalThreshold: 800000,
  outcomeUnit: 'currency',
  outcomeUnitSymbol: '$',
}

// Golden fixture data from resultsPanelV7.rich.hook.ts
const richGoalProbabilities: OptionGoalProbability[] = [
  { id: 'opt-build', label: 'Build in-house', goalProbability: 0.64 },
  { id: 'opt-outsource', label: 'Outsource', goalProbability: 0.31 },
  { id: 'opt-hybrid', label: 'Hybrid approach', goalProbability: 0.18 },
]

describe('HeroSection — Goal-achievement probability (A3)', () => {
  it('renders goal probability for all options when data is present', () => {
    render(
      <HeroSection
        {...baseProps}
        winnerGoalProbability={0.64}
        allOptionGoalProbabilities={richGoalProbabilities}
      />
    )

    const display = screen.getByTestId('goal-probability-display')
    expect(display).toBeInTheDocument()

    // All three options should be shown
    expect(display.textContent).toContain('Build in-house')
    expect(display.textContent).toContain('Outsource')
    expect(display.textContent).toContain('Hybrid approach')
  })

  it('displays percentages as integers without decimals', () => {
    render(
      <HeroSection
        {...baseProps}
        winnerGoalProbability={0.64}
        allOptionGoalProbabilities={richGoalProbabilities}
      />
    )

    const display = screen.getByTestId('goal-probability-display')
    // 0.64 → 64%, 0.31 → 31%, 0.18 → 18% — no decimals
    expect(display.textContent).toContain('64%')
    expect(display.textContent).toContain('31%')
    expect(display.textContent).toContain('18%')
    // No decimal points in the percentage values
    expect(display.textContent).not.toMatch(/\d+\.\d+%/)
  })

  it('renders nothing when allOptionGoalProbabilities is absent', () => {
    render(
      <HeroSection
        {...baseProps}
        winnerGoalProbability={null}
        allOptionGoalProbabilities={undefined}
      />
    )

    expect(screen.queryByTestId('goal-probability-display')).not.toBeInTheDocument()
  })

  it('renders nothing when goalThreshold is null', () => {
    render(
      <HeroSection
        {...baseProps}
        goalThreshold={null}
        winnerGoalProbability={0.64}
        allOptionGoalProbabilities={richGoalProbabilities}
      />
    )

    expect(screen.queryByTestId('goal-probability-display')).not.toBeInTheDocument()
  })

  it('renders nothing when allOptionGoalProbabilities is empty array', () => {
    render(
      <HeroSection
        {...baseProps}
        winnerGoalProbability={0.64}
        allOptionGoalProbabilities={[]}
      />
    )

    expect(screen.queryByTestId('goal-probability-display')).not.toBeInTheDocument()
  })

  it('falls back to winner-only display when allOptionGoalProbabilities not provided but winnerGoalProbability is', () => {
    render(
      <HeroSection
        {...baseProps}
        winnerGoalProbability={0.72}
      />
    )

    // Should show fallback text with winner only
    expect(screen.getByText(/Build in-house has a 72%/)).toBeInTheDocument()
  })
})

/**
 * V12.3 Tests — Hero Section + Option Cards visual changes.
 *
 * Task 1: Evidence badge removed from hero (kept in actions section)
 * Task 2: "Action" label on hinge row with bullet separator
 * Task 3: Option card left border + bar fill match wins bar segment colours
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  HeroSection,
  WIN_GAUGE_COLORS,
  WIN_GAUGE_COLORS_INDETERMINATE,
  buildSegmentColorMap,
} from '../HeroSection'
import { OptionCards } from '../OptionCards'
import type { HeroSectionProps } from '../HeroSection'
import type { OptionResult } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusByTarget: vi.fn(),
  focusNodeById: vi.fn(),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────

const heroBase: HeroSectionProps = {
  winnerLabel: 'Option A',
  winnerId: 'option-a',
  optionCount: 3,
  hasBaseline: false,
  analysisStatus: 'computed',
  recommendationStability: 0.85,
  winnerWinProbability: 0.62,
  runnerUpLabel: 'Option B',
  runnerUpId: 'option-b',
  runnerUpWinProbability: 0.30,
  goalLabel: 'increase revenue',
}

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

const fourOptions: OptionResult[] = [
  ...threeOptions,
  {
    id: 'opt-d', label: 'Option D', expected: 70,
    outcome: { mean: 70, p10: 50, p50: 70, p90: 90 },
    p10: 50, p50: 70, p90: 90,
    isRecommended: false, winProbability: 0.05, goalProbability: 0.10, rank: 4,
  },
]

// ===========================================================================
// Task 1: Evidence badge removed from hero
// ===========================================================================

describe('V12.3 Task 1: Evidence badge removed from hero', () => {
  it.each(['robust', 'sensitive', 'indeterminate'] as const)(
    'does NOT render evidence badge in hero for decisionState="%s"',
    (state) => {
      render(
        <HeroSection
          {...heroBase}
          decisionState={state}
        />
      )
      expect(screen.queryByTestId('evidence-badge')).not.toBeInTheDocument()
    },
  )

  it('meta strip still renders target when goalThreshold is set', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="robust"
        goalThreshold={500}
      />
    )
    const strip = screen.getByTestId('meta-strip')
    expect(strip).toHaveTextContent('Target:')
    expect(strip).toHaveTextContent('500')
    expect(screen.queryByTestId('evidence-badge')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Task 2: "Action" label with bullet separator
// ===========================================================================

describe('V12.3 Task 2: Action label with bullet separator', () => {
  it('robust + hinge: shows "Action • Validate: {link}"', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="robust"
        hinge={{
          label: 'Market Size',
          nodeId: 'factor-1',
          kind: 'edge',
          reason: 'fragile_edge',
          edgeDetail: 'Market Size → Revenue',
          alternativeWinnerLabel: null,
        }}
      />
    )

    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText(/Validate:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Focus on Market Size/ })).toBeInTheDocument()
    // Bullet separator present
    expect(screen.getByText('•')).toBeInTheDocument()
  })

  it('robust + no hinge: Action row is absent', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="robust"
        hinge={null}
      />
    )

    expect(screen.queryByText('Action')).not.toBeInTheDocument()
  })

  it('sensitive + hinge: shows "Action • Validate first: {link}"', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="sensitive"
        hinge={{
          label: 'Customer Churn',
          nodeId: 'factor-2',
          kind: 'node',
          reason: 'voi',
          edgeDetail: null,
          alternativeWinnerLabel: null,
        }}
      />
    )

    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText(/Validate first:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Focus on Customer Churn/ })).toBeInTheDocument()
  })

  it('sensitive + no hinge: shows "Action" with fallback text', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="sensitive"
        hinge={null}
      />
    )

    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText(/Review key assumptions before committing/)).toBeInTheDocument()
  })

  it('indeterminate + hinge: shows "Action • Resolve first: {link}"', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="indeterminate"
        hinge={{
          label: 'Adoption Rate',
          nodeId: 'factor-3',
          kind: 'edge',
          reason: 'fragile_edge',
          edgeDetail: 'Adoption Rate → Market Share',
          alternativeWinnerLabel: 'Option B',
        }}
      />
    )

    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText(/Resolve first:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Focus on Adoption Rate/ })).toBeInTheDocument()
  })

  it('indeterminate + no hinge: shows "Action" with fallback text', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="indeterminate"
        hinge={null}
      />
    )

    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText(/Review key assumptions to distinguish/)).toBeInTheDocument()
  })

  it('Action label aligns at same width as Goal and Leads', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="sensitive"
        hinge={{
          label: 'X',
          nodeId: 'f-x',
          kind: 'node',
          reason: 'voi',
          edgeDetail: null,
          alternativeWinnerLabel: null,
        }}
      />
    )

    const heroRows = screen.getByTestId('hero-rows')
    const dtElements = heroRows.querySelectorAll('dt')
    // All <dt> elements should share the w-24 class for alignment
    dtElements.forEach((dt) => {
      expect(dt.className).toContain('w-24')
    })
  })
})

// ===========================================================================
// Task 3: Option card left border + bar fill colours
// ===========================================================================

describe('V12.3 Task 3: Option card border colours match wins bar segments', () => {
  describe('Colour palette exports', () => {
    it('WIN_GAUGE_COLORS has 4 entries: success, info, option, border-default', () => {
      expect(WIN_GAUGE_COLORS).toEqual([
        'var(--success)',
        'var(--info)',
        'var(--option)',
        'var(--border-default)',
      ])
    })

    it('WIN_GAUGE_COLORS_INDETERMINATE has 4 entries: info, info-light, border-default ×2', () => {
      expect(WIN_GAUGE_COLORS_INDETERMINATE).toEqual([
        'var(--info)',
        'var(--info-light)',
        'var(--border-default)',
        'var(--border-default)',
      ])
    })
  })

  describe('buildSegmentColorMap', () => {
    it('maps winner to first colour, then by winProbability descending', () => {
      const map = buildSegmentColorMap(threeOptions, 'opt-a', 'robust')
      expect(map['opt-a']).toBe('var(--success)')
      expect(map['opt-b']).toBe('var(--info)')
      expect(map['opt-c']).toBe('var(--option)')
    })

    it('uses indeterminate palette when decisionState is indeterminate', () => {
      const map = buildSegmentColorMap(threeOptions, 'opt-a', 'indeterminate')
      expect(map['opt-a']).toBe('var(--info)')
      expect(map['opt-b']).toBe('var(--info-light)')
      expect(map['opt-c']).toBe('var(--border-default)')
    })

    it('handles 4 options with fallback to last palette entry', () => {
      const map = buildSegmentColorMap(fourOptions, 'opt-a', 'robust')
      expect(map['opt-a']).toBe('var(--success)')
      expect(map['opt-b']).toBe('var(--info)')
      expect(map['opt-c']).toBe('var(--option)')
      expect(map['opt-d']).toBe('var(--border-default)')
    })

    it('handles >4 options — 5th+ clamps to last palette entry', () => {
      const fiveOptions = [
        ...fourOptions,
        { id: 'opt-e', winProbability: 0.02 },
      ]
      const map = buildSegmentColorMap(fiveOptions, 'opt-a', 'robust')
      expect(map['opt-e']).toBe('var(--border-default)')
    })

    it('correctly assigns when rank order differs from winProbability order', () => {
      // opt-b has higher winProbability than opt-c, but higher rank number
      const mismatched: Array<{ id: string; winProbability: number }> = [
        { id: 'x-winner', winProbability: 0.50 },
        { id: 'x-rank2', winProbability: 0.10 },  // lower win prob
        { id: 'x-rank3', winProbability: 0.40 },   // higher win prob
      ]
      const map = buildSegmentColorMap(mismatched, 'x-winner', 'robust')
      // Winner always first
      expect(map['x-winner']).toBe('var(--success)')
      // x-rank3 has higher winProbability so gets second slot
      expect(map['x-rank3']).toBe('var(--info)')
      // x-rank2 has lower winProbability so gets third slot
      expect(map['x-rank2']).toBe('var(--option)')
    })
  })

  describe('Sensitive/Robust cards — left border colours', () => {
    it('winner gets success left border, runner-up gets info, third gets option', () => {
      const colorMap = buildSegmentColorMap(threeOptions, 'opt-a', 'sensitive')
      render(
        <OptionCards
          options={threeOptions}
          winnerId="opt-a"
          decisionState="sensitive"
          runnerId="opt-b"
          segmentColorMap={colorMap}
        />
      )

      // ID-based assertions: resilient to card sort order changes
      const winner = screen.getByTestId('option-card-opt-a')
      expect(winner.style.borderLeftColor).toBe('var(--success)')
      expect(winner.style.borderLeftWidth).toBe('3px')
      const runner = screen.getByTestId('option-card-opt-b')
      expect(runner.style.borderLeftColor).toBe('var(--info)')
      const third = screen.getByTestId('option-card-opt-c')
      expect(third.style.borderLeftColor).toBe('var(--option)')
    })
  })

  describe('Indeterminate cards — left border colours', () => {
    it('top gets info, second gets info-light, third gets border-default', () => {
      const colorMap = buildSegmentColorMap(threeOptions, 'opt-a', 'indeterminate')
      render(
        <OptionCards
          options={threeOptions}
          winnerId="opt-a"
          decisionState="indeterminate"
          runnerId="opt-b"
          segmentColorMap={colorMap}
        />
      )

      expect(screen.getByTestId('option-card-opt-a').style.borderLeftColor).toBe('var(--info)')
      expect(screen.getByTestId('option-card-opt-b').style.borderLeftColor).toBe('var(--info-light)')
      expect(screen.getByTestId('option-card-opt-c').style.borderLeftColor).toBe('var(--border-default)')
    })
  })

  describe('4-option colour mapping', () => {
    it('robust: 4th option gets border-default', () => {
      const colorMap = buildSegmentColorMap(fourOptions, 'opt-a', 'robust')
      render(
        <OptionCards
          options={fourOptions}
          winnerId="opt-a"
          decisionState="robust"
          runnerId="opt-b"
          segmentColorMap={colorMap}
        />
      )

      expect(screen.getByTestId('option-card-opt-a').style.borderLeftColor).toBe('var(--success)')
      expect(screen.getByTestId('option-card-opt-b').style.borderLeftColor).toBe('var(--info)')
      expect(screen.getByTestId('option-card-opt-c').style.borderLeftColor).toBe('var(--option)')
      expect(screen.getByTestId('option-card-opt-d').style.borderLeftColor).toBe('var(--border-default)')
    })

    it('indeterminate: 3rd and 4th options both get border-default', () => {
      const colorMap = buildSegmentColorMap(fourOptions, 'opt-a', 'indeterminate')
      render(
        <OptionCards
          options={fourOptions}
          winnerId="opt-a"
          decisionState="indeterminate"
          runnerId="opt-b"
          segmentColorMap={colorMap}
        />
      )

      expect(screen.getByTestId('option-card-opt-a').style.borderLeftColor).toBe('var(--info)')
      expect(screen.getByTestId('option-card-opt-b').style.borderLeftColor).toBe('var(--info-light)')
      expect(screen.getByTestId('option-card-opt-c').style.borderLeftColor).toBe('var(--border-default)')
      expect(screen.getByTestId('option-card-opt-d').style.borderLeftColor).toBe('var(--border-default)')
    })
  })

  describe('V12.4: Per-card wins bars removed', () => {
    it('no per-card wins bar fill — win percentage as text only', () => {
      const colorMap = buildSegmentColorMap(threeOptions, 'opt-a', 'robust')
      render(
        <OptionCards
          options={threeOptions}
          winnerId="opt-a"
          decisionState="robust"
          runnerId="opt-b"
          segmentColorMap={colorMap}
        />
      )

      // "Wins" label no longer rendered (bars removed)
      expect(screen.queryByText('Wins')).not.toBeInTheDocument()
      // Win percentage still shown as text
      expect(screen.getByTestId('win-pct-opt-a')).toBeInTheDocument()
    })
  })

  describe('No segmentColorMap prop', () => {
    it('cards render without left border when segmentColorMap is omitted', () => {
      const { container } = render(
        <OptionCards
          options={threeOptions}
          winnerId="opt-a"
          decisionState="robust"
          runnerId="opt-b"
        />
      )

      const cards = container.querySelectorAll('[data-option-id]')
      // No inline borderLeftColor
      expect((cards[0] as HTMLElement).style.borderLeftColor).toBe('')
    })
  })

  describe('All cards use border-panel-border class', () => {
    it('winner and non-winner both have border-panel-border', () => {
      const colorMap = buildSegmentColorMap(threeOptions, 'opt-a', 'robust')
      render(
        <OptionCards
          options={threeOptions}
          winnerId="opt-a"
          decisionState="robust"
          runnerId="opt-b"
          segmentColorMap={colorMap}
        />
      )

      const winnerCard = screen.getByTestId('option-card-opt-a')
      const otherCard = screen.getByTestId('option-card-opt-b')
      expect(winnerCard.className).toContain('border-panel-border')
      expect(otherCard.className).toContain('border-panel-border')
      // No border-success class on any card
      expect(winnerCard.className).not.toContain('border-success')
    })
  })
})

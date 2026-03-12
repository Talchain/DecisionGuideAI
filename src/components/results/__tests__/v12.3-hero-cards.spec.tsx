/**
 * V12.3 Tests — Hero Section + Option Cards visual changes.
 *
 * Task 1: Evidence badge removed from hero (kept in actions section)
 * Task 2: "Action" label on hinge row with bullet separator
 * Task 3: Option card left border + bar fill match wins bar segment colours
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

  it('V14: baseline-target-row renders target when goalThreshold is set', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="robust"
        goalThreshold={500}
      />
    )
    const row = screen.getByTestId('baseline-target-row')
    expect(row).toHaveTextContent('Target:')
    expect(row).toHaveTextContent('500')
    expect(screen.queryByTestId('evidence-badge')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Task 2: "Action" label with bullet separator
// ===========================================================================

describe('V16: Next action in insight bullets (replaces coaching-next-action)', () => {
  it('robust + topNextAction: shows action in insight-bullets with link', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="robust"
        topNextAction={{
          action: 'Validate Market Size before deciding.',
          rationale: 'Fragile edge',
          priority: 1,
          targetType: 'factor',
          targetId: 'factor-1',
          targetLabel: 'Market Size',
        }}
      />
    )

    const bullets = screen.getByTestId('insight-bullets')
    expect(bullets.textContent).toContain('Market Size')
    expect(screen.getByRole('button', { name: /Focus on Market Size/ })).toBeInTheDocument()
    expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
  })

  it('robust + no topNextAction: no insight-bullets', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="robust"
      />
    )

    expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
  })

  it('sensitive + topNextAction: shows action in insight-bullets with link', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="sensitive"
        topNextAction={{
          action: 'Review Customer Churn estimates carefully.',
          rationale: 'VOI factor',
          priority: 1,
          targetType: 'factor',
          targetId: 'factor-2',
          targetLabel: 'Customer Churn',
        }}
      />
    )

    const bullets = screen.getByTestId('insight-bullets')
    expect(bullets.textContent).toContain('Customer Churn')
    expect(screen.getByRole('button', { name: /Focus on Customer Churn/ })).toBeInTheDocument()
    expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
  })

  it('sensitive + no topNextAction: no insight-bullets', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="sensitive"
      />
    )

    expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
  })

  it('indeterminate + topNextAction: shows action in insight-bullets with link', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="indeterminate"
        topNextAction={{
          action: 'Resolve Adoption Rate uncertainty before deciding.',
          rationale: 'Fragile edge',
          priority: 1,
          targetType: 'factor',
          targetId: 'factor-3',
          targetLabel: 'Adoption Rate',
        }}
      />
    )

    const bullets = screen.getByTestId('insight-bullets')
    expect(bullets.textContent).toContain('Adoption Rate')
    expect(screen.getByRole('button', { name: /Focus on Adoption Rate/ })).toBeInTheDocument()
    expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
  })

  it('indeterminate + no topNextAction: no insight-bullets', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="indeterminate"
      />
    )

    expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
    expect(screen.queryByTestId('insight-bullets')).not.toBeInTheDocument()
  })

  it('V16: hero section uses <ul>/<li> for insight bullets, no standalone action element', () => {
    render(
      <HeroSection
        {...heroBase}
        decisionState="sensitive"
        topNextAction={{
          action: 'Check X carefully.',
          rationale: 'VOI',
          priority: 1,
          targetType: 'factor',
          targetId: 'f-x',
          targetLabel: 'X',
        }}
      />
    )

    screen.getByTestId('hero-section')
    // V16: action is a <li> in insight-bullets, not a standalone coaching-next-action div
    const bullets = screen.getByTestId('insight-bullets')
    const liElements = bullets.querySelectorAll('li')
    expect(liElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.queryByTestId('coaching-next-action')).not.toBeInTheDocument()
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

  describe('Sensitive and robust cards use full borders', () => {
    it('winner gets success full border, others keep neutral borders', () => {
      render(
        <OptionCards
          options={threeOptions}
          winnerId="opt-a"
          decisionState="sensitive"
          runnerId="opt-b"
        />
      )

      const winner = screen.getByTestId('option-card-opt-a')
      expect(winner.className).toContain('border-success/30')
      // Runner-up and third get their ordinal chart colour borders
      const runner = screen.getByTestId('option-card-opt-b')
      expect(runner.className).toContain('border-info/30')
      const third = screen.getByTestId('option-card-opt-c')
      expect(third.className).toContain('border-option/30')
    })
  })

  describe('Indeterminate cards keep neutral borders', () => {
    it('all cards use neutral full borders', () => {
      render(
        <OptionCards
          options={threeOptions}
          winnerId="opt-a"
          decisionState="indeterminate"
          runnerId="opt-b"
        />
      )

      expect(screen.getByTestId('option-card-opt-a').className).toContain('border-panel-border')
      expect(screen.getByTestId('option-card-opt-b').className).toContain('border-panel-border')
      expect(screen.getByTestId('option-card-opt-c').className).toContain('border-panel-border')
    })
  })

  describe('4-option colour mapping', () => {
    it('robust: lower-ranked options keep neutral borders', () => {
      render(
        <OptionCards
          options={fourOptions}
          winnerId="opt-a"
          decisionState="robust"
          runnerId="opt-b"
        />
      )

      // Top 2 visible by default; expand to see all 4
      fireEvent.click(screen.getByTestId('option-cards-toggle'))

      // Ordinal borders: winner=success/30, runner-up=info/30, third=option/30, fourth+=panel-border
      expect(screen.getByTestId('option-card-opt-a').className).toContain('border-success/30')
      expect(screen.getByTestId('option-card-opt-b').className).toContain('border-info/30')
      expect(screen.getByTestId('option-card-opt-c').className).toContain('border-option/30')
      expect(screen.getByTestId('option-card-opt-d').className).toContain('border-panel-border')
    })

    it('indeterminate: all options keep neutral full borders', () => {
      render(
        <OptionCards
          options={fourOptions}
          winnerId="opt-a"
          decisionState="indeterminate"
          runnerId="opt-b"
        />
      )

      // Top 2 visible by default; expand to see all 4
      fireEvent.click(screen.getByTestId('option-cards-toggle'))

      expect(screen.getByTestId('option-card-opt-a').className).toContain('border-panel-border')
      expect(screen.getByTestId('option-card-opt-b').className).toContain('border-panel-border')
      expect(screen.getByTestId('option-card-opt-c').className).toContain('border-panel-border')
      expect(screen.getByTestId('option-card-opt-d').className).toContain('border-panel-border')
    })
  })

  describe('V12.4: Per-card wins bars removed', () => {
    it('no per-card wins bar fill, win percentage as text only', () => {
      render(
        <OptionCards
          options={threeOptions}
          winnerId="opt-a"
          decisionState="robust"
          runnerId="opt-b"
        />
      )

      // "Wins" label no longer rendered (bars removed)
      expect(screen.queryByText('Wins')).not.toBeInTheDocument()
      // Win percentage still shown as text
      expect(screen.getByTestId('win-pct-opt-a')).toBeInTheDocument()
    })
  })

  describe('Cards without segment colour props', () => {
    it('cards render without inline left-border styles', () => {
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

  describe('All cards keep bordered card styling', () => {
    it('winner and non-winner remain bordered cards', () => {
      render(
        <OptionCards
          options={threeOptions}
          winnerId="opt-a"
          decisionState="robust"
          runnerId="opt-b"
        />
      )

      const winnerCard = screen.getByTestId('option-card-opt-a')
      const otherCard = screen.getByTestId('option-card-opt-b')
      expect(winnerCard.className).toContain('border-success/30')
      // Runner-up gets its ordinal chart colour border (info = second position)
      expect(otherCard.className).toContain('border-info/30')
    })
  })
})

// ===========================================================================
// P1-10: OptionCards truncation UX (V16.1)
// ===========================================================================

describe('V16.1 P1-10: OptionCards truncation UX', () => {
  it('shows only top 2 cards when 4 options are provided', () => {
    render(<OptionCards options={fourOptions} winnerId="opt-a" />)

    expect(screen.getByTestId('option-card-opt-a')).toBeInTheDocument()
    expect(screen.getByTestId('option-card-opt-b')).toBeInTheDocument()
    expect(screen.queryByTestId('option-card-opt-c')).not.toBeInTheDocument()
    expect(screen.queryByTestId('option-card-opt-d')).not.toBeInTheDocument()
  })

  it('toggle button reads "Show all (2 more)" when collapsed', () => {
    render(<OptionCards options={fourOptions} winnerId="opt-a" />)

    expect(screen.getByTestId('option-cards-toggle').textContent).toBe('Show all (2 more)')
  })

  it('clicking toggle shows all 4 cards', () => {
    render(<OptionCards options={fourOptions} winnerId="opt-a" />)

    fireEvent.click(screen.getByTestId('option-cards-toggle'))

    expect(screen.getByTestId('option-card-opt-a')).toBeInTheDocument()
    expect(screen.getByTestId('option-card-opt-b')).toBeInTheDocument()
    expect(screen.getByTestId('option-card-opt-c')).toBeInTheDocument()
    expect(screen.getByTestId('option-card-opt-d')).toBeInTheDocument()
  })

  it('toggle button reads "Show fewer" when expanded', () => {
    render(<OptionCards options={fourOptions} winnerId="opt-a" />)

    fireEvent.click(screen.getByTestId('option-cards-toggle'))
    expect(screen.getByTestId('option-cards-toggle').textContent).toBe('Show fewer')
  })

  it('clicking toggle again collapses back to top 2', () => {
    render(<OptionCards options={fourOptions} winnerId="opt-a" />)

    fireEvent.click(screen.getByTestId('option-cards-toggle'))
    fireEvent.click(screen.getByTestId('option-cards-toggle'))

    expect(screen.queryByTestId('option-card-opt-c')).not.toBeInTheDocument()
    expect(screen.queryByTestId('option-card-opt-d')).not.toBeInTheDocument()
  })

  it('rank badge is globally consistent — opt-a=1, opt-b=2 in both collapsed and expanded', () => {
    render(<OptionCards options={fourOptions} winnerId="opt-a" />)

    // Collapsed: top 2 visible
    expect(screen.getByTestId('rank-badge-opt-a').textContent).toBe('#1 of 4')
    expect(screen.getByTestId('rank-badge-opt-b').textContent).toBe('#2 of 4')

    // Expanded: ranks unchanged
    fireEvent.click(screen.getByTestId('option-cards-toggle'))
    expect(screen.getByTestId('rank-badge-opt-a').textContent).toBe('#1 of 4')
    expect(screen.getByTestId('rank-badge-opt-b').textContent).toBe('#2 of 4')
    expect(screen.getByTestId('rank-badge-opt-c').textContent).toBe('#3 of 4')
    expect(screen.getByTestId('rank-badge-opt-d').textContent).toBe('#4 of 4')
  })

  it('no toggle button when fewer than 4 options', () => {
    render(<OptionCards options={threeOptions} winnerId="opt-a" />)

    expect(screen.queryByTestId('option-cards-toggle')).not.toBeInTheDocument()
  })
})

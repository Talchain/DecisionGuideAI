/**
 * OptionCards Component Tests (V9.2 Phase 2 + V11 Phase C)
 *
 * Tests for the card-based option comparison replacing RangeVisualization.
 * Layout: option name + rank badge + description + win % text + "Hits target" bar.
 *
 * V11 additions: indeterminate neutralisation, conditional hits target,
 * hinge-aware descriptions.
 * V12.4: Per-card "Wins" bar removed; win % shown as text in header.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult, HingeInfo } from '../types'

const mockOptions: OptionResult[] = [
  {
    id: 'option-1',
    label: 'Option A',
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: true,
    winProbability: 0.65,
    goalProbability: 0.75,
    rank: 1,
  },
  {
    id: 'option-2',
    label: 'Option B',
    expected: 90,
    outcome: { mean: 90, p10: 50, p50: 90, p90: 130 },
    p10: 50,
    p50: 90,
    p90: 130,
    isRecommended: false,
    winProbability: 0.35,
    goalProbability: 0.55,
    rank: 2,
  },
]

describe('OptionCards', () => {
  describe('Basic rendering', () => {
    it('renders cards for all options', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
    })

    it('renders data-testid for each card', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.getByTestId('option-card-option-1')).toBeInTheDocument()
      expect(screen.getByTestId('option-card-option-2')).toBeInTheDocument()
    })

    it('renders wrapper with data-testid', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.getByTestId('option-cards')).toBeInTheDocument()
    })

    it('returns null when no options', () => {
      const { container } = render(<OptionCards options={[]} />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Rank markers', () => {
    it('D17: shows ordinal colour marker for each option (no "#N of M" text)', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      // Colour markers present
      expect(screen.getByTestId('rank-marker-option-1')).toBeInTheDocument()
      expect(screen.getByTestId('rank-marker-option-2')).toBeInTheDocument()
      // "#N of M" rank prefix removed
      expect(screen.queryByText(/#\d+ of/)).not.toBeInTheDocument()
    })

    it('does not show rank marker for single option', () => {
      render(<OptionCards options={[mockOptions[0]]} winnerId="option-1" />)

      expect(screen.queryByTestId('rank-marker-option-1')).not.toBeInTheDocument()
    })
  })

  describe('Descriptions', () => {
    it('shows story headline when available', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          storyHeadlines={{
            'option-1': 'Strong performance across all scenarios.',
            'option-2': 'Lower risk but lower upside.',
          }}
        />
      )

      expect(screen.getByText('Strong performance across all scenarios.')).toBeInTheDocument()
      expect(screen.getByText('Lower risk but lower upside.')).toBeInTheDocument()
    })

    it('falls back to hinge-aware description when no story headline and win data present', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      // With win probabilities available, hingeAwareDescription provides gap-based text
      expect(screen.getAllByText(/Came out ahead in .+ of simulated scenarios/)[0]).toBeInTheDocument()
      expect(screen.getByText('Behind by 30 percentage points')).toBeInTheDocument()
    })

    it('shows baseline description for baseline option', () => {
      const optionsWithBaseline = [
        mockOptions[0],
        { ...mockOptions[1], isBaseline: true },
      ]
      render(<OptionCards options={optionsWithBaseline} winnerId="option-1" />)

      // With win data present, hingeAwareDescription provides specific baseline copy
      expect(screen.getByText('Lowest risk but lowest expected outcome')).toBeInTheDocument()
    })
  })

  describe('Stat rows', () => {
    it('V12.4: shows win probability as text (no bar)', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      // "Wins" bar label should no longer exist
      expect(screen.queryByText('Wins')).not.toBeInTheDocument()

      // Win percentage displayed as text in header
      expect(screen.getByTestId('win-pct-option-1')).toHaveTextContent('65%')
      expect(screen.getByTestId('win-pct-option-2')).toHaveTextContent('35%')
    })

    it('shows "Hits target" when hasGoalThreshold is true', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          hasGoalThreshold={true}
        />
      )

      const hitsTargetLabels = screen.getAllByText('Hits target')
      expect(hitsTargetLabels).toHaveLength(2)
      expect(screen.getByText('75%')).toBeInTheDocument()
      expect(screen.getByText('55%')).toBeInTheDocument()
    })

    it('hides "Hits target" when hasGoalThreshold is false', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          hasGoalThreshold={false}
        />
      )

      expect(screen.queryByText('Hits target')).not.toBeInTheDocument()
    })
  })

  describe('Ordering', () => {
    it('V14.2: renders cards sorted by win probability descending regardless of input order', () => {
      const reversed = [mockOptions[1], mockOptions[0]]
      const { container } = render(
        <OptionCards options={reversed} winnerId="option-1" />
      )

      const cards = container.querySelectorAll('[data-option-id]')
      expect(cards[0].getAttribute('data-option-id')).toBe('option-1')
      expect(cards[1].getAttribute('data-option-id')).toBe('option-2')
    })
  })

  describe('Winner styling (Brief 5.8B D3)', () => {
    it('winner card uses border-success/30 (single-border, no per-rank palette)', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      const winnerCard = screen.getByTestId('option-card-option-1')
      expect(winnerCard.className).toContain('border-success/30')
    })

    it('non-winner cards use the neutral border-panel-border (per-rank palette retired)', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      const otherCard = screen.getByTestId('option-card-option-2')
      expect(otherCard.className).toContain('border-panel-border')
      expect(otherCard.className).not.toContain('border-info/60')
    })
  })

  describe('Graceful degradation', () => {
    it('handles options without win probability', () => {
      const noWinProb = mockOptions.map(o => ({ ...o, winProbability: undefined }))
      render(<OptionCards options={noWinProb} winnerId="option-1" />)

      // Cards should still render, just no win percentage text
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
    })

    it('R13: sorts by expected value when all win_probability values are null', () => {
      // Option B has higher expected (200) but lower winProbability (undefined)
      // Option A has lower expected (50) but also no winProbability
      const noWinProb: OptionResult[] = [
        { ...mockOptions[1], expected: 200, winProbability: undefined },
        { ...mockOptions[0], expected: 50, winProbability: undefined },
      ]
      const { container } = render(
        <OptionCards options={noWinProb} winnerId="option-2" />
      )

      const cards = container.querySelectorAll('[data-option-id]')
      // Should sort by expected value descending: option-2 (200) before option-1 (50)
      expect(cards[0].getAttribute('data-option-id')).toBe('option-2')
      expect(cards[1].getAttribute('data-option-id')).toBe('option-1')
    })

    it('R13: sorts by win_probability when ALL options have it, ignoring expected value', () => {
      // Option A has lower expected but higher win_probability
      const mixedOrder: OptionResult[] = [
        { ...mockOptions[1], expected: 200, winProbability: 0.3 },
        { ...mockOptions[0], expected: 50, winProbability: 0.7 },
      ]
      const { container } = render(
        <OptionCards options={mixedOrder} winnerId="option-1" />
      )

      const cards = container.querySelectorAll('[data-option-id]')
      // Should sort by win_probability descending: option-1 (0.7) before option-2 (0.3)
      expect(cards[0].getAttribute('data-option-id')).toBe('option-1')
      expect(cards[1].getAttribute('data-option-id')).toBe('option-2')
    })

    it('R13: mixed coverage — falls back to expected when only some have win_probability', () => {
      // Option A has winProbability=0.3, option B has none but higher expected
      // Mixed coverage should NOT use winProbability (would treat null as 0)
      const mixed: OptionResult[] = [
        { ...mockOptions[0], expected: 50, winProbability: 0.3 },
        { ...mockOptions[1], expected: 200, winProbability: undefined },
      ]
      const { container } = render(
        <OptionCards options={mixed} winnerId="option-2" />
      )

      const cards = container.querySelectorAll('[data-option-id]')
      // Falls back to expected: option-2 (200) before option-1 (50)
      expect(cards[0].getAttribute('data-option-id')).toBe('option-2')
      expect(cards[1].getAttribute('data-option-id')).toBe('option-1')
    })

    it('handles options without goal probability when target set', () => {
      const noGoalProb = mockOptions.map(o => ({ ...o, goalProbability: undefined }))
      render(
        <OptionCards
          options={noGoalProb}
          winnerId="option-1"
          hasGoalThreshold={true}
        />
      )

      // Cards render, "Hits target" rows are hidden since goalProbability is null
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.queryByText('Hits target')).not.toBeInTheDocument()
    })
  })

  describe('Multi-constraint badge', () => {
    it('shows "Meets all targets X%" when constraint_analysis is present', () => {
      const withConstraints: OptionResult[] = [
        {
          ...mockOptions[0],
          constraintAnalysis: {
            joint_probability: 0.68,
            constraints: [
              { node_id: 'c1', operator: '>=', threshold: 100, label: 'MRR', prob_satisfied: 0.85, failure_margin_median: 10, near_miss_fraction: 0.1, binding: false },
            ],
          },
        },
        mockOptions[1],
      ]

      render(<OptionCards options={withConstraints} winnerId="option-1" />)

      const badge = screen.getByTestId('option-constraint-badge')
      expect(badge).toBeInTheDocument()
      expect(badge.textContent).toContain('Meets all targets')
      expect(badge.textContent).toContain('68%')
    })

    it('shows "May miss targets" when joint_probability < 0.4', () => {
      const withConstraints: OptionResult[] = [
        {
          ...mockOptions[0],
          constraintAnalysis: {
            joint_probability: 0.25,
            constraints: [
              { node_id: 'c1', operator: '>=', threshold: 100, label: 'MRR', prob_satisfied: 0.3, failure_margin_median: 20, near_miss_fraction: 0.5, binding: true },
            ],
          },
        },
      ]

      render(<OptionCards options={withConstraints} winnerId="option-1" />)

      const badge = screen.getByTestId('option-constraint-badge')
      expect(badge.textContent).toContain('May miss targets')
      expect(badge.textContent).toContain('25%')
    })

    it('does not show constraint line when constraint_analysis is absent', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      expect(screen.queryByTestId('option-constraint-badge')).not.toBeInTheDocument()
    })
  })

  // =========================================================================
  // V11 Phase C: Indeterminate Neutralisation + Hinge-Aware Descriptions
  // =========================================================================

  describe('V11: Indeterminate neutralisation', () => {
    it('removes border-success from winner when indeterminate', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="indeterminate"
        />
      )

      const winnerCard = screen.getByTestId('option-card-option-1')
      expect(winnerCard.className).not.toContain('border-success')
      expect(winnerCard.className).toContain('border-panel-border')
    })

    it('Brief 5.4 P6: hides rank badge entirely when indeterminate (win% shown right-aligned instead)', () => {
      // Phase 6 dedup: in neutralised state the rank badge no longer switches
      // to win% — that duplicated the right-aligned canonical win% text.
      // Now the rank badge is simply absent; win% is shown once via win-pct-*.
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="indeterminate"
        />
      )

      expect(screen.queryByTestId('rank-marker-option-1')).not.toBeInTheDocument()
      expect(screen.queryByText('#1 of 2')).not.toBeInTheDocument()
      // Canonical win% still present right-aligned
      expect(screen.getByTestId('win-pct-option-1')).toHaveTextContent('65%')
    })

    it('win-pct element uses text-light styling when indeterminate', () => {
      // Brief 5.4 P6: rank badge gone in indeterminate; check win-pct styling instead.
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="indeterminate"
        />
      )

      expect(screen.queryByTestId('rank-marker-option-1')).not.toBeInTheDocument()
      // win-pct is always present when winProbability is set
      expect(screen.getByTestId('win-pct-option-1')).toBeInTheDocument()
    })

    it('V12.4: no per-card wins bars when indeterminate (removed)', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="indeterminate"
        />
      )

      // Wins bars removed — no "Wins" label rendered
      expect(screen.queryByText('Wins')).not.toBeInTheDocument()
      // Win percentage still shown as text
      expect(screen.getByTestId('win-pct-option-1')).toBeInTheDocument()
    })

    it('winner card uses border-success/30 when robust (Brief 5.8B D3 simplified palette)', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="robust"
        />
      )

      const winnerCard = screen.getByTestId('option-card-option-1')
      expect(winnerCard.className).toContain('border-success/30')
    })

    it('D17: preserves colour markers in sensitive state (no "#N of M" text)', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
        />
      )

      expect(screen.getByTestId('rank-marker-option-1')).toBeInTheDocument()
      expect(screen.queryByText(/#\d+ of/)).not.toBeInTheDocument()
    })
  })

  describe('V11: Conditional hits target', () => {
    it('hides "Hits target" when hasGoalThreshold but no option has goalProbability', () => {
      const noGoalProb = mockOptions.map(o => ({ ...o, goalProbability: undefined }))
      render(
        <OptionCards
          options={noGoalProb}
          winnerId="option-1"
          hasGoalThreshold={true}
          decisionState="robust"
        />
      )

      expect(screen.queryByText('Hits target')).not.toBeInTheDocument()
    })

    it('shows "Hits target" when hasGoalThreshold and ALL options have goalProbability', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          hasGoalThreshold={true}
          decisionState="robust"
        />
      )

      expect(screen.getAllByText('Hits target')).toHaveLength(2)
    })

    it('hides "Hits target" when only SOME options have goalProbability', () => {
      const partialGoalProb: OptionResult[] = [
        { ...mockOptions[0], goalProbability: 0.75 },
        { ...mockOptions[1], goalProbability: undefined },
      ]
      render(
        <OptionCards
          options={partialGoalProb}
          winnerId="option-1"
          hasGoalThreshold={true}
          decisionState="robust"
        />
      )

      expect(screen.queryByText('Hits target')).not.toBeInTheDocument()
    })
  })

  describe('V11: Hinge-aware descriptions', () => {
    const fragileHinge: HingeInfo = {
      label: 'Customer churn',
      nodeId: 'factor-1',
      kind: 'edge',
      reason: 'fragile_edge',
      edgeDetail: 'Customer churn → Revenue',
      alternativeWinnerLabel: 'Option B',
    }

    const heuristicHinge: HingeInfo = {
      label: 'Market size',
      nodeId: 'factor-2',
      kind: 'node',
      reason: 'heuristic',
      edgeDetail: null,
      alternativeWinnerLabel: null,
    }

    it('winner: fragile edge hinge shows "depends on {label}"', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={fragileHinge}
          runnerId="option-2"
        />
      )

      // SUPERSEDED 2026-07-31 (F2): the variant used to open with the retired
      // un-anchored superlative "Highest leading-option likelihood". The hinge
      // clause it exists to surface is unchanged; only the claim before it
      // moved to the house comparative register, with its magnitude.
      expect(
        screen.getByText(/came out ahead in .+ of simulated scenarios, but this depends on Customer churn/i),
      ).toBeInTheDocument()
    })

    it('winner: heuristic hinge shows "{label} has the widest uncertainty"', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={heuristicHinge}
          runnerId="option-2"
        />
      )

      // SUPERSEDED 2026-07-31 (F2) — same retired superlative, same unchanged
      // hinge clause.
      expect(
        screen.getByText(/came out ahead in .+ of simulated scenarios\. Market size has the widest uncertainty\./i),
      ).toBeInTheDocument()
    })

    it('winner: no hinge shows generic description', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="robust"
          hinge={null}
          runnerId="option-2"
        />
      )

      expect(screen.getAllByText(/Came out ahead in .+ of simulated scenarios/)[0]).toBeInTheDocument()
    })

    it('runner-up: matched alternate winner shows overtake description', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={fragileHinge}
          runnerId="option-2"
        />
      )

      // Option B is runnerId AND matches hinge.alternativeWinnerLabel
      expect(screen.getByText('If Customer churn shifts, this option overtakes')).toBeInTheDocument()
    })

    it('runner-up: unmatched alternate winner shows generic runner-up', () => {
      const hingeNoMatch: HingeInfo = {
        ...fragileHinge,
        alternativeWinnerLabel: 'Option C', // not Option B
      }
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={hingeNoMatch}
          runnerId="option-2"
        />
      )

      expect(screen.getByText('Behind by 30 percentage points')).toBeInTheDocument()
    })

    it('other options show gap-based description', () => {
      const threeOptions: OptionResult[] = [
        ...mockOptions,
        {
          id: 'option-3',
          label: 'Option C',
          expected: 80,
          outcome: { mean: 80, p10: 40, p50: 80, p90: 120 },
          p10: 40,
          p50: 80,
          p90: 120,
          isRecommended: false,
          winProbability: 0.10,
          rank: 3,
        },
      ]

      render(
        <OptionCards
          options={threeOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={fragileHinge}
          runnerId="option-2"
        />
      )

      // With 3 options only 2 show by default; expand to see the third
      fireEvent.click(screen.getByTestId('option-cards-toggle'))
      expect(screen.getByText('Behind by 55 percentage points')).toBeInTheDocument()
    })

    it('V11.2: VM hinge-aware description takes priority over story_headline when decisionState available', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          decisionState="sensitive"
          hinge={fragileHinge}
          runnerId="option-2"
          storyHeadlines={{ 'option-1': 'Custom headline for winner.' }}
        />
      )

      // VM description wins when decisionState is set
      // SUPERSEDED 2026-07-31 (F2): the variant used to open with the retired
      // un-anchored superlative "Highest leading-option likelihood". The hinge
      // clause it exists to surface is unchanged; only the claim before it
      // moved to the house comparative register, with its magnitude.
      expect(
        screen.getByText(/came out ahead in .+ of simulated scenarios, but this depends on Customer churn/i),
      ).toBeInTheDocument()
      expect(screen.queryByText('Custom headline for winner.')).not.toBeInTheDocument()
    })

    it('V11.2: story_headline is used when decisionState is absent', () => {
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          storyHeadlines={{ 'option-1': 'Custom headline for winner.' }}
        />
      )

      expect(screen.getByText('Custom headline for winner.')).toBeInTheDocument()
    })

    it('uses hinge-aware descriptions when decisionState is absent but win data exists', () => {
      render(<OptionCards options={mockOptions} winnerId="option-1" />)

      // Win probabilities trigger hingeAwareDescription even without decisionState
      expect(screen.getAllByText(/Came out ahead in .+ of simulated scenarios/)[0]).toBeInTheDocument()
    })

    it('V11.2: renders pre-sanitized story_headline (sanitization at data layer)', () => {
      // Data layer sanitizes arrows before passing storyHeadlines to OptionCards
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          storyHeadlines={{ 'option-1': 'Leads by 5pp to strongest performer' }}
        />
      )

      expect(screen.getByText('Leads by 5pp to strongest performer')).toBeInTheDocument()
      expect(screen.queryByText(/→/)).not.toBeInTheDocument()
    })
  })

  describe('Brief 5.8B D3 — "different approach" link', () => {
    it('renders the link only when onSendMessage is wired', () => {
      const { rerender } = render(
        <OptionCards options={mockOptions} winnerId="option-1" />,
      )
      expect(screen.queryByTestId('option-cards-different-approach')).not.toBeInTheDocument()
      rerender(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          onSendMessage={() => {}}
        />,
      )
      expect(screen.getByTestId('option-cards-different-approach')).toBeInTheDocument()
    })

    it('clicking the link prefills the Ask-Olumi drawer instead of auto-sending', async () => {
      // Codex finding 6: exploratory CTA routes through openAskOlumi (prefilled
      // editable draft) — it must NOT call the threaded onSendMessage.
      const { useAskOlumiStore } = await import('../coaching/askOlumiStore')
      useAskOlumiStore.getState().close()
      const onSendMessage = vi.fn()
      render(
        <OptionCards
          options={mockOptions}
          winnerId="option-1"
          onSendMessage={onSendMessage}
        />,
      )
      fireEvent.click(screen.getByTestId('option-cards-different-approach'))
      expect(onSendMessage).not.toHaveBeenCalled()
      const state = useAskOlumiStore.getState()
      expect(state.isOpen).toBe(true)
      expect(state.draft).toMatch(/different approach/i)
    })
  })
})
/**
 * ⭐ BOTH FIXTURES COMPLETED 2026-08-01 (ROADMAP 2.238). They rendered
 * `lensActive` with NO `lensHighlightedId`, and therefore only passed via the
 * `?? winnerId` fallback — i.e. they were pinning the defect: a crown labelled
 * "Ahead on this outcome view" on the COMPARATIVE winner, in the exact state
 * where the panel above prints "Not enough range data to compare options under
 * this lens."
 *
 * The claims these tests were WRITTEN to make (the crowned card says
 * lens-strongest rather than THE recommendation; the lens copy outranks a
 * coaching headline) are unchanged and still correct — they just need the lens
 * to have actually picked something. `lensHighlightedId` is now passed
 * explicitly, which is what the live path does whenever the lens is comparable.
 */
describe("Paul's ruling (2026-07-12): lens-aware winner copy", () => {
  it('lens-crowned card presents as lens-strongest, not THE recommendation', () => {
    render(
      <OptionCards options={mockOptions} winnerId="option-1" lensActive lensHighlightedId="option-1" />,
    )
    const card = screen.getByTestId('option-card-option-1')
    expect(card).toHaveTextContent('Ahead on this outcome view. The goal ranking above is unchanged.')
    expect(card.textContent).not.toMatch(/Highest leading-option likelihood/)
  })

  it('the lens copy beats a coaching story headline on the crowned card', () => {
    render(
      <OptionCards
        options={mockOptions}
        winnerId="option-1"
        lensActive
        lensHighlightedId="option-1"
        storyHeadlines={{ 'option-1': 'Best placed once the goal and limits are both counted.' }}
      />,
    )
    const card = screen.getByTestId('option-card-option-1')
    expect(card).toHaveTextContent('Ahead on this outcome view. The goal ranking above is unchanged.')
    expect(card.textContent).not.toMatch(/Best placed once the goal/)
  })

  it('without the lens the winner keeps its standard description', () => {
    render(<OptionCards options={mockOptions} winnerId="option-1" />)
    const card = screen.getByTestId('option-card-option-1')
    expect(card.textContent).not.toMatch(/Strongest under this lens/)
  })
})
describe('Wave 2: identity-anchored stable number chips', () => {
  it('renders a stable-number chip per card when stableNumbers is provided', () => {
    render(<OptionCards options={mockOptions} winnerId="option-1" stableNumbers={{ 'option-1': 2, 'option-2': 1 }} />)
    expect(screen.getByTestId('stable-number-option-1')).toHaveTextContent('Option 2')
    expect(screen.getByTestId('stable-number-option-2')).toHaveTextContent('Option 1')
  })

  it('renders no chips without the prop (flag-off surface unchanged)', () => {
    render(<OptionCards options={mockOptions} winnerId="option-1" />)
    expect(screen.queryByTestId('stable-number-option-1')).toBeNull()
  })
})

describe('Codex B1 — a lens never re-crowns leader SEMANTICS', () => {
  it('canonical leader keeps the downside sentence + leader CTA; the lens card gets neither', () => {
    // Canonical leader A carries the downside flag; the cautious lens crowns B.
    render(
      <OptionCards
        options={mockOptions}
        winnerId="option-1"            // canonical leader (A)
        lensActive
        lensHighlightedId="option-2"   // lens selects B
        leadingOptionDownsideFlag
        onSendMessage={() => {}}
      />,
    )
    const lensCard = screen.getByTestId('option-card-option-2')
    const canonicalCard = screen.getByTestId('option-card-option-1')
    // Lens card: lens copy, NO leader downside predicate, NO leader CTA.
    expect(lensCard).toHaveTextContent('Ahead on this outcome view. The goal ranking above is unchanged.')
    expect(lensCard.textContent).not.toMatch(/currently leads/i)
    expect(lensCard.textContent).not.toMatch(/What makes this/i)
    // Canonical card: keeps the leader predicates even without the crown styling.
    expect(canonicalCard.textContent).toMatch(/meaningful downside|currently leads/i)
    expect(canonicalCard.textContent).toMatch(/What makes this/i)
  })
})

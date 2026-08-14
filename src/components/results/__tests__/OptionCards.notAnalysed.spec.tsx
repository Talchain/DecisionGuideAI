/**
 * OptionCards — an option the run never analysed renders as PROPOSED, not RANKED.
 *
 * Ruling (Paul, 14 Aug 2026): an unanalysable/placeholder option must NOT be
 * included in comparative ranking or probabilities. It stays visible as a
 * proposed/unanalysed alternative with a clear reason and an action to resolve
 * it.
 *
 * ## What is pinned, and why each pin exists
 *
 * The ranked card has SEVEN places a number or an ordinal can appear (rank
 * swatch, "Option N", win percentage, fill bar, goal bar, low-goal badge, range
 * bar). This file asserts their ABSENCE on the marked option and their PRESENCE
 * on an analysed sibling **in the same render** — the contrast control that
 * separates "the ruling is enforced" from "this suite cannot see chrome at all"
 * (CLAUDE.md trap 13e: a control must be plausible, not merely present).
 *
 * Every query binds to its option by ID (`option-card-not-analysed-<id>`,
 * `rank-marker-<id>`, `win-pct-<id>`), never by a value predicate another card
 * could satisfy (trap 19).
 *
 * ## Deployed-flag posture (trap 3b)
 *
 * `OptionCards` is mounted from `ResultsBody:609` with NO feature-flag gate —
 * only `!isSingleOption && allOptions.length > 1` — and `ResultsBody` is the
 * Analysis tab body mounted from `OutputsDock`. So this component is the
 * surface staging renders, on every flag posture. The mount path itself is
 * asserted by `ResultsBody.notAnalysedMountPath.spec.tsx`, so this file's
 * greenness is a claim about something a user loads.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import { NOT_ANALYSED_BADGE } from '../utils/notAnalysedCopy'
import type { OptionResult } from '../types'

const ANALYSED_A = 'opt-analysed-a'
const ANALYSED_B = 'opt-analysed-b'
const NOT_ANALYSED = 'opt-not-analysed'
const NOT_ANALYSED_LABEL = 'Migrate to Salesforce'

function analysed(id: string, overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id,
    label: `Analysed ${id}`,
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60,
    p50: 100,
    p90: 140,
    isRecommended: false,
    winProbability: 0.35,
    goalProbability: 0.55,
    ...overrides,
  }
}

/** Exactly the shape `useResultsSectionData` produces for an excluded option. */
function notAnalysed(overrides: Partial<OptionResult> = {}): OptionResult {
  return {
    id: NOT_ANALYSED,
    label: NOT_ANALYSED_LABEL,
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    notAnalysed: true,
    notAnalysedReason: 'no_interventions',
    ...overrides,
  }
}

/**
 * Two analysed options plus the excluded one. `hasLeadingOption` is TRUE on
 * purpose: on a withheld run the ranked chrome is suppressed for EVERY card, so
 * the absence assertions below would pass without the fix — the fixture has to
 * be a run that DOES rank, or this whole file is a tautology (trap 13b: a
 * discriminator must pin its own precondition).
 */
function renderCards(options: OptionResult[], props: Record<string, unknown> = {}) {
  return render(
    <OptionCards
      options={options}
      winnerId={ANALYSED_A}
      hasLeadingOption
      hasGoalThreshold
      stableNumbers={{ [ANALYSED_A]: 1, [ANALYSED_B]: 2, [NOT_ANALYSED]: 3 }}
      {...props}
    />,
  )
}

const MIXED: OptionResult[] = [
  analysed(ANALYSED_A, { isRecommended: true, winProbability: 0.6 }),
  analysed(ANALYSED_B, { winProbability: 0.25 }),
  notAnalysed(),
]

describe('OptionCards — the option that was never analysed', () => {
  it('PRECONDITION: the run ranks, so the ranked chrome is genuinely on screen', () => {
    renderCards(MIXED)
    // If these ever go missing the absence assertions below stop discriminating
    // and start agreeing with a blank screen.
    expect(screen.getByTestId(`rank-marker-${ANALYSED_A}`)).toBeInTheDocument()
    expect(screen.getByTestId(`win-pct-${ANALYSED_A}`)).toBeInTheDocument()
    expect(screen.getByTestId(`stable-number-${ANALYSED_A}`)).toBeInTheDocument()
  })

  it('renders NO rank swatch, NO ordinal, NO win percentage for it', () => {
    renderCards(MIXED)
    expect(screen.queryByTestId(`rank-marker-${NOT_ANALYSED}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`stable-number-${NOT_ANALYSED}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`win-pct-${NOT_ANALYSED}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`goal-readout-${NOT_ANALYSED}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`low-goal-warning-${NOT_ANALYSED}`)).not.toBeInTheDocument()
    // It never reaches the ranked card at all.
    expect(screen.queryByTestId(`option-card-${NOT_ANALYSED}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`option-card-not-analysed-${NOT_ANALYSED}`)).toBeInTheDocument()
  })

  it('states the reason and offers the resolve action', () => {
    renderCards(MIXED)
    expect(screen.getByTestId(`not-analysed-badge-${NOT_ANALYSED}`)).toHaveTextContent(NOT_ANALYSED_BADGE)
    expect(screen.getByTestId(`not-analysed-reason-${NOT_ANALYSED}`).textContent ?? '').toContain(
      'no rank and no probability',
    )
    expect(screen.getByTestId(`not-analysed-resolve-${NOT_ANALYSED}`)).toBeInTheDocument()
    // Its own label is still on screen — "not analysed" is not "hidden".
    expect(screen.getByText(NOT_ANALYSED_LABEL)).toBeInTheDocument()
  })

  it('the resolve action drafts CEE’s own documented sentence', async () => {
    const store = await import('../coaching/askOlumiStore')
    const spy = vi.spyOn(store, 'openAskOlumi')
    renderCards(MIXED)
    fireEvent.click(screen.getByTestId(`not-analysed-resolve-${NOT_ANALYSED}`))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0].draft).toBe(`Help me configure ${NOT_ANALYSED_LABEL}.`)
    spy.mockRestore()
  })

  it('OPPOSITE TWIN — not_returned prescribes no action', () => {
    // The reason the user cannot act on. A configure button here would send
    // them to fix something that is not broken on their side.
    renderCards([
      analysed(ANALYSED_A, { isRecommended: true, winProbability: 0.6 }),
      analysed(ANALYSED_B, { winProbability: 0.25 }),
      notAnalysed({ notAnalysedReason: 'not_returned' }),
    ])
    expect(screen.getByTestId(`option-card-not-analysed-${NOT_ANALYSED}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`not-analysed-resolve-${NOT_ANALYSED}`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`not-analysed-reason-${NOT_ANALYSED}`).textContent ?? '').toContain(
      'returned no result',
    )
  })

  it('stays VISIBLE past the top-2 truncation, with no expand click', () => {
    // Unranked options sort last, so the truncation would otherwise hide the
    // very option being disclosed. Two analysed options fill the top 2.
    renderCards(MIXED)
    expect(screen.getByTestId(`option-card-not-analysed-${NOT_ANALYSED}`)).toBeInTheDocument()
    expect(screen.getByTestId(`option-card-${ANALYSED_A}`)).toBeInTheDocument()
    expect(screen.getByTestId(`option-card-${ANALYSED_B}`)).toBeInTheDocument()
  })

  it('does not manufacture a "Show all (0 more)" control', () => {
    // The 2.237 collision, re-checkable here because this file adds a second
    // appender to the same list.
    renderCards(MIXED, { onSendMessage: () => {} })
    expect(screen.queryByTestId('option-cards-toggle')).not.toBeInTheDocument()
  })

  it('keeps the "Hits target" bar on the ANALYSED cards', () => {
    // `allGoalProbability` was an `every` over ALL options, so the marked
    // option — which has no goal probability by construction — deleted this bar
    // from every analysed card.
    renderCards(MIXED)
    expect(screen.getByTestId(`goal-readout-${ANALYSED_A}`)).toBeInTheDocument()
    expect(screen.getByTestId(`goal-readout-${ANALYSED_B}`)).toBeInTheDocument()
  })

  it('UNCHANGED BEHAVIOUR — a list with no marked option renders exactly as before', () => {
    renderCards([
      analysed(ANALYSED_A, { isRecommended: true, winProbability: 0.6 }),
      analysed(ANALYSED_B, { winProbability: 0.25 }),
    ])
    expect(screen.getByTestId(`option-card-${ANALYSED_A}`)).toBeInTheDocument()
    expect(screen.getByTestId(`option-card-${ANALYSED_B}`)).toBeInTheDocument()
    expect(screen.queryByTestId(/option-card-not-analysed-/)).not.toBeInTheDocument()
  })
})

/**
 * OWNED LEADER CLAIM — the OptionCards family (ROADMAP 1.223b).
 *
 * The remainder adjudicated in pre-merge review of #491. `winnerId` is the
 * producer's recommended option id and it survives a withheld turn by design
 * (it drives segment colours, the lens crown and card ordering — none of which
 * claim anything). What must NOT survive is the comparative SENTENCES keyed
 * off it:
 *
 *   · "Top-performing option based on current estimates."
 *   · "Highest leading-option likelihood across simulated scenarios"
 *   · "Behind by N percentage points"
 *   · "Statistically tied with the leading option"   ← a DENIAL
 *   · "Compare against the leading option."
 *   · "This option currently leads, but …"           ← the downside pill
 *   · "What makes this the current leader?"          ← the chip
 *
 * The denial matters as much as the assertions: "statistically tied with the
 * leading option" asserts a leader exists in the same breath as calling it a
 * tie, and on a withheld turn the UI has no authority for either half. Same
 * silence-not-denial rule the verdict itself follows.
 *
 * Every withheld case below has a PERMITTED twin. Over-suppression is a
 * failure, not a fix — this suite would catch a change that simply blanked the
 * cards.
 *
 * CLAUDE.md trap 3: these assert presence/absence of TEXT and attributes.
 * jsdom cannot prove visibility and nothing here claims it does.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { OptionResult } from '../types'

vi.mock('../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

const WINNER_ID = 'opt_mac'
const RUNNER_UP_ID = 'opt_dell'

function opts(): OptionResult[] {
  return [
    {
      id: WINNER_ID,
      label: 'Standardise on MacBook Pro',
      winProbability: 0.66,
      isRecommended: true,
      expected: 68,
      outcome: { mean: 68, p10: 54, p50: 67, p90: 82 },
    },
    {
      id: RUNNER_UP_ID,
      label: 'Standardise on Dell XPS',
      winProbability: 0.314,
      isRecommended: false,
      expected: 41,
      outcome: { mean: 41, p10: 30, p50: 40, p90: 52 },
    },
  ] as unknown as OptionResult[]
}

function renderCards(hasLeadingOption: boolean | undefined) {
  return render(
    <OptionCards
      options={opts()}
      winnerId={WINNER_ID}
      hasLeadingOption={hasLeadingOption}
      confidenceTier={'fair' as never}
      recommendationStability={0.5}
      leadingOptionDownsideFlag
      onSendMessage={() => {}}
    />,
  )
}

/** Comparative phrases that presuppose, assert, or deny a unique leader. */
const LEADER_LANGUAGE: ReadonlyArray<[string, RegExp]> = [
  ['Top-performing option', /top-performing option/i],
  ['Highest leading-option likelihood', /came out ahead in .+ of simulated scenarios/i],
  // ⚠ RETIRED EVERYWHERE 2026-08-10, so this row is now UNCONDITIONALLY true
  // and can no longer tell a withheld turn from a permitted one. It is kept
  // deliberately — it still guards against the string coming back — but its
  // loss of discriminating power is stated here rather than left to look like
  // coverage, and the permitted-turn describe below now asserts the same
  // absence explicitly so the new truth is pinned on BOTH turns.
  ['Behind by N percentage points', /behind by \d+ percentage point/i],
  ['Statistically tied with the leading option', /statistically tied with the leading option/i],
  ['Compare against the leading option', /compare against the leading option/i],
  ['This option currently leads', /this option currently leads/i],
  ['the current leader', /the current leader/i],
]

describe('OptionCards — withheld leader claim', () => {
  it('renders none of the comparative sentences', () => {
    const { container } = renderCards(false)
    const text = container.textContent ?? ''
    for (const [name, re] of LEADER_LANGUAGE) {
      expect(re.test(text), `must not render "${name}" — got: ${text.slice(0, 300)}`).toBe(false)
    }
  })

  it('still renders both options and their win probabilities — data is not a claim', () => {
    // Positive control for the suppression above (trap 13): if the cards
    // stopped rendering, every absence assertion would pass vacuously.
    renderCards(false)
    expect(screen.getByText('Standardise on MacBook Pro')).toBeDefined()
    expect(screen.getByText('Standardise on Dell XPS')).toBeDefined()
    expect(screen.getByTestId(`win-pct-${WINNER_ID}`).textContent).toMatch(/\d/)
    expect(screen.getByTestId(`win-pct-${RUNNER_UP_ID}`).textContent).toMatch(/\d/)
  })

  it('withholds the downside pill, which is phrased as a leader claim', () => {
    renderCards(false)
    expect(screen.queryByTestId(`leading-option-downside-${WINNER_ID}`)).toBeNull()
  })

  it('offers the forward-looking chip instead of "the current leader"', () => {
    renderCards(false)
    // Existing copy, not invented: this is already the module's phrasing for
    // an option that does not hold a lead.
    expect(screen.getAllByText('What would make this lead?').length).toBeGreaterThan(0)
  })
})

describe('OptionCards — permitted leader claim (over-suppression controls)', () => {
  it('keeps the winner sentence, and the non-leader card keeps its OWN number', () => {
    const { container } = renderCards(true)
    const text = container.textContent ?? ''
    expect(text).toMatch(/came out ahead in .+ of simulated scenarios/i)

    // ⭐ SUPERSEDED 2026-08-10. This asserted the non-leader's sentence was
    // `/behind by \d+ percentage point/i` — the percentage-point gap between
    // two win frequencies, now retired from every user-facing surface. The
    // control's JOB is unchanged and still needed: prove a permitted turn does
    // not OVER-suppress the non-leader card. It is simply rebound to what now
    // carries that card's non-suppressed content — its own probability
    // readout, by testid rather than by a value another element could satisfy.
    expect(screen.getByTestId(`win-pct-${RUNNER_UP_ID}`).textContent).toMatch(/\d/)
    expect(text).not.toMatch(/behind by \d+ percentage point/i)
    expect(text).not.toMatch(/percentage\s+points?/i)
  })

  it('keeps the downside pill', () => {
    renderCards(true)
    expect(screen.getByTestId(`leading-option-downside-${WINNER_ID}`)).toBeDefined()
  })

  it('keeps the leader chip copy', () => {
    const { container } = renderCards(true)
    // `fair` tier + stability 0.5 is the softened branch, i.e. the exact
    // combination that produces "the current leader".
    expect(container.textContent ?? '').toMatch(/the current leader/i)
  })

  it('an ABSENT flag behaves exactly as a permitted one (older callers/fixtures)', () => {
    // The same concession certaintyCopy and buildV7Headline make. Pins it, so
    // the default cannot drift to silence and quietly blank every legacy
    // caller's cards.
    const { container } = renderCards(undefined)
    expect(container.textContent ?? '').toMatch(/came out ahead in .+ of simulated scenarios/i)
  })
})

describe('OptionCards — the identity/entitlement split', () => {
  it('withheld turns keep the winner card FIRST and keep its bar — only sentences go', () => {
    // `winnerId` is deliberately still honoured for ordering and styling: the
    // point of this change is that identity and entitlement are different
    // questions, not that the leader is erased from the UI.
    renderCards(false)
    const cards = screen.getAllByTestId(/^win-pct-/)
    expect(cards[0].getAttribute('data-testid')).toBe(`win-pct-${WINNER_ID}`)
  })
})

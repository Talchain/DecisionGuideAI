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
 *   · "What makes this best supported?"          ← the chip
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
import { render, screen, within } from '@testing-library/react'
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
  ['Highest leading-option likelihood', /supported in .+ of simulated scenarios/i],
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
  ['best supported', /best supported/i],
  // The principle-audit wording (5 Oct): every comparative now says the option came out best IN THIS MODEL, so the
  // withheld turn must not say that either. Without these two rows the list above would only guard retired words.
  ['came out best', /came out best/i],
  ['come out best', /come out best/i],
  // Union, never replace: the direction-neutral wording that replaced "came out best" (Paul, 5 Oct).
  ['runs supported', /runs supported/i],
  ['runs would/could/still support', /runs (?:would|could|still) support/i],
  ['the direction-neutral leader chip', /most runs in this model support/i],
  ['the most runs', /the most runs|be supported by the most runs/i],
  ['the softened leader chip', /What does this rest on in this model\?/],
  // #2747 re-scope 2 (U0, DL ruling (A)): union — the permitted winner claim now carries no magnitude, so the withheld turn
  // must not say that form either (the 'Highest leading-option likelihood' regex above cannot see it).
  ['the no-magnitude winner claim', /supported in more simulated scenarios than any other option/i],
]

describe('OptionCards — withheld leader claim', () => {
  it('renders none of the comparative sentences', () => {
    const { container } = renderCards(false)
    const text = container.textContent ?? ''
    for (const [name, re] of LEADER_LANGUAGE) {
      expect(re.test(text), `must not render "${name}" — got: ${text.slice(0, 300)}`).toBe(false)
    }
  })

  // #2747 re-scope 2 (U0, DL ruling (A)): was 'still renders both options and their win probabilities — data is not a
  // claim'; no card shows a win share in C, so the positive control is both cards by identity, with no share on either.
  it('still renders both options (and, in C, no win probability on either) — data is not a claim', () => {
    // Positive control for the suppression above (trap 13): if the cards
    // stopped rendering, every absence assertion would pass vacuously.
    renderCards(false)
    expect(screen.getByText('Standardise on MacBook Pro')).toBeDefined()
    expect(screen.getByText('Standardise on Dell XPS')).toBeDefined()
    expect(screen.getByTestId(`option-card-${WINNER_ID}`)).toBeDefined()
    expect(screen.getByTestId(`option-card-${RUNNER_UP_ID}`)).toBeDefined()
    expect(screen.queryByTestId(`win-pct-${WINNER_ID}`)).toBeNull()
    expect(screen.queryByTestId(`win-pct-${RUNNER_UP_ID}`)).toBeNull()
  })

  it('withholds the downside pill, which is phrased as a leader claim', () => {
    renderCards(false)
    expect(screen.queryByTestId(`leading-option-downside-${WINNER_ID}`)).toBeNull()
  })

  it('offers the forward-looking chip instead of "best supported"', () => {
    renderCards(false)
    // Existing copy, not invented: this is already the module's phrasing for
    // an option that does not hold a lead.
    expect(screen.getAllByText('What would make this better supported?').length).toBeGreaterThan(0)
    // Twin of the permitted row below: on a withheld turn the leading option's own card keeps that chip.
    expect(
      within(screen.getByTestId(`option-card-${WINNER_ID}`)).getByRole('button', { name: 'What would make this better supported?' }),
    ).toBeDefined()
  })
})

describe('OptionCards — permitted leader claim (over-suppression controls)', () => {
  // #2747 re-scope 2 (U0, DL ruling (A)): was 'keeps the winner sentence, and the non-leader card keeps its OWN number'. The
  // winner sentence is kept, verbatim and with no magnitude; the non-leader card is kept by identity but carries no share.
  // Run-4 judge, BLOCKING (DL 12 Oct): was 'keeps the winner sentence (no magnitude), …'. Even a permitted claim makes no
  // leader sentence from a win share ("more simulated scenarios than any other option"); the cards themselves stay.
  it('makes no win-share leader sentence even when permitted, and keeps the non-leader card — with no share of its own', () => {
    const { container } = renderCards(true)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/than any other option/i)
    expect(screen.getByTestId(`option-card-${WINNER_ID}`)).toBeDefined()
    expect(text).not.toMatch(/supported in .+ of simulated scenarios/i)

    // ⭐ SUPERSEDED 2026-08-10. This asserted the non-leader's sentence was
    // `/behind by \d+ percentage point/i` — the percentage-point gap between
    // two win frequencies, now retired from every user-facing surface. The
    // control's JOB is unchanged and still needed: prove a permitted turn does
    // not OVER-suppress the non-leader card. It is simply rebound to what now
    // carries that card's non-suppressed content — its own probability
    // readout, by testid rather than by a value another element could satisfy.
    // #2747 re-scope 2 (U0, DL ruling (A)): in C that readout is gone too; the card itself must still render.
    expect(screen.getByTestId(`option-card-${RUNNER_UP_ID}`)).toBeDefined()
    expect(screen.queryByTestId(`win-pct-${RUNNER_UP_ID}`)).toBeNull()
    expect(text).not.toMatch(/behind by \d+ percentage point/i)
    expect(text).not.toMatch(/percentage\s+points?/i)
  })

  it('keeps the downside pill', () => {
    renderCards(true)
    expect(screen.getByTestId(`leading-option-downside-${WINNER_ID}`)).toBeDefined()
  })

  // Run-4 judge (DL 12 Oct, the class): the leader chip ("Why did the most runs in this model support this?" / "What does
  // this rest on in this model?") is removed; nothing replaces it. Was 'keeps the leader chip copy'.
  it('draws no leader chip even when permitted; the non-leader card keeps its own chip', () => {
    const { container } = renderCards(true)
    const leader = screen.getByTestId(`option-card-${WINNER_ID}`)
    expect(within(leader).queryByRole('button', { name: /better supported|most runs|rest on/i })).toBeNull()
    expect(container.textContent ?? '').not.toMatch(/What does this rest on in this model\?|most runs in this model support/)
    // Over-suppression control: the non-leader card keeps its forward-looking chip.
    expect(
      within(screen.getByTestId(`option-card-${RUNNER_UP_ID}`)).getByRole('button', { name: 'What would make this better supported?' }),
    ).toBeDefined()
  })

  it('an ABSENT flag behaves exactly as a permitted one (older callers/fixtures)', () => {
    // The same concession certaintyCopy and buildV7Headline make. Pins it, so
    // the default cannot drift to silence and quietly blank every legacy
    // caller's cards.
    const { container } = renderCards(undefined)
    // Run-4 judge (DL 12 Oct): there is no winner sentence to compare, so the control binds to what a permitted claim
    // keeps: the downside pill (see 'keeps the downside pill'), and the same absence of any win-share leader sentence.
    expect(screen.getByTestId(`leading-option-downside-${WINNER_ID}`)).toBeDefined()
    expect(container.textContent ?? '').not.toMatch(/than any other option/i)
  })
})

describe('OptionCards — the identity/entitlement split', () => {
  // #2747 re-scope 2 (U0, DL ruling (A)): was 'withheld turns keep the winner card FIRST and keep its bar — only sentences
  // go'. The order was read off the win readouts, which C no longer prints; it is now read off the cards themselves.
  it('withheld turns keep the winner card FIRST — only sentences go (and, in C, no win-share readout on any card)', () => {
    // `winnerId` is deliberately still honoured for ordering and styling: the
    // point of this change is that identity and entitlement are different
    // questions, not that the leader is erased from the UI.
    renderCards(false)
    const cards = screen.getAllByTestId(/^option-card-/)
    expect(cards[0].getAttribute('data-testid')).toBe(`option-card-${WINNER_ID}`)
    expect(screen.queryAllByTestId(/^win-pct-/)).toEqual([])
  })
})

/**
 * ROADMAP 2.237 / 2.238 — the outcome-view lens must not claim what it does not do.
 *
 * Both defects are the SAME shape as ROADMAP 2.233 (the goal headline crowning
 * the comparative winner): **the subject of the claim is not the source of the
 * number.** Both were found by a pattern sweep over merged code and are live,
 * unflagged, on the Analysis tab at `55d0167b`.
 *
 * ── P1-1 (2.237): a RANKING that never happens ────────────────────────────
 * The control said "Rank by outcome:" and the panel said "ranked by the low end
 * (p10) of each outcome range". Neither is true. `sortOptionsForDisplay` takes
 * NO lens argument — the list is ordered by `winProbability`, truncated by that
 * order, and stamped with explicit ordinals from it. The lens reaches the cards
 * only as a CROWN on one card. On
 *
 *     A(win .50, p10 10)   B(win .30, p10 50)   C(win .20, p10 90)
 *
 * clicking "Cautious (p10)" printed the ranking claim over a list reading
 * A(1), B(2) — byte-identical to neutral — with C, the p10 leader and the
 * lens's OWN pick, not rendered at all behind "Show all (1 more)". The user was
 * told a ranking existed and then could not see its result.
 *
 * ── P1-2 (2.238): a crown under a lens that says it has no data ───────────
 * `isLensCrowned` fell back to `winnerId` when `lensHighlightedId` was null —
 * and null is exactly the state in which the panel prints "Not enough range
 * data to compare options under this lens." Both lines read the SAME memo, so
 * the contradiction was deterministic, not a race: the comparative winner was
 * crowned "Ahead on this outcome view" under a sentence declaring the view
 * unavailable. `selectLensOption:69-73` already documents the correct rule —
 * "an absence, never a fallback to a different quantity" — so the doctrine was
 * written and then not applied at the one call site that mattered.
 *
 * CLAIM TYPE: these are TEXT- and PRESENCE-level assertions on rendered output.
 * jsdom cannot prove visibility (CLAUDE.md trap 3) and nothing here should be
 * read as a layout claim.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import { WIN_GAUGE_COLORS } from '../WinGauge'
import type { OptionResult } from '../types'

function opt(id: string, label: string, winProbability: number, p10: number): OptionResult {
  return {
    id,
    label,
    winProbability,
    outcome: { p10, p50: p10 + 10, p90: p10 + 20, expected: p10 + 10 },
  } as unknown as OptionResult
}

/** The sweep's exact disagreement fixture: winProbability and p10 rank OPPOSITELY. */
const DISAGREEING = [
  opt('option-1', 'Option A', 0.5, 10),
  opt('option-2', 'Option B', 0.3, 50),
  opt('option-3', 'Option C', 0.2, 90),
]

describe('P1-2 (ROADMAP 2.238) — no lens crown when the lens has no comparable data', () => {
  it('THE CONTRADICTION: with no lensHighlightedId, NO card is crowned "Ahead on this outcome view"', () => {
    // `undefined` is exactly what `ResultsBody:543` passes when
    // `lensComparison.comparable` is false — the same memo that makes the panel
    // above print "Not enough range data to compare options under this lens."
    // (`LensSelection.id` is `string | undefined`; the guard uses `!= null` so
    // it holds for either spelling.)
    render(
      <OptionCards
        options={DISAGREEING}
        winnerId="option-1"
        lensActive
        lensHighlightedId={undefined}
      />,
    )
    expect(screen.queryByText(/Ahead on this outcome view/)).not.toBeInTheDocument()
  })

  it('the COMPARATIVE winner specifically is not the one crowned by default', () => {
    render(
      <OptionCards
        options={DISAGREEING}
        winnerId="option-1"
        lensActive
        lensHighlightedId={undefined}
      />,
    )
    const comparativeWinner = screen.getByTestId('option-card-option-1')
    expect(comparativeWinner.textContent).not.toMatch(/Ahead on this outcome view/)
  })

  it("OVER-SUPPRESSION CONTROL: a real lens pick IS still crowned, and it is the lens's own pick", () => {
    // Removing the fallback must not silence the legitimate case — that would
    // trade one defect for another.
    render(
      <OptionCards
        options={DISAGREEING}
        winnerId="option-1"
        lensActive
        lensHighlightedId="option-3"
      />,
    )
    expect(screen.getByTestId('option-card-option-3')).toHaveTextContent(
      /Ahead on this outcome view/,
    )
    // And NOT the comparative winner.
    expect(screen.getByTestId('option-card-option-1').textContent).not.toMatch(
      /Ahead on this outcome view/,
    )
  })

  it('CONTROL: with the lens off, the comparative winner keeps its normal description', () => {
    render(<OptionCards options={DISAGREEING} winnerId="option-1" />)
    expect(screen.queryByText(/Ahead on this outcome view/)).not.toBeInTheDocument()
    expect(screen.getByTestId('option-card-option-1').textContent).toBeTruthy()
  })
})

/**
 * ⛔ A B2 BLOCK STOOD HERE AND HAS BEEN WITHDRAWN (2026-08-01).
 *
 * It pinned "a withheld run prints no lens sentence" — the opposite of the
 * standing ruling. ROADMAP 1.239 (#494, `a79683e4`) exempts this sentence BY
 * DESIGN, with a stated rationale (a per-view argmax over on-screen values is
 * not the producer's designation; gating it is the over-suppression class
 * already fixed once in DecisionNode) and its own pin in
 * `residualComparative.optionCards.spec.ts`, which is what caught the removal.
 *
 * The apparent contradiction with ROADMAP 1.267 (#501, `1ae760d3`) is not one:
 * #501's own prop doc scopes it to "the ordinal rank swatch, the crowned
 * border, and the leader colour on the 'Hits target' bar. Never the values
 * themselves." Styling designations, not this sentence.
 *
 * Consequence for 2.237: the appended pick printing this sentence on a withheld
 * run is 1.239's rule applying to a card that is now rendered — NOT a defect
 * this PR introduced. Whether 1.239 should be re-adjudicated is a live product
 * question, raised on the record rather than settled by a lane.
 */

describe('P1-1 (ROADMAP 2.237) — the lens control names HIGHLIGHTING, not ranking', () => {
  it('the lens PICK is rendered even when it falls outside the top-2 truncation', () => {
    // The p10 leader here is option-3, third by winProbability and therefore
    // behind "Show all (1 more)" before this fix. The panel names it; the panel
    // must therefore be able to show it.
    render(
      <OptionCards
        options={DISAGREEING}
        winnerId="option-1"
        lensActive
        lensHighlightedId="option-3"
      />,
    )
    expect(screen.getByTestId('option-card-option-3')).toBeInTheDocument()
    expect(screen.getByTestId('option-card-option-3')).toHaveTextContent(
      /Ahead on this outcome view/,
    )
  })

  it('"Show all" no longer offers an option that is already on screen', () => {
    render(
      <OptionCards
        options={DISAGREEING}
        winnerId="option-1"
        lensActive
        lensHighlightedId="option-3"
      />,
    )
    // All three are rendered, so there is nothing left to reveal.
    expect(screen.queryByText(/Show all \(1 more\)/)).not.toBeInTheDocument()
  })

  it('the APPENDED lens pick carries its TRUE rank, not its render position', () => {
    // ⚠ THIS TEST EXISTS BECAUSE A MUTATION CHECK CAUGHT ITS ABSENCE. Reverting
    // `sortedRank` to the map index (`index + 1`) left the whole suite green,
    // because on a three-option fixture the appended card's render position and
    // its true rank COINCIDE at 3. Four options separate them: the lens pick is
    // 4th by winProbability but renders 3rd.
    //
    // The rank is not printed as a numeral — it selects the card's colour
    // marker from `WIN_GAUGE_COLORS`, which is how the card, the WinGauge
    // legend and the scenario bar agree on which option is which. A fabricated
    // rank therefore paints an option in another option's colour.
    const four = [
      opt('option-1', 'Option A', 0.5, 10),
      opt('option-2', 'Option B', 0.3, 20),
      opt('option-3', 'Option C', 0.15, 30),
      opt('option-4', 'Option D', 0.05, 90), // p10 leader, 4th on winProbability
    ]
    render(
      <OptionCards options={four} winnerId="option-1" lensActive lensHighlightedId="option-4" />,
    )
    const marker = screen.getByTestId('rank-marker-option-4')
    // rank 4 → WIN_GAUGE_COLORS[3]; the render position (3) would give [2].
    expect(marker).toHaveStyle({ backgroundColor: WIN_GAUGE_COLORS[3] })
    expect(marker).not.toHaveStyle({ backgroundColor: WIN_GAUGE_COLORS[2] })
    // CONTROL — the untouched cards keep their own colours.
    expect(screen.getByTestId('rank-marker-option-1')).toHaveStyle({
      backgroundColor: WIN_GAUGE_COLORS[0],
    })
  })

  it('B1: the toggle is ABSENT when the appended pick leaves nothing hidden — never "Show all (0 more)"', () => {
    // ⚠ THIS PIN EXISTS BECAUSE THE FIRST FIX CREATED A FRESH FALSE CLAIM, on
    // this PR's own headline fixture. `hiddenCount` was correctly re-derived,
    // but the button's render condition was still `shouldTruncate` — so three
    // options with the pick appended rendered "Show all (0 more)", and clicking
    // it changed nothing: the card set was already complete and only the label
    // flipped to "Show fewer". A control that claims to reveal something and
    // reveals nothing is the exact defect class this PR exists to remove.
    //
    // Asserting ABSENCE of the control, not merely absence of the words "1
    // more" — the earlier pin below did the latter and passed straight over it.
    //
    // ⚠ `onSendMessage` IS PASSED DELIBERATELY, and a mutation check is why.
    // The toggle sits inside a wrapper gated on `(showToggle || onSendMessage)`.
    // Without `onSendMessage` the WRAPPER collapses whenever `showToggle` is
    // false, so the button is absent no matter what the inner condition says —
    // and reverting the inner condition left this pin GREEN. The live caller
    // (`ResultsBody`) always supplies `onSendMessage`, so in production the
    // wrapper is open and the inner gate is the load-bearing one. Testing the
    // shape the user actually gets is what makes this assertion able to fail.
    render(
      <OptionCards
        options={DISAGREEING}
        winnerId="option-1"
        lensActive
        lensHighlightedId="option-3"
        onSendMessage={() => {}}
      />,
    )
    expect(screen.queryByTestId('option-cards-toggle')).not.toBeInTheDocument()
    expect(screen.queryByText(/Show all/)).not.toBeInTheDocument()
    expect(screen.queryByText(/0 more/)).not.toBeInTheDocument()
    // POSITIVE CONTROL — all three cards ARE on screen, so there is genuinely
    // nothing left to reveal. Without this the assertion above could pass on a
    // component that rendered nothing at all.
    expect(screen.getByTestId('option-card-option-1')).toBeInTheDocument()
    expect(screen.getByTestId('option-card-option-2')).toBeInTheDocument()
    expect(screen.getByTestId('option-card-option-3')).toBeInTheDocument()
  })

  it('B1 OVER-SUPPRESSION CONTROL: "Show fewer" survives once expanded, when hiddenCount is 0 by construction', () => {
    // `showAllOptions ||` in the render condition is load-bearing: the bare
    // `hiddenCount > 0` predicate would delete this control and strand the user
    // in the expanded state with no way back.
    render(<OptionCards options={DISAGREEING} winnerId="option-1" />)
    const toggle = screen.getByTestId('option-cards-toggle')
    expect(toggle).toHaveTextContent('Show all (1 more)')
    fireEvent.click(toggle)
    expect(screen.getByTestId('option-cards-toggle')).toHaveTextContent('Show fewer')
    // And it still collapses.
    fireEvent.click(screen.getByTestId('option-cards-toggle'))
    expect(screen.getByTestId('option-cards-toggle')).toHaveTextContent('Show all (1 more)')
  })

  it('CONTROL: with no lens pick, truncation is unchanged (top 2 + "Show all (1 more)")', () => {
    render(<OptionCards options={DISAGREEING} winnerId="option-1" />)
    expect(screen.getByTestId('option-card-option-1')).toBeInTheDocument()
    expect(screen.getByTestId('option-card-option-2')).toBeInTheDocument()
    expect(screen.queryByTestId('option-card-option-3')).not.toBeInTheDocument()
    expect(screen.getByText(/Show all \(1 more\)/)).toBeInTheDocument()
  })

  it('the lens does NOT re-order: its pick is APPENDED, never promoted — which is why the copy may not claim a ranking', () => {
    // This is the fact the old copy contradicted, asserted directly so the copy
    // fix cannot drift away from the behaviour it describes.
    const { container } = render(
      <OptionCards
        options={DISAGREEING}
        winnerId="option-1"
        lensActive
        lensHighlightedId="option-3"
      />,
    )
    const order = Array.from(
      container.querySelectorAll('[data-testid^="option-card-"]'),
    ).map((n) => n.getAttribute('data-testid'))

    // winProbability order throughout; the p10 leader is LAST, not first.
    expect(order).toEqual([
      'option-card-option-1',
      'option-card-option-2',
      'option-card-option-3',
    ])
    expect(order[0]).not.toBe('option-card-option-3')
  })
})

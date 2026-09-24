/**
 * THE PROMOTED CARD REFERENCES THE ITEM — IT DOES NOT REPRINT IT.
 *
 * ── THE DEFECT, AS WITNESSED ───────────────────────────────────────────────
 * Paul's 6 Sep capture of the Reasoning tab (staging `acd3db4d`) shows one
 * producer paragraph — ~40 words, opening "The brief asks only 'whether to
 * hire a Tech lead or two developers,'…" — printed TWICE within one scroll:
 * once on the glance's promoted card, once as item 2 of "Strengthen the
 * reasoning" under the title "Narrow framing". Nothing on either rendering
 * said they were the same finding, so the tab appeared to report two.
 *
 * ── THE DERIVATION: ONE SOURCE, NOT TWO PRODUCERS ──────────────────────────
 * Not the "named apart" case. Both surfaces render ONE `Recommendation`
 * object out of ONE array:
 *   - `glancePrimary` picks from `vm.strengthen.interventions`;
 *   - `selectAlsoWorthDoing` returns that SAME array unchanged (pinned by
 *     `theFocusCardIsDeliberatelyRepeatedBelow.spec.tsx`);
 *   - the glance printed `glancePrimary.signal`, and the row prints
 *     `strengthenWhyLine(rec.signal, rec.whyNow)` — whose every arm begins
 *     with `signal`. So `signal` was rendered on both surfaces, always.
 *
 * ── WHY NOT SIMPLY DROP ONE ────────────────────────────────────────────────
 * Removing the promoted recommendation from the list below was tried and
 * REFUTED by independent review — see the sibling spec named above. Dismiss
 * is the only thing that advances `glancePrimary`, so excluding the row makes
 * dismiss unreachable and pins one recommendation to the top for the life of
 * the run. That ruling stands and its guard is untouched: the item STAYS in
 * the list, with every affordance it had.
 *
 * What changed is the PROMOTED card. It no longer receives the finding's prose
 * at all — `AtAGlanceProps.primaryIntervention` carries `title` where it
 * carried `why` — so it names the item it points at ("Narrow framing") and the
 * action it runs ("Work through with Olumi"), and the paragraph, the severity,
 * the grounding, the source line, "I disagree" and "Not relevant" are rendered
 * once, in the row. Dropping the field rather than merely not rendering it is
 * deliberate: it makes the reprint unavailable to a future edit rather than
 * merely absent from this one.
 *
 * ── SCOPE OF THE ASSERTIONS BELOW ──────────────────────────────────────────
 * Two fixtures, both driven through the real `AnalysisNewTabBody`, the real
 * view model and the real recommendation engine. They bind the promoted row by
 * `data-recommendation-id` — IDENTITY, never a value another row could match.
 *
 * ── ⭐ REASONING V2 (24 Sep 2026) ───────────────────────────────────────────
 * The promoted card is now `ChallengeCard` (`analysis-new-challenge`), and the
 * list below is `ModelReviewTool`'s queue, which EXCLUDES the card's finding
 * (`excludeId`). The reason the old ruling kept the row — dismiss was reachable
 * only from the row — is met on the card itself ("Not useful right now"), so
 * the V2 claim is: ONE home for the finding, which NAMES it at rest (heading =
 * `rec.title`, verbatim, for every kind) and keeps the paragraph and its source
 * behind "Why this?" on the same card. The catalogue/producer split in the
 * first case below is RETIRED (X): V2 renders both kinds the same way.
 * ⛔ The second case ("every disagreement affordance survives") is NOT
 * re-pointed: V2 offers no "I disagree" anywhere on this tab (reported).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { REVIEW_TOOL_COPY } from '../buildReviewQueue'
import { genuineDecision, openStrategicChallenge } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

/**
 * Every text node the promoted card prints, kept SEPARATE. Reading
 * `textContent` off the card would concatenate the label, the method chip and
 * the detail line into one string that matches nothing, which is a detector
 * that cannot fire.
 */
const textChunks = (el: HTMLElement): string[] => {
  const out: string[] = []
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node: Node | null = walk.nextNode()
  while (node) {
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim()
    if (text) out.push(text)
    node = walk.nextNode()
  }
  return out
}

/**
 * The chunks of `chunks` that the row's paragraph also carries. `includes`
 * rather than `startsWith` on purpose: `signal` happens to be a PREFIX of
 * `strengthenWhyLine`'s output today, and a detector keyed on that accident
 * would go quiet the moment the card reprinted the other half instead.
 *
 * `minWords` is what separates prose from a shared word — a card naming its
 * item and a paragraph about that item legitimately share nouns.
 */
export const reprintedChunks = (chunks: string[], rowWhy: string, minWords = 5): string[] =>
  chunks.filter((c) => c.split(/\s+/).length >= minWords && rowWhy.includes(c))

const REAL_PARAGRAPH =
  "The brief asks only 'whether to hire a Tech lead or two developers,' framing the entire decision as a binary hiring choice."

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_abc123"
    />,
  )


afterEach(() => cleanup())

describe('THE INSTRUMENT — the detector fires on a reprint and stays quiet on a reference', () => {
  it('POSITIVE CONTROL: a card that reprints the paragraph is flagged', () => {
    expect(reprintedChunks([REAL_PARAGRAPH], `${REAL_PARAGRAPH} Resolving it helps.`)).toEqual([
      REAL_PARAGRAPH,
    ])
  })

  it('POSITIVE CONTROL: a reprint of the paragraph’s TAIL is flagged too', () => {
    // Guards the `includes`-not-`startsWith` choice above: a card printing the
    // second half of the row's line is reprinting just as surely.
    const tail = 'framing the entire decision as a binary hiring choice.'
    expect(reprintedChunks([tail], REAL_PARAGRAPH)).toEqual([tail])
  })

  it('NEGATIVE CONTROL: a card that NAMES the item is not flagged', () => {
    expect(reprintedChunks(['Narrow framing', 'Work through with Olumi'], REAL_PARAGRAPH)).toEqual(
      [],
    )
  })
})

describe.each([
  ['openStrategicChallenge', openStrategicChallenge],
  ['genuineDecision', genuineDecision],
])('the promoted card does not reprint its row (%s)', (_name, fixture) => {
  it('names the item and leaves the finding to the row', () => {
    renderBody(fixture())

    // AT REST — nothing opened. The card is what a reader meets without a click.
    const card = screen.getByTestId('analysis-new-challenge')
    const promotedId = card.getAttribute('data-recommendation-id')
    expect(promotedId, 'no promoted recommendation — this case would be vacuous').toBeTruthy()
    expect(card).toHaveAttribute('data-source', 'intervention')
    const atRest = textChunks(card)
    const heading = screen.getByTestId('analysis-new-challenge-heading').textContent?.trim()
    expect(heading, 'the card must NAME the item it points at').toBeTruthy()

    // ⭐ ONE HOME, BY IDENTITY: the finding the card promotes is not offered a
    // second time in the review queue below (V2's `excludeId`). Paged in full.
    const queued: string[] = []
    const toggle = screen.queryByTestId('analysis-new-review-toggle')
    if (toggle !== null) {
      fireEvent.click(toggle)
      const next = () => screen.getByTestId('analysis-new-review-next') as HTMLButtonElement
      for (let guard = 0; guard < 50; guard += 1) {
        queued.push(screen.getByTestId('analysis-new-review-item').getAttribute('data-review-key') ?? '')
        if (next().disabled) break
        fireEvent.click(next())
      }
    }
    expect(queued, 'the promoted finding is printed twice again').not.toContain(promotedId)

    // …and the protection the old "keep it in the list" ruling bought is on
    // the card itself: the reader can still retire it, which advances the card.
    fireEvent.click(screen.getByTestId('analysis-new-challenge-more'))
    expect(screen.getByTestId('analysis-new-challenge-not-useful')).toBeInTheDocument()

    // The finding's paragraph is REACHABLE on the same card — "Why this?".
    fireEvent.click(screen.getByTestId('analysis-new-challenge-why'))
    const why = (screen.getByTestId('analysis-new-challenge-basis-why').textContent ?? '')
      .replace(/\s+/g, ' ')
      .trim()

    // PRECONDITION, pinned on THIS payload: the detector does fire on the
    // paragraph. Without it a green result below could come from a paragraph
    // too short for any chunk to reach `minWords`.
    expect(
      reprintedChunks([why], why),
      'the detector did not fire on the finding’s own text — it is not discriminating here',
    ).not.toEqual([])

    // THE RULING, HALF ONE — at rest the card does not reprint the paragraph.
    expect(reprintedChunks(atRest, why)).toEqual([])
    // THE RULING, HALF TWO — and it does name it: a non-empty heading (above)
    // that is neither the paragraph nor a reprint of any part of it.
    expect(heading).not.toBe(why)
    expect(reprintedChunks([heading!], why)).toEqual([])
  })

  it('every disagreement affordance survives on the promoted item (V2: the Challenge card)', async () => {
    // The product thesis rendered: the human is the author, not the recipient.
    // V2 moved the promoted item to the Challenge card (the review queue
    // excludes it), so the card itself must carry the disagreement acts.
    const { openAskOlumi } = await import('../../coaching/askOlumiStore')
    vi.mocked(openAskOlumi).mockClear()
    renderBody(fixture())
    const card = screen.getByTestId('analysis-new-challenge')
    const promotedId = card.getAttribute('data-recommendation-id')
    expect(promotedId, 'PRECONDITION: a promoted finding').toMatch(/^strengthen:/)
    fireEvent.click(within(card).getByTestId('analysis-new-challenge-more'))
    expect(screen.getByTestId('analysis-new-challenge-why')).toBeInTheDocument()
    expect(screen.getByTestId('analysis-new-challenge-not-useful')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('analysis-new-challenge-disagree'))
    expect(vi.mocked(openAskOlumi)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(openAskOlumi).mock.calls[0][0].label).toBe(REVIEW_TOOL_COPY.disagree)
  })
})

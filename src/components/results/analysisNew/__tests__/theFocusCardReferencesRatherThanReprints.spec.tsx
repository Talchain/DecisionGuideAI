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
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
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

const openAllSections = () => {
  for (const toggle of Array.from(
    document.querySelectorAll<HTMLElement>('[data-testid$="-toggle"]'),
  )) {
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  }
  const more = screen.queryByTestId('analysis-new-strengthen-show-more')
  if (more) fireEvent.click(more)
}

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
    openAllSections()

    const glance = screen.getByTestId('analysis-new-glance-primary-intervention')
    const promotedId = glance.getAttribute('data-recommendation-id')
    expect(promotedId, 'no promoted recommendation — this case would be vacuous').toBeTruthy()

    // IDENTITY, not a value predicate: the row is the one carrying the SAME
    // engine id as the promoted card, never the one whose text looks similar.
    const row = screen
      .getAllByTestId('analysis-new-strengthen-item')
      .find((r) => r.getAttribute('data-recommendation-id') === promotedId)
    expect(row, 'the promoted recommendation must still be in the list below').toBeTruthy()

    const rowWhy = (
      within(row!).getByTestId('analysis-new-strengthen-why').textContent ?? ''
    )
      .replace(/\s+/g, ' ')
      .trim()

    // PRECONDITION, pinned on THIS payload: the detector does fire on the row's
    // own paragraph. Without it a green result below could come from a row
    // whose paragraph is too short for any chunk to reach `minWords`.
    expect(
      reprintedChunks([rowWhy], rowWhy),
      'the detector did not fire on the row’s own text — it is not discriminating here',
    ).not.toEqual([])

    // THE RULING.
    expect(reprintedChunks(textChunks(glance), rowWhy)).toEqual([])
  })

  it('every disagreement affordance survives on the promoted row', () => {
    // The product thesis rendered: the human is the author, not the recipient.
    // Whatever the promoted card drops, these must stay reachable.
    renderBody(fixture())
    openAllSections()
    const promotedId = screen
      .getByTestId('analysis-new-glance-primary-intervention')
      .getAttribute('data-recommendation-id')
    const row = screen
      .getAllByTestId('analysis-new-strengthen-item')
      .find((r) => r.getAttribute('data-recommendation-id') === promotedId)
    expect(row).toBeTruthy()
    expect(within(row!).getByTestId('analysis-new-strengthen-disagree')).toBeInTheDocument()
    expect(within(row!).getByTestId('analysis-new-strengthen-dismiss')).toBeInTheDocument()
    expect(within(row!).getByTestId('analysis-new-strengthen-source')).toBeInTheDocument()
  })
})

/**
 * One chip per link (DL 8 Nov, V11 #13; core API v1.30 `collab.link_marks`, olumi-core PR #22 41765715): core's one chip for a link members
 * doubt or keep, on its line (`line`) or on the card that folds it (`line: false`, `card`), replacing TM-04's chip on both of the link's cards.
 * Fixtures are core's own output, never written here:
 * - `linechip/cara.*`: Cara's View and differences from the zero-call core 42dbc844 (candidate 6f6b2b0e, PR #22 merged, plus `collab.link_route`), on a COPY of the seeded consulting board (Ana and
 *   Cara each doubted one of the two links into "Time to first customer payment"; Ben and Dan kept them; ~/olumi-work/tm04-chip). Both links
 *   are lines, so both chips are line marks.
 * - `disagree/x2-stances.*`: core's own (the X2 lane's link-stance rows, DGAI wip/disagree-ui): Bea doubts and Ada keeps 'Add one specialist'
 *   → 'team morale', an influence the board folds into the add_one card's badge, so its chip is folded onto that card.
 * The line itself is ../../olumiView/__tests__/lineChip.spec.tsx's.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { CARD_WIDTH } from '../../olumiView/layout'
import { useReveal } from '../../olumiView/reveal'
import { CardViewChips } from '../../olumiView/RevealMarks'
import { StrategyChips } from '../../olumiView/strategy/StrategyChips'
import { useUIStore } from '../../stores/uiStore'
import { setTeamFetch } from '../team/api'
import { resetDifferences, useDifferences, type Differences } from '../team/differences'
import { foldedMarksOn, lineMarkOf, linkKeyOf, linkMarksOf, placedKeysOf } from '../team/LinkMarks'

const FX = path.resolve('src/olumiView/fixtures')
const read = <T,>(f: string): T => JSON.parse(readFileSync(path.join(FX, f), 'utf8')) as T
const pr22 = read<View>('linechip/cara.view3.json'), pr22Diff = read<Differences>('linechip/cara.differences.core.json')
const x2 = read<View>('disagree/x2-stances.view3.json'), x2Diff = read<Differences>('disagree/x2-stances.differences.core.json')
const withoutMarks = (v: View): View => ({ ...v, collab: { ...v.collab, link_marks: undefined } })

let answer: Differences = pr22Diff
beforeEach(() => {
  setTeamFetch((async (url: string) => (String(url).endsWith('/differences')
    ? new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })
    : new Response(JSON.stringify({ error: 'not here' }), { status: 404, headers: { 'content-type': 'application/json' } }))) as unknown as typeof fetch)
  useReveal.setState({ selected: null, card: null, evidence: null, chip: null })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetDifferences(); vi.restoreAllMocks() })

const show = (view: View, diff: Differences, at: number | null = null) => {
  answer = diff
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000000', sid: view.id, view, status: 'ready', error: null, stale: false, at })
}
/** Each card's rail portal as v10.tsx fills it (CardViewChips, then StrategyChips). */
const rails = (cards: readonly string[]) =>
  render(<>{cards.map((k) => <div key={k} data-card={k}><CardViewChips card={k} /><StrategyChips card={k} /></div>)}</>).container
const railsOf = (c: HTMLElement, card: string) => c.querySelectorAll(`[data-card="${card}"] [data-testid^="reveal-chips-"], [data-card="${card}"] [data-testid^="strategy-chips-"]`)

describe('core\'s one chip per link: which link, keyed on records', () => {
  it('core\'s own output: each mark\'s key is core\'s record for that link in the differences, and its place is a line or a card', () => {
    const lines = linkMarksOf(pr22), folded = linkMarksOf(x2)
    expect(lines.map((m) => [linkKeyOf(m.link), m.line, m.card, m.text])).toEqual([
      ['link:first_cash_timing:time_to_contract', true, null, 'Ana doubts this link'],
      ['link:first_cash_timing:contract_to_cash', true, null, 'Cara doubts this link'],
    ])
    expect(folded.map((m) => [linkKeyOf(m.link), m.line, m.card, m.text])).toEqual([['link:morale_link', false, 'add_one', 'Bea doubts this link']])
    // Bound to core's differences: the same link has the same record there (debate.ts:359), so the two are matched on records.
    for (const [m, d] of [...lines.map((x) => [x, pr22Diff] as const), ...folded.map((x) => [x, x2Diff] as const)]) {
      expect(d.differences.some((e) => e.kind === 'link' && e.record === linkKeyOf(m.link))).toBe(true)
    }
  })

  it('a line mark is on the line that holds its link, once; a part of the same record is another link', () => {
    const links = pr22.model!.links
    const on = links.map((_, i) => lineMarkOf(pr22, i)?.text ?? null)
    expect(on.flatMap((t, i) => (t === null ? [] : [[i, t]]))).toEqual([[0, 'Ana doubts this link'], [1, 'Cara doubts this link']])
    // CONTRAST: the same record with the other part is the other link's chip, never this one's.
    const swapped = structuredClone(pr22)
    swapped.model!.links[0]!.holds = { record: 'first_cash_timing', part: 'contract_to_cash' }
    expect([lineMarkOf(swapped, 0)?.text, lineMarkOf(swapped, 1)?.text]).toEqual(['Cara doubts this link', undefined])
    // A folded mark is on its card, never on a line.
    expect(x2.model!.links.map((_, i) => lineMarkOf(x2, i))).toEqual(x2.model!.links.map(() => null))
    expect(foldedMarksOn(x2, 'add_one').map((m) => m.text)).toEqual(['Bea doubts this link'])
    expect(foldedMarksOn(x2, 'one_specialist')).toEqual([])
    expect([...placedKeysOf(pr22)]).toEqual(['link:first_cash_timing:time_to_contract', 'link:first_cash_timing:contract_to_cash'])
    expect([...placedKeysOf(x2)]).toEqual(['link:morale_link'])
  })

  it('catch: a mark whose words are not words, or a second mark for one link, is never drawn; a mark with no place here is not placed', () => {
    const drift = structuredClone(pr22)
    const marks = drift.collab.link_marks!
    ;(marks[0] as { text: unknown }).text = { words: 'not text' }
    marks.push({ ...marks[1]!, text: 'A second chip' })
    expect(linkMarksOf(drift).map((m) => m.text)).toEqual(['Cara doubts this link'])
    const nowhere = structuredClone(x2)
    nowhere.collab.link_marks![0]!.card = 'not_on_this_board'
    expect([...placedKeysOf(nowhere)]).toEqual([])
  })
})

describe('the chip replaces TM-04\'s card chip for its link', () => {
  const ends = ['time_to_contract', 'contract_to_cash', 'time_to_first_cash']

  it('HIGH: where core gives a line mark, the link\'s card chips are not drawn: one chip per link, on its line', async () => {
    show(pr22, pr22Diff)
    const c = rails(ends)
    // Once core's differences are read (they name both links, on both their cards), no card carries a chip of a link.
    await waitFor(() => expect(useDifferences.getState().data?.differences.length).toBe(pr22Diff.differences.length))
    await new Promise((r) => setTimeout(r, 0))
    expect(c.querySelector('[data-card="contract_to_cash"] [data-reveal-card-chip]')).not.toBeNull()
    expect(c.querySelectorAll('[data-differ-chip], [data-link-mark]').length).toBe(0)
    // CONTRAST: the same differences with a View that has no link marks (an older core): TM-04's chips, on both cards of each link.
    cleanup(); resetDifferences()
    show(withoutMarks(pr22), pr22Diff)
    const old = rails(ends)
    await waitFor(() => expect(old.querySelectorAll('[data-differ-chip]').length).toBe(4))
    expect([...old.querySelectorAll('[data-differ-chip]')].map((e) => e.querySelector('[data-differ-chip-text]')?.textContent)).toEqual(
      ['Ana doubts this link', 'Cara doubts this link', 'Ana doubts this link', 'Cara doubts this link'])
  })

  it('HIGH: a folded mark is on the card that folds its link, once, in core\'s words: the chip on its face; the stances, what the model cannot calculate and the question on hover and in its name', async () => {
    show(x2, x2Diff)
    const m = linkMarksOf(x2)[0]!
    const c = rails(x2.model!.cards.map((k) => k.id))
    await waitFor(() => expect(c.querySelectorAll('[data-link-mark]').length).toBe(1))
    const chip = c.querySelector('[data-card="add_one"] [data-link-mark="link:morale_link"]')!
    expect(chip).not.toBeNull()
    expect(chip.getAttribute('data-link-mark-at')).toBe('add_one')
    expect(railsOf(c, 'add_one').length).toBe(1) // in the card's one rail
    // Its face is core's chip, whole: no initials, nothing cut.
    expect([...chip.querySelectorAll(':scope > span:not(.sr-only)')].map((e) => e.textContent).join('')).toBe('Bea doubts this link')
    expect(chip.querySelector('.truncate')).toBeNull()
    // On hover: each stance in its holder's words, what the model cannot calculate, then the closing question; each core's, whole.
    expect(chip.getAttribute('title')).toBe([m.title, m.status_text, m.question].join('\n'))
    expect(m.reading).toBeNull()
    // Its name: the chip, then the same three, each whole and apart.
    expect(chip.textContent).toBe([m.text, m.label, m.status_text, m.question].join(' '))
    // One chip for the link: TM-04's chip from the differences is not drawn as well.
    expect(c.querySelectorAll('[data-differ-chip]').length).toBe(0)
    // CONTRAST: without link marks (an older core) the same link is TM-04's chip on the same card.
    cleanup(); resetDifferences()
    show(withoutMarks(x2), x2Diff)
    const old = rails(x2.model!.cards.map((k) => k.id))
    await waitFor(() => expect(old.querySelectorAll('[data-differ-chip]').length).toBe(1))
    expect(old.querySelector('[data-card="add_one"] [data-differ-chip="link:morale_link"] [data-differ-chip-text]')?.textContent).toBe('Bea doubts this link')
    expect(old.querySelector('[data-link-mark]')).toBeNull()
  })

  it('a rail holding a folded chip is its card\'s width and wraps, the chip at its natural width; selecting it opens the Team tab', async () => {
    show(x2, x2Diff)
    const open = vi.spyOn(useUIStore.getState(), 'forceActivateOutputTab')
    const c = rails(['add_one'])
    await waitFor(() => expect(c.querySelector('[data-link-mark]')).not.toBeNull())
    const r = railsOf(c, 'add_one')[0] as HTMLElement
    expect([r.style.width, r.style.marginLeft]).toEqual([`${CARD_WIDTH}px`, ''])
    expect(r).toHaveClass('flex-wrap')
    const chip = c.querySelector('[data-link-mark]')!
    expect(chip).toHaveClass('flex-none')
    expect(chip).not.toHaveClass('min-w-0')
    fireEvent.click(chip)
    expect(open).toHaveBeenCalledWith('team')
  })

  it('catch: on an earlier version nothing of a link is drawn, and nothing is read for it', async () => {
    // CONTRAST: on the version shown, the folded chip is drawn.
    show(x2, x2Diff)
    const now = rails(['add_one'])
    await waitFor(() => expect(now.querySelector('[data-link-mark]')).not.toBeNull())
    cleanup(); resetDifferences()
    show(x2, x2Diff, 1)
    const c = rails(['add_one'])
    await new Promise((r) => setTimeout(r, 0))
    expect(c.querySelectorAll('[data-link-mark], [data-differ-chip]').length).toBe(0)
    expect(useDifferences.getState().key).toBeNull()
  })
})

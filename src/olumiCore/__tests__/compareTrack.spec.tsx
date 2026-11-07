/**
 * The crafted compare interface on the olumi-core lane (UI session for Paul, 7 Nov): the earlier DGAI's shift track (PairChanceSlope's
 * `PairChanceTrack`) drawn from core's own numbers, and every word core's (core wip/compare a0397172: ResultMove `label`/`move_text`,
 * versions `who`, Cell and ResultSide `chance`).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ComparedLists, type Compared } from '../compare'
import { ScenarioComparisonView, type ScenarioComparison } from '../scenarioCompare'

afterEach(() => cleanup())

const CORE: Compared = {
  versions: [{ n: 1, at: 't1', proposedBy: 'Olumi', briefBy: 'Ada', approvedBy: 'Ada', who: 'CORE-WHO-1' }, { n: 2, at: 't2', proposedBy: 'Ada', briefBy: null, approvedBy: 'Ada', who: 'CORE-WHO-2' }],
  changes: [],
  results: [
    { kind: 'chance', option: 'hire', optionLabel: 'Add one specialist', aim: 'At least 100 a week', condition: null, move: 'up', label: 'CORE-LABEL', move_text: 'CORE-MOVE',
      before: { value: 'about 50%', title: 't', olumi: null, chance: 0.5 }, after: { value: 'about 90%', title: 't', olumi: null, chance: 0.9 } },
    { kind: 'most_likely', option: null, optionLabel: null, aim: 'At least 100 a week', condition: null, move: 'unchanged', label: 'CORE-LEAD', move_text: 'CORE-SAME',
      before: { value: "'Add one specialist'", title: 't', olumi: null, chance: null }, after: { value: "'Add one specialist'", title: 't', olumi: null, chance: null } },
  ],
}

describe('the version compare: core says every word; the shift track sits where core\'s numbers put it', () => {
  it("draws core's label, move and who verbatim, never the page's own sentence; one track for the chance, none for the most-likely line", () => {
    const { container } = render(<ComparedLists c={CORE} boxed />)
    const text = container.textContent!
    for (const w of ['CORE-WHO-1', 'CORE-WHO-2', 'CORE-LABEL', 'CORE-MOVE', 'CORE-LEAD', 'CORE-SAME']) expect(text).toContain(w)
    expect(text).not.toContain('‘Add one specialist’ on ‘At least 100 a week’')
    expect(text).not.toContain('approved by Ada')
    const tracks = [...container.querySelectorAll('[data-compare-track]')]
    expect(tracks.map((t) => [t.getAttribute('data-first'), t.getAttribute('data-second')])).toEqual([['50', '90']])
    expect([...container.querySelectorAll('[data-compare-key]')].map((e) => e.textContent)).toEqual(['Version 1', 'Version 2'])
    expect(tracks[0]!.querySelectorAll('[data-mark="earlier"]').length + tracks[0]!.querySelectorAll('[data-mark="now"]').length).toBe(2)
  })
  it("an older core without the words or numbers: the page's same words as before, and no track (never a mark at 0%)", () => {
    const old = { ...CORE, versions: CORE.versions.map(({ who: _w, ...v }) => v), results: [{ ...CORE.results[0]!, label: undefined, move_text: undefined,
      before: { value: 'about 50%', title: 't', olumi: null }, after: { value: 'about 90%', title: 't', olumi: null } }] } as Compared
    const { container } = render(<ComparedLists c={old} boxed />)
    expect(container.textContent).toContain('‘Add one specialist’ on ‘At least 100 a week’')
    expect(container.textContent).toContain('(up)')
    expect(container.querySelector('[data-compare-track]')).toBeNull()
    expect(container.querySelector('[data-compare-track-key]')).toBeNull()
  })
})

const cell = (value: string, chance: number | null) => ({ value, title: 'T', olumi: null, lead: null, condition: null, chance })
const PAIR = (a: number | null, b: number | null): ScenarioComparison => ({
  schema: 'olumi.compare/1',
  a: { id: 's_a', title: 'Rota', name: 'Rota', note: null, kind: 'scenario', about: null },
  b: { id: 'w_7', title: 'Busier week', name: 'Busier week (what-if)', note: null, kind: 'whatif', about: 'A' },
  aims: [{ label: 'Reach 100', kind: 'aim', status: 'comparable', limitation: null, only_in_text: null, a: { label: 'Reach 100', measure: 'M', target: null }, b: { label: 'Reach 100', measure: 'M', target: null },
    options: [{ label: 'Add one specialist', only_in: null, only_in_text: null, a: { cells: [cell('about 50%', a)] }, b: { cells: [cell('about 90%', b)] } },
      { label: 'Hire two', only_in: 'a', only_in_text: 'Only in ‘Rota’', a: { cells: [cell('about 70%', 0.7)] }, b: null }] }],
  differences: { options: [], figures: [] }, limits: [],
})

describe('two sides side by side: the shift track for each paired option', () => {
  it("hollow for the first side, filled for the second, at core's numbers; the key names the sides as core names them; an unpaired option gets none", () => {
    const { container } = render(<ScenarioComparisonView c={PAIR(0.5, 0.9)} />)
    expect([...container.querySelectorAll('[data-compare-track]')].map((t) => [t.getAttribute('data-first'), t.getAttribute('data-second')])).toEqual([['50', '90']])
    expect([...container.querySelectorAll('[data-compare-key]')].map((e) => e.textContent)).toEqual(['Rota', 'Busier week (what-if)'])
    expect(container.textContent).not.toMatch(/\b(best|winner|recommend|better|worse|ahead|leads)\b/i)
  })
  it('a side core gives no number for has no mark; with no number on either side there is no track and no key', () => {
    const one = render(<ScenarioComparisonView c={PAIR(null, 0.9)} />)
    expect([...one.container.querySelectorAll('[data-compare-track]')].map((t) => [t.getAttribute('data-first'), t.getAttribute('data-second')])).toEqual([['', '90']])
    cleanup()
    const none = render(<ScenarioComparisonView c={PAIR(null, null)} />)
    expect(none.container.querySelector('[data-compare-track]')).toBeNull()
    expect(none.container.querySelector('[data-compare-track-key]')).toBeNull()
  })
})

describe("each chance as its option card draws it: core's headline, then the card's short companion line", () => {
  const LONG = "about 13% (about 16% without Olumi's suggested risk assumption 'Late payment')"
  const COMP = { text: "about 16% without Olumi's suggested risk", title: "about 16% without Olumi's suggested risk assumption 'Late payment'" }
  it("side by side: the headline in the cell's value, the companion beneath it with its sentence as hover; never the whole long value", () => {
    const c = PAIR(0.13, 0.47)
    const opt = (c.aims[0]!.options as unknown as { a: { cells: Record<string, unknown>[] } }[])[0]!
    opt.a.cells[0] = { ...cell(LONG, 0.13), headline: 'about 13%', companion: COMP }
    const { container } = render(<ScenarioComparisonView c={c} />)
    const first = container.querySelector('[data-compare-cells]')!
    expect(first.querySelector('[data-compare-value]')!.textContent).toBe('about 13%')
    expect([first.querySelector('[data-compare-companion]')!.textContent, first.querySelector('[data-compare-companion]')!.getAttribute('title')]).toEqual([COMP.text, COMP.title])
    expect(container.textContent).not.toContain(LONG)
  })
  it('version compare: the headline, then the companion in light words; an older core draws its value as before', () => {
    const withSplit = { ...CORE, results: [{ ...CORE.results[0]!, before: { value: LONG, title: 't', olumi: null, chance: 0.13, headline: 'about 13%', companion: COMP } }] } as Compared
    const { container } = render(<ComparedLists c={withSplit} boxed />)
    const li = container.querySelector('[data-testid="team-compare-results"] li')!
    expect(li.textContent).toContain(`about 13% (${COMP.text})`)
    expect(li.textContent).not.toContain(LONG)
  })
})

/**
 * The crafted compare interface on the olumi-core lane (UI session for Paul, 7 Nov): the earlier DGAI's shift track (PairChanceSlope's
 * `PairChanceTrack`) drawn from core's own numbers, and every word core's (core wip/compare a0397172: ResultMove `label`/`move_text`,
 * versions `who`, Cell and ResultSide `chance`).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ComparedLists, CoreCompare, type Compared } from '../compare'
import { ScenarioComparisonView, type ScenarioComparison } from '../scenarioCompare'
import { setTeamFetch } from '../team/api'

afterEach(() => { cleanup(); setTeamFetch(null) })

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


// ── UI audit of e646e3a8 (UI session, 7 Nov): the rows read the real marks the track draws, never ShiftTrack's own props ──────────────────
/** Where a drawn mark sits, as a percentage of the track: read from the mark's own style (PanelFigure markerLeft), never from a data attribute. */
// The mark's own place is `calc(<n>% - 5.5px)` (half its 11px width), inside clamp(0px, …, calc(100% - 11px)); the bound is not the place.
const placed = (el: Element | null) => { const m = /calc\(([\d.]+)% - 5\.5px\)/.exec(el?.getAttribute('style') ?? ''); return m ? Number(m[1]) : null }
/** An option's own row inside an aim's own section, by the aim's and the option's exact labels. */
const rowOf = (c: HTMLElement, aim: string, option: string) => [...[...c.querySelectorAll<HTMLElement>('[data-compare-aim]')].find((e) => e.getAttribute('aria-label') === aim)!
  .querySelectorAll<HTMLElement>('[data-compare-option]')].find((r) => r.querySelector('p')!.textContent === option)!
const opt = (label: string, a: number | null, b: number | null) => ({ label, only_in: null, only_in_text: null, a: { cells: [{ ...cell(`A ${label} ${a}`, a), headline: `A ${a}` }] }, b: { cells: [{ ...cell(`B ${label} ${b}`, b), headline: `B ${b}` }] } })
const aimOf = (label: string, status: string, options: unknown[]) => ({ label, kind: 'aim', status, limitation: null, only_in_text: null, a: { label, measure: 'M', target: 'T1' }, b: { label, measure: 'M', target: 'T2' }, options })
const WITH = (aims: unknown[]): ScenarioComparison => ({ ...PAIR(0.5, 0.9), aims: aims as never })

describe('UI audit: each track is its own option\'s, with the first side hollow and the second filled, at core\'s numbers', () => {
  it('two aims, two options each, distinct numbers: every hollow mark sits at its first side\'s number, every filled mark at its second side\'s, each named', async () => {
    const { container } = render(<ScenarioComparisonView c={WITH([aimOf('Revenue', 'comparable', [opt('Consult', 0.12, 0.47), opt('Diagnostic', 0.49, 0.55)]), aimOf('Pipeline', 'comparable', [opt('Consult', 0.75, 0.3), opt('Diagnostic', 0.05, 0.95)])])} />)
    const want: [string, string, number, number][] = [['Revenue', 'Consult', 12, 47], ['Revenue', 'Diagnostic', 49, 55], ['Pipeline', 'Consult', 75, 30], ['Pipeline', 'Diagnostic', 5, 95]]
    for (const [aim, option, a, b] of want) {
      const row = rowOf(container, aim, option), track = row.querySelector('[data-compare-track]')!
      expect(placed(track.querySelector('[data-mark="earlier"]')), `${aim}/${option} hollow`).toBe(a)
      await waitFor(() => expect(placed(track.querySelector('[data-mark="now"]')), `${aim}/${option} filled`).toBe(b))
      expect(track.getAttribute('aria-label')).toBe(`Rota: A ${a / 100}; Busier week (what-if): B ${b / 100}`)
    }
  })
  it('a different target: no track and no key, since two chances of different targets are not one chance moving', () => {
    const { container } = render(<ScenarioComparisonView c={WITH([aimOf('Revenue', 'different_target', [opt('Consult', 0.12, 0.47)])])} />)
    expect(container.querySelector('[data-compare-track]')).toBeNull()
    expect(container.querySelector('[data-compare-track-key]')).toBeNull()
  })
  it('an older core (cells with no chance, headline or companion at all): the whole value in today\'s look, no companion, no track, no key', () => {
    const old = { value: 'about 13% (about 16% without Olumi\'s suggested risk)', title: 'T', olumi: null, lead: null, condition: null }
    const c = WITH([aimOf('Revenue', 'comparable', [{ label: 'Consult', only_in: null, only_in_text: null, a: { cells: [old] }, b: { cells: [old] } }])])
    const { container } = render(<ScenarioComparisonView c={c} />)
    const v = container.querySelector('[data-compare-value]')!
    expect([v.textContent, v.getAttribute('class')]).toEqual([old.value, null])
    expect([container.querySelector('[data-compare-companion]'), container.querySelector('[data-compare-track]'), container.querySelector('[data-compare-track-key]')]).toEqual([null, null, null])
  })
  it('a chance of exactly 0 is a mark at 0%; a number that is not one draws none', () => {
    const { container } = render(<ScenarioComparisonView c={WITH([aimOf('Revenue', 'comparable', [opt('Consult', 0, Number.NaN)])])} />)
    const track = rowOf(container, 'Revenue', 'Consult').querySelector('[data-compare-track]')!
    expect([placed(track.querySelector('[data-mark="earlier"]')), track.querySelector('[data-mark="now"]')]).toEqual([0, null])
  })
})

describe('UI audit item 1: versions picked later-first are asked earlier-first, and the key follows core\'s own order', () => {
  it('Earlier = 3, Later = 2: asked as from=2&to=3; the hollow mark is version 2\'s number and the key says so', async () => {
    const asked: string[] = []
    // Core's answer for 2 → 3, as core gives it whatever order it is asked in (core service.ts compare: [lo, hi]).
    const answer: Compared = { versions: [{ n: 2, at: 't2', proposedBy: 'Ada', briefBy: null, approvedBy: 'Ada', who: 'W2' }, { n: 3, at: 't3', proposedBy: 'Ada', briefBy: null, approvedBy: 'Ada', who: 'W3' }],
      changes: [], results: [{ kind: 'chance', option: 'hire', optionLabel: 'Hire', aim: 'Aim', condition: null, move: 'up', label: 'L', move_text: 'up',
        before: { value: 'about 20%', title: 't', olumi: null, chance: 0.2, headline: 'about 20%', companion: null }, after: { value: 'about 70%', title: 't', olumi: null, chance: 0.7, headline: 'about 70%', companion: null } }] }
    setTeamFetch((async (u: unknown) => { asked.push(String(u)); return new Response(JSON.stringify(answer), { status: 200 }) }) as unknown as typeof fetch)
    render(<CoreCompare sid="s_1" latest={3} id="v" boxed />)
    fireEvent.change(screen.getByTestId('v-from'), { target: { value: '3' } })
    fireEvent.change(screen.getByTestId('v-to'), { target: { value: '2' } })
    fireEvent.click(screen.getByTestId('v-go'))
    await screen.findByTestId('v-out')
    expect(asked).toEqual(['/api/scenarios/s_1/compare?from=2&to=3'])
    const track = document.querySelector('[data-compare-track]')!
    expect([placed(track.querySelector('[data-mark="earlier"]')), track.getAttribute('aria-label')]).toEqual([20, 'Version 2: about 20%; Version 3: about 70%'])
    expect([...document.querySelectorAll('[data-compare-key]')].map((e) => e.textContent)).toEqual(['Version 2', 'Version 3'])
  })
})

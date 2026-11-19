/**
 * Comparing two versions, or two scenarios, on the olumi-core lane: each side is its own run, so the difference is never drawn as one chance
 * moving on one track (compare concept v3, settled by the DL and Codex 18 Nov: until core sends a paired / same-draws flag, a two-mark track
 * is drawn only where both sides share one run). Every word stays core's (core wip/compare a0397172: ResultMove `label`/`move_text`,
 * versions `who`, Cell and ResultSide `headline`/`companion`), and each comparison says "Separate runs" once, in one fixed label.
 * The earlier 7 Nov shift track (compareTrack.tsx) is deleted with this file's former rows.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ComparedLists, CoreCompare, type Compared } from '../compare'
import { SAME_DRAWS, SEPARATE_RUNS, ScenarioComparisonView, type ScenarioComparison } from '../scenarioCompare'
import { setTeamFetch } from '../team/api'

afterEach(() => { cleanup(); setTeamFetch(null) })

/** The one fixed label, by its own attribute and its exact words and hover; a contrast with no results draws none. */
const runsLabels = (c: ParentNode) => [...c.querySelectorAll('[data-compare-runs]')].map((e) => [e.getAttribute('data-compare-runs'), e.textContent, e.getAttribute('title')])
const ONE_LABEL = [['separate', SEPARATE_RUNS.label, SEPARATE_RUNS.title]]

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

describe('the version compare: core says every word; two versions are separate runs, never one track', () => {
  it("draws core's label, move and who verbatim, never the page's own sentence; no track, no key, and the one Separate runs label", () => {
    const { container } = render(<ComparedLists c={CORE} />)
    const text = container.textContent!
    for (const w of ['CORE-WHO-1', 'CORE-WHO-2', 'CORE-LABEL', 'CORE-MOVE', 'CORE-LEAD', 'CORE-SAME']) expect(text).toContain(w)
    expect(text).not.toContain('‘Add one specialist’ on ‘At least 100 a week’')
    expect(text).not.toContain('approved by Ada')
    expect(container.querySelector('[data-testid="team-compare-results"] li')!.textContent).toContain('about 50% → about 90%')
    expect([container.querySelector('[data-compare-track]'), container.querySelector('[data-compare-track-key]'), container.querySelector('[data-mark]')]).toEqual([null, null, null])
    expect(runsLabels(container)).toEqual(ONE_LABEL)
  })
  it('contrast: with no results there is nothing to call separate, so no label', () => {
    const { container } = render(<ComparedLists c={{ ...CORE, results: [] }} />)
    expect(screen.getByTestId('team-compare-results-none')).toBeTruthy()
    expect(runsLabels(container)).toEqual([])
  })
  it("an older core without the words or numbers: the page's same words as before", () => {
    const old = { ...CORE, versions: CORE.versions.map(({ who: _w, ...v }) => v), results: [{ ...CORE.results[0]!, label: undefined, move_text: undefined,
      before: { value: 'about 50%', title: 't', olumi: null }, after: { value: 'about 90%', title: 't', olumi: null } }] } as Compared
    const { container } = render(<ComparedLists c={old} />)
    expect(container.textContent).toContain('‘Add one specialist’ on ‘At least 100 a week’')
    expect(container.textContent).toContain('(up)')
    expect(container.querySelector('[data-compare-track]')).toBeNull()
    expect(runsLabels(container)).toEqual(ONE_LABEL)
  })
})

const cell = (value: string, chance: number | null) => ({ value, title: 'T', olumi: null, lead: null, condition: null, chance })
const PAIR = (a: number | null, b: number | null): ScenarioComparison => ({
  schema: 'olumi.compare/1',
  a: { id: 's_a', title: 'Rota', name: 'Rota', note: null, kind: 'scenario', about: null, has_run: true },
  b: { id: 'w_7', title: 'Busier week', name: 'Busier week (what-if)', note: null, kind: 'whatif', about: 'A', has_run: true },
  aims: [{ label: 'Reach 100', kind: 'aim', status: 'comparable', limitation: null, only_in_text: null, a: { label: 'Reach 100', measure: 'M', target: null }, b: { label: 'Reach 100', measure: 'M', target: null },
    options: [{ label: 'Add one specialist', only_in: null, only_in_text: null, a: { cells: [cell('about 50%', a)] }, b: { cells: [cell('about 90%', b)] } },
      { label: 'Hire two', only_in: 'a', only_in_text: 'Only in ‘Rota’', a: { cells: [cell('about 70%', 0.7)] }, b: null }] }],
  differences: { options: [], figures: [] }, limits: [],
})
const aimBox = (c: HTMLElement, label: string) => [...c.querySelectorAll<HTMLElement>('[data-compare-aim]')].find((e) => e.getAttribute('aria-label') === label)!
const optionRow = (c: HTMLElement, label: string) => [...c.querySelectorAll<HTMLElement>('[data-compare-option]')].find((r) => r.querySelector('p')?.textContent === label)!

describe('two sides side by side: each its own saved run, both sides in core\'s words, said once as Separate runs', () => {
  it("a comparable aim draws both sides' values in core's words and no track; the label is drawn once, above the aims", () => {
    const { container } = render(<ScenarioComparisonView c={PAIR(0.5, 0.9)} />)
    const row = optionRow(aimBox(container, 'Reach 100'), 'Add one specialist')
    expect([...row.querySelectorAll('[data-compare-value]')].map((e) => e.textContent)).toEqual(['about 50%', 'about 90%'])
    expect([container.querySelector('[data-compare-track]'), container.querySelector('[data-compare-track-key]'), container.querySelector('[data-mark]')]).toEqual([null, null, null])
    expect(runsLabels(container)).toEqual(ONE_LABEL)
    // The label sits before the first aim, not inside one.
    const label = container.querySelector('[data-compare-runs]')!, firstAim = container.querySelector('[data-compare-aim]')!
    expect(label.compareDocumentPosition(firstAim) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(aimBox(container, 'Reach 100').querySelector('[data-compare-runs]')).toBeNull()
    expect(container.textContent).not.toMatch(/\b(best|winner|recommend|better|worse|ahead|leads)\b/i)
  })
  it('contrast: a comparison with no aims and no results has no label', () => {
    const c = PAIR(0.5, 0.9)
    const { container } = render(<ScenarioComparisonView c={{ ...c, aims: [], a: { ...c.a, has_run: false }, b: { ...c.b, has_run: false } }} />)
    expect(runsLabels(container)).toEqual([])
  })
  it("a side with no saved results (core's has_run false, its note kept) gets no label, though the other side's aims are drawn; an older core with no has_run gets none", () => {
    const c = PAIR(0.5, 0.9), NOTE = "‘Busier week (what-if)’ has no saved results yet: its latest model was not analysed."
    const one = render(<ScenarioComparisonView c={{ ...c, b: { ...c.b, has_run: false, note: NOTE } }} />)
    expect([runsLabels(one.container), one.container.querySelectorAll('[data-compare-aim]').length > 0, one.container.querySelector('[data-compare-note]')?.textContent]).toEqual([[], true, NOTE])
    one.unmount()
    const { has_run: _a, ...oldA } = c.a, { has_run: _b, ...oldB } = c.b
    const old = render(<ScenarioComparisonView c={{ ...c, a: oldA, b: oldB }} />)
    expect(runsLabels(old.container)).toEqual([])
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
    const { container } = render(<ComparedLists c={withSplit} />)
    const li = container.querySelector('[data-testid="team-compare-results"] li')!
    expect(li.textContent).toContain(`about 13% (${COMP.text})`)
    expect(li.textContent).not.toContain(LONG)
  })
})

describe('version compare: the pickers in reverse still put each version\'s words on its own side', () => {
  it("Earlier = 3, Later = 2 asks core for from=2&to=3; version 2's words come first, version 3's after the arrow", async () => {
    const V = { 2: { value: 'V2-WORDS about 20%', chance: 0.2 }, 3: { value: 'V3-WORDS about 70%', chance: 0.7 } } as const
    const paths: string[] = []
    setTeamFetch((async (u: unknown) => {
      const p = String(u); paths.push(p)
      const m = /from=(\d)&to=(\d)/.exec(p)!
      const side = (n: 2 | 3) => ({ value: V[n].value, title: 't', olumi: null, chance: V[n].chance })
      // Core's own order: before is the `from` version, after the `to` version.
      const body: Compared = { versions: [{ n: 2, at: 't2', proposedBy: 'Ada', briefBy: null, approvedBy: 'Ada', who: 'W2' }, { n: 3, at: 't3', proposedBy: 'Ada', briefBy: null, approvedBy: 'Ada', who: 'W3' }],
        changes: [], results: [{ kind: 'chance', option: 'hire', optionLabel: 'Add one specialist', aim: 'Reach 100', condition: null, move: 'changed', label: 'L', move_text: 'M',
          before: side(Number(m[1]) as 2 | 3), after: side(Number(m[2]) as 2 | 3) }] }
      return new Response(JSON.stringify(body), { status: 200 })
    }) as unknown as typeof fetch)
    const { container } = render(<CoreCompare sid="s_0123456789ab" latest={3} id="rv" />)
    fireEvent.change(screen.getByTestId('rv-from'), { target: { value: '3' } })
    fireEvent.change(screen.getByTestId('rv-to'), { target: { value: '2' } })
    fireEvent.click(screen.getByTestId('rv-go'))
    await waitFor(() => expect(container.querySelector('[data-testid="rv-results"] li')).not.toBeNull())
    expect(paths).toEqual(['/api/scenarios/s_0123456789ab/compare?from=2&to=3'])
    expect(container.querySelector('[data-testid="rv-results"] li')!.textContent).toContain('V2-WORDS about 20% → V3-WORDS about 70%')
    expect(container.querySelector('[data-compare-track]')).toBeNull()
    expect(runsLabels(container)).toEqual(ONE_LABEL)
  })
})

describe('side by side: where the two sides answer different questions, that is said first (v3 guardrail)', () => {
  const aim = (label: string, status: string) => ({ label, kind: 'aim', status, limitation: status === 'comparable' || status.startsWith('only') ? null : `WHY-${label}`,
    only_in_text: null, a: { label, measure: 'M', target: 'T-a' }, b: { label, measure: 'M', target: 'T-b' }, options: [] })
  const drawn = (c: HTMLElement) => [...c.querySelectorAll('[data-compare-aim]')].map((e) => [e.getAttribute('aria-label'), e.getAttribute('data-compare-aim')])
  it("different_target and not_comparable aims lead, each with core's own reason; the rest keep core's order", () => {
    const c = { ...PAIR(0.5, 0.9), aims: [aim('Reach 100', 'comparable'), aim('Hire extra', 'only_a'), aim('Reach 120', 'different_target'), aim('Cost', 'not_comparable')] as never }
    const { container } = render(<ScenarioComparisonView c={c} />)
    expect(drawn(container)).toEqual([['Reach 120', 'different_target'], ['Cost', 'not_comparable'], ['Reach 100', 'comparable'], ['Hire extra', 'only_a']])
    expect(container.querySelector('[data-compare-aim="different_target"] [data-compare-limitation]')!.textContent).toBe('WHY-Reach 120')
  })
  it("contrast: when every aim answers the same question, core's order is kept exactly", () => {
    const c = { ...PAIR(0.5, 0.9), aims: [aim('Z last', 'comparable'), aim('A first', 'comparable'), aim('Only b', 'only_b')] as never }
    const { container } = render(<ScenarioComparisonView c={c} />)
    expect(drawn(container).map(([l]) => l)).toEqual(['Z last', 'A first', 'Only b'])
  })
})

describe('a pair core proves (SideInfo.paired, a what-if against its exact base): the track returns, said "Same draws"', () => {
  it('the what-if side paired: one track per comparable option at core\'s numbers, "Same draws" in place of "Separate runs", the key once; the unpaired option gets none', () => {
    const c = PAIR(0.5, 0.9)
    const { container } = render(<ScenarioComparisonView c={{ ...c, b: { ...c.b, paired: true } }} />)
    expect([...container.querySelectorAll('[data-compare-track]')].map((t) => [t.getAttribute('data-first'), t.getAttribute('data-second')])).toEqual([['50', '90']])
    expect(runsLabels(container)).toEqual([['same-draws', SAME_DRAWS.label, SAME_DRAWS.title]])
    expect([...container.querySelectorAll('[data-compare-key]')].map((e) => e.textContent)).toEqual(['Rota', 'Busier week (what-if)'])
    expect(optionRow(aimBox(container, 'Reach 100'), 'Hire two').querySelector('[data-compare-track]')).toBeNull()
  })
  it('CONTRASTS: paired false, or absent, on both sides draws no track and keeps "Separate runs"; a proven pair on a different_target aim draws no track', () => {
    const c = PAIR(0.5, 0.9)
    for (const sides of [{ a: { ...c.a, paired: false }, b: { ...c.b, paired: false } }, { a: c.a, b: c.b }]) {
      const { container, unmount } = render(<ScenarioComparisonView c={{ ...c, ...sides }} />)
      expect([container.querySelectorAll('[data-compare-track]').length, runsLabels(container)]).toEqual([0, ONE_LABEL])
      unmount()
    }
    const diff = { ...c, b: { ...c.b, paired: true }, aims: [{ ...c.aims[0]!, status: 'different_target', limitation: 'WHY' }] }
    expect(render(<ScenarioComparisonView c={diff as never} />).container.querySelector('[data-compare-track]')).toBeNull()
  })
})

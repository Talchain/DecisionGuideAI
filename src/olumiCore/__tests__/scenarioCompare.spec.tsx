/**
 * Compare with another scenario (olumi-core API.md v1.15, `GET /api/compare?a=&b=`, `olumi.compare/1`): the person picks one of their other
 * scenarios (`GET /api/me` `scenarios[]`) and the page draws core's side-by-side verbatim. The fixture has the shape and the words of
 * `compareScenarios` (core src/app/compare-scenarios.ts at 5cdae21f): a comparable aim, a different target, a not-comparable aim, an aim
 * only one side has, an option only one side has, a cell resting on Olumi's proposals, and a side with no saved results.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { CompareWithScenario, ScenarioComparisonView, type ScenarioComparison } from '../scenarioCompare'
import { setTeamFetch } from '../team/api'

const MARK = { glyph: '◆', title: 'Rests on Olumi’s proposals' }
const LEAD = "If Olumi's estimates hold"
const cell = (value: string, over: Record<string, unknown> = {}) => ({ value, title: `the Run's sentence for ${value}`, olumi: null, lead: null, condition: null, ...over })
const A_NOTE = '‘Rota B’ has no saved results yet: its latest model was not analysed.'
const DIFF = "Both measure ‘Reach 100 a week’; Rota A aims for at least 100 tickets/week, Rota B for at least 120 tickets/week, so these chances answer different questions."
const NOTCOMP = 'Not comparable: Rota A measures ‘Spend’ in pounds, Rota B in thousands of pounds.'
const FIG = 'Not comparable: Rota A has ‘Absence’ in tickets/week, Rota B in days.'
const CMP: ScenarioComparison = {
  schema: 'olumi.compare/1',
  a: { id: 's_a', title: 'Rota', name: 'Rota (first)', note: null } as never,
  b: { id: 's_b', title: 'Rota', name: 'Rota (second)', note: A_NOTE } as never,
  aims: [
    { label: 'Reach 100 a week', kind: 'aim', status: 'comparable', limitation: null, only_in: null, only_in_text: null,
      a: { id: 'g', label: 'Reach 100 a week', measure: 'tickets/week (tickets/week), at the end over 12 weeks', target: 'at least 100 tickets/week' },
      b: { id: 'g', label: 'Reach 100 a week', measure: 'tickets/week (tickets/week), at the end over 12 weeks', target: 'at least 100 tickets/week' },
      options: [{ label: 'Add one specialist', only_in: null, only_in_text: null, a: { status: 'live', cells: [cell('about 61% chance', { olumi: MARK, lead: LEAD })] }, b: { status: 'live', cells: [cell('about 58% chance')] } },
        { label: 'Hire two', only_in: 'a', only_in_text: 'Only in ‘Rota (first)’', a: { status: 'live', cells: [cell('about 75% chance')] }, b: null }] },
    { label: 'Reach 120 a week', kind: 'aim', status: 'different_target', limitation: DIFF, only_in: null, only_in_text: null,
      a: { id: 'h', label: 'Reach 120 a week', measure: 'M-a', target: 'at least 100 tickets/week' }, b: { id: 'h', label: 'Reach 120 a week', measure: 'M-b', target: 'at least 120 tickets/week' },
      options: [{ label: 'Add one specialist', only_in: null, only_in_text: null, a: { status: 'live', cells: [cell('about 61% chance')] }, b: { status: 'live', cells: [cell('about 30% chance')] } }] },
    { label: 'Spend', kind: 'limit', status: 'not_comparable', limitation: NOTCOMP, only_in: null, only_in_text: null,
      a: { id: 'l', label: 'Spend', measure: 'Budget (pounds), added up', target: null }, b: { id: 'l', label: 'Spend', measure: 'Budget (thousands of pounds), added up', target: null },
      options: [{ label: 'Add one specialist', only_in: 'a', only_in_text: 'Only in ‘Rota (first)’', a: { status: 'live', cells: [cell('always within in this model')] }, b: null },
        { label: 'Add one specialist', only_in: 'b', only_in_text: 'Only in ‘Rota (second)’', a: null, b: { status: 'live', cells: [cell('within in 80% of draws')] } }] },
    { label: 'Morale', kind: 'aim', status: 'only_b', limitation: null, only_in: 'b', only_in_text: 'Only in ‘Rota (second)’', a: null, b: { id: 'm', label: 'Morale', measure: 'Morale score, on average', target: 'at least 7' }, options: [] },
    { label: 'Mystery', kind: 'aim', status: 'a_status_from_later', limitation: 'A line core says about it', only_in: null, only_in_text: null, a: { id: 'x', label: 'Mystery', measure: 'MX-a', target: 'T-a' }, b: { id: 'x', label: 'Mystery', measure: 'MX-b', target: 'T-b' },
      options: [{ label: 'Add one specialist', only_in: null, only_in_text: null, a: { status: 'live', cells: [cell('V-a')] }, b: { status: 'live', cells: [cell('V-b')] } }] },
  ] as never,
  differences: { options: [{ label: 'Add one specialist', status: 'both', only_in_text: null }, { label: 'Hire two', status: 'only_a', only_in_text: 'Only in ‘Rota (first)’' }, { label: 'Pause hiring', status: 'only_b', only_in_text: 'Only in ‘Rota (second)’' }],
    figures: [{ label: 'Absence', status: 'differs', a: { text: '2 to 10 tickets/week', olumi: MARK }, b: { text: '3 days', olumi: null }, only_in: null, only_in_text: null, limitation: FIG },
      { label: 'Per specialist', status: 'same', a: { text: '5', olumi: null }, b: { text: '5', olumi: null }, only_in: null, only_in_text: null, limitation: null }] },
  limits: [A_NOTE, NOTCOMP, DIFF, FIG, 'A limit only the list carries'],
} as never

let paths: string[] = []
let compareAnswer: { status: number; body: unknown } = { status: 200, body: CMP }
beforeEach(() => {
  paths = []; compareAnswer = { status: 200, body: CMP }
  setTeamFetch((async (u: unknown) => {
    const p = String(u); paths.push(p)
    if (p === '/api/me') return new Response(JSON.stringify({ me: { id: 'p_1', name: 'Ada' }, scenarios: [{ id: 's_a', title: 'Rota' }, { id: 's_b', title: 'Rota' }, { id: 's_c', title: 'Launch' }] }), { status: 200 })
    return new Response(JSON.stringify(compareAnswer.body), { status: compareAnswer.status })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null) })
const aim = (c: HTMLElement, label: string) => [...c.querySelectorAll<HTMLElement>('[data-compare-aim]')].find((e) => e.getAttribute('aria-label') === label)!

describe('compare with another scenario: the picker and the request', () => {
  it('offers the person\'s other scenarios from /api/me (never this one), and reads core\'s comparison by both ids only on Compare', async () => {
    render(<CompareWithScenario sid="s_a" />)
    const pick = (await screen.findByTestId('scenario-compare-pick')) as HTMLSelectElement
    expect([...pick.options].map((o) => [o.value, o.textContent])).toEqual([['s_b', 'Rota'], ['s_c', 'Launch']])
    expect(paths.filter((p) => p.startsWith('/api/compare'))).toEqual([])
    fireEvent.change(pick, { target: { value: 's_c' } })
    fireEvent.click(screen.getByTestId('scenario-compare-go'))
    await screen.findByTestId('scenario-compare-out')
    expect(paths.filter((p) => p.startsWith('/api/compare'))).toEqual(['/api/compare?a=s_a&b=s_c'])
  })
  it('no other scenario: said once, no picker; a refusal is core\'s own words', async () => {
    setTeamFetch((async () => new Response(JSON.stringify({ me: { id: 'p_1', name: 'Ada' }, scenarios: [{ id: 's_a', title: 'Rota' }] }), { status: 200 })) as unknown as typeof fetch)
    render(<CompareWithScenario sid="s_a" />)
    expect((await screen.findByTestId('scenario-compare-none')).textContent).toBe('You have no other scenario to compare with yet.')
    expect(screen.queryByTestId('scenario-compare-pick')).toBeNull()
    cleanup()
    setTeamFetch((async (u: unknown) => String(u) === '/api/me'
      ? new Response(JSON.stringify({ scenarios: [{ id: 's_b', title: 'B' }] }), { status: 200 })
      : new Response(JSON.stringify({ error: 'no such scenario' }), { status: 404 })) as unknown as typeof fetch)
    render(<CompareWithScenario sid="s_a" />)
    fireEvent.click(await screen.findByTestId('scenario-compare-go'))
    await waitFor(() => expect(screen.getByTestId('scenario-compare-error').textContent).toBe('no such scenario'))
  })
})

describe('compare with another scenario: core\'s words, drawn as given', () => {
  it('the two names head the columns once, with a side\'s note under it; a limitation core says on an aim or a figure is not said again in the notes', () => {
    const { container } = render(<ScenarioComparisonView c={CMP} />)
    expect([...container.querySelectorAll('[data-compare-name]')].map((e) => e.textContent)).toEqual(['Rota (first)', 'Rota (second)'])
    expect(container.querySelector('[data-compare-side="b"] [data-compare-note]')?.textContent).toBe(A_NOTE)
    for (const l of [A_NOTE, DIFF, NOTCOMP, FIG]) expect(container.textContent!.split(l).length - 1, l).toBe(1)
    expect([...screen.getByTestId('scenario-compare-notes').querySelectorAll('li')].map((e) => e.textContent)).toEqual(['A limit only the list carries'])
  })
  it('comparable: each side\'s measure, option rows from each side\'s cells with the mark and lead only where core marks it; no target (the same on both)', () => {
    const { container } = render(<ScenarioComparisonView c={CMP} />)
    const a = aim(container, 'Reach 100 a week')
    expect(a.getAttribute('data-compare-aim')).toBe('comparable')
    expect([...a.querySelectorAll('[data-compare-measure]')].map((e) => e.textContent)).toEqual([CMP.aims[0]!.a!.measure, CMP.aims[0]!.b!.measure])
    expect(a.querySelector('[data-compare-target]')).toBeNull()
    const rows = [...a.querySelectorAll('[data-compare-option]')]
    const [first, second] = rows.map((r) => [...r.querySelectorAll('[data-compare-cell]')].map((c) => c.textContent))
    expect(first).toEqual([`◆ about 61% chance${LEAD}`, 'about 58% chance'])
    expect(second).toEqual(['about 75% chance'])
    expect(rows[0]!.querySelector('[data-compare-cell] [aria-label]')?.getAttribute('title')).toBe(MARK.title)
    expect(rows[1]!.textContent).toContain('Only in ‘Rota (first)’')
    expect(rows[0]!.querySelectorAll('[data-compare-lead]')).toHaveLength(1)
    expect(rows[0]!.querySelector('[data-compare-cell]')!.getAttribute('title')).toBe("the Run's sentence for about 61% chance")
  })
  it('different target: both targets in each side\'s own column with core\'s limitation line; not comparable: the limitation and unpaired options', () => {
    const { container } = render(<ScenarioComparisonView c={CMP} />)
    const d = aim(container, 'Reach 120 a week')
    expect([...d.querySelectorAll('[data-compare-target]')].map((e) => e.textContent)).toEqual(['at least 100 tickets/week', 'at least 120 tickets/week'])
    expect(d.querySelector('[data-compare-limitation]')?.textContent).toBe(DIFF)
    const n = aim(container, 'Spend')
    expect(n.querySelector('[data-compare-limitation]')?.textContent).toBe(NOTCOMP)
    expect(n.querySelector('[data-compare-target]')).toBeNull()
    expect([...n.querySelectorAll('[data-compare-option]')].map((r) => r.getAttribute('data-compare-option'))).toEqual(['alone', 'alone'])
    expect([...n.querySelectorAll('[data-compare-only-in]')].map((e) => e.textContent)).toEqual(['Only in ‘Rota (first)’', 'Only in ‘Rota (second)’'])
  })
  it('an aim only one side has is named with core\'s only-in words and its own measure, in its own column; a status it does not know draws no targets', () => {
    const { container } = render(<ScenarioComparisonView c={CMP} />)
    const m = aim(container, 'Morale')
    expect(m.getAttribute('data-compare-aim')).toBe('only_b')
    expect(m.querySelector('[data-compare-only-in]')?.textContent).toBe('Only in ‘Rota (second)’')
    const sides = m.querySelectorAll('[data-compare-aim-side]')
    expect(sides[0]!.textContent).toBe('')
    expect(sides[1]!.textContent).toBe('Morale score, on average')
    const u = aim(container, 'Mystery')
    expect(u.querySelector('[data-compare-limitation]')?.textContent).toBe('A line core says about it')
    expect(u.querySelector('[data-compare-target]')).toBeNull() // targets only for a different target
    expect(u.getAttribute('data-compare-aim')).toBe('a_status_from_later')
  })
  it('differences: an option only one side has that no aim lists, and each figure that differs with core\'s limitation; a same figure and a shared option are not listed; nothing ranks', () => {
    const { container } = render(<ScenarioComparisonView c={CMP} />)
    const d = screen.getByTestId('scenario-compare-differences')
    expect([...d.querySelectorAll('[data-compare-diff-option]')].map((e) => e.textContent!.trim())).toEqual(['Pause hiring  Only in ‘Rota (second)’'])
    const f = d.querySelector('[data-compare-figure="differs"]')!
    expect(f.textContent).toContain('◆ 2 to 10 tickets/week')
    expect(f.textContent).toContain('3 days')
    expect(f.querySelector('[data-compare-limitation]')?.textContent).toBe(FIG)
    expect(d.querySelector('[data-compare-figure="same"]')).toBeNull()
    expect(container.textContent).not.toMatch(/\b(best|winner|recommend|better|worse|ahead|leads)\b/i)
    expect(within(d).queryByText('Per specialist')).toBeNull()
  })
})

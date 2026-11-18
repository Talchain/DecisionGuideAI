/**
 * THE COMPARE TAB, redesigned 18 Nov (Paul: "Is the scenario/version comparison working?"). Bound by identity: the pair read (core's route and
 * its numbers), each changed figure by its card id, each moved result by its index in core's list, core's line by its View path. The real
 * path: the A6 journey View (`ui9-a6-since-v3`, served by olumi-core, copied unedited; version 3 beside version 2, one figure changed, no
 * reading moved). Core's comparison answers are shaped as API.md v1.7 gives them; the moved pair is core's own SCI-6 example (compareSince.spec).
 */
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
const focus = vi.fn()
vi.mock('../../canvas/utils/focusHelpers', () => ({ focusNodeById: (id: string) => focus(id) }))
const prefill = vi.fn()
vi.mock('../../olumiView/ViewChat', () => ({ prefillComposer: (t: string) => prefill(t) }))

import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { setTeamFetch } from '../team/api'
import { ASK_WHICH, COMPARE_ONE, CoreCompareTab, notMoved, type Compared, type Since } from '../compare'

const fixture = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/port/__tests__/fixtures', `${n}.view3.json`), 'utf8'))
const side = (value: string, chance: number | null) => ({ value, title: 't', olumi: null, chance, headline: value, companion: null })
const result = (label: string, a: number | null, b: number | null, move: 'up' | 'down' | 'unchanged' | 'changed') =>
  ({ kind: 'chance' as const, option: label, optionLabel: label, aim: 'Aim', condition: null, move, label, move_text: move, before: side(`B-${label}`, a), after: side(`A-${label}`, b) })
const LINES: Compared['changes'] = [
  { text: '↻ figure: hours', detail: 'from 20 to 25', mark: null, olumi: false },
  { text: '+ risk: delay', detail: '', mark: { glyph: '◆', title: 'Proposed by Olumi' }, olumi: true },
  { text: '↻ figure: spend', detail: 'from 1,000 to 1,200', mark: { glyph: '◐', title: 'Their figure, read as a range' }, olumi: false },
]

let paths: string[] = []
let answer: Compared = { versions: [], changes: [], results: [] }
let me: unknown = { scenarios: [] }
let whatifs: unknown = { whatifs: [] }
beforeEach(() => {
  paths = []; answer = { versions: [], changes: [], results: [] }; me = { scenarios: [] }; whatifs = { whatifs: [] }
  focus.mockClear(); prefill.mockClear()
  vi.stubEnv('VITE_OLUMI_CORE', '1')
  setTeamFetch((async (u: unknown) => {
    const p = String(u); paths.push(p)
    const body = p === '/api/me' ? me : p.endsWith('/whatifs') ? whatifs : p.endsWith('/versions') ? { versions: [] } : answer
    return new Response(JSON.stringify(body), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); vi.unstubAllEnvs(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', at: null } as never) })

const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  return render(<CoreCompareTab />)
}
const withSince = (since: Since, n = since.to.n): View => { const v = fixture('ui9-a6-since-v3'); return { ...v, version: { ...v.version!, n }, model: { ...v.model!, run: { ...v.model!.run!, since } } } }
const compared = () => paths.filter((p) => p.includes('/compare'))

describe('what changed, each by its author and a press to its card', () => {
  it('CT1 (served A6 View): reads core\'s own pair (2 with 3); each changed figure is a press that centres ITS card; CONTRAST: an id with no card is not a press', async () => {
    const view = fixture('ui9-a6-since-v3'), since = view.model!.run!.since!
    expect([view.version!.n, since.from.n, since.to.n, since.changed.length]).toEqual([3, 2, 3, 1]) // control: the field is served here
    show(view)
    await screen.findByTestId('core-compare-out')
    expect(compared()).toEqual([`/api/scenarios/${view.id}/compare?from=2&to=3`])
    const named = screen.getByTestId('core-compare-named')
    expect([...named.querySelectorAll('[data-since-changed]')].map((e) => [e.getAttribute('data-since-changed'), e.getAttribute('data-since-whose'), e.textContent])).toEqual(since.changed.map((c) => [c.id, c.whose, c.label]))
    expect(within(named).getByRole('img').getAttribute('aria-label')).toBe('A person’s') // `whose: theirs`
    fireEvent.click(named.querySelector(`[data-compare-card="${since.changed[0]!.id}"]`)!)
    expect(focus.mock.calls).toEqual([[since.changed[0]!.id]])
    cleanup()
    show(withSince({ ...since, changed: [{ id: 'no_such_card', label: 'Gone', whose: 'olumi', was: 'olumi' }] }))
    await screen.findByTestId('core-compare-out')
    expect(screen.getByTestId('core-compare-named').querySelector('[data-compare-card]')).toBeNull()
    expect(within(screen.getByTestId('core-compare-named')).getByRole('img').getAttribute('aria-label')).toBe('Olumi’s')
  })
  it('CT2: one named figure but three change lines: the full lines are behind one press, counted at rest, so one figure never reads as the only change', async () => {
    answer = { versions: [], changes: LINES, results: [] }
    show(fixture('ui9-a6-since-v3'))
    const all = await screen.findByTestId('core-compare-all-lines')
    expect(all.tagName).toBe('DETAILS'); expect(all.hasAttribute('open')).toBe(false)
    expect(all.querySelector('summary')!.textContent).toBe('All 3 change lines')
    expect([...all.querySelectorAll('[data-compare-line]')].map((l) => [l.textContent, l.querySelector('[role="img"]')?.getAttribute('aria-label') ?? null]))
      .toEqual([['↻ figure: hours from 20 to 25', null], ['+ risk: delay', 'Proposed by Olumi'], ['↻ figure: spend from 1,000 to 1,200', 'Their figure, read as a range']])
  })
  it('CT3: with no View comparison for the pair, core\'s change lines are the list; CONTRAST: none at all says so once', async () => {
    answer = { versions: [], changes: LINES, results: [] }
    show({ ...fixture('ui9-a6-since-v3'), model: { ...fixture('ui9-a6-since-v3').model!, run: { ...fixture('ui9-a6-since-v3').model!.run!, since: undefined } } })
    await screen.findByTestId('core-compare-out')
    expect(screen.getByTestId('core-compare-lines').querySelectorAll('[data-compare-line]').length).toBe(3)
    expect(screen.queryByTestId('core-compare-named')).toBeNull()
    cleanup(); answer = { versions: [], changes: [], results: [] }
    show({ ...fixture('ui9-a6-since-v3'), model: { ...fixture('ui9-a6-since-v3').model!, run: { ...fixture('ui9-a6-since-v3').model!.run!, since: undefined } } })
    expect((await screen.findByTestId('core-compare-changes-none')).textContent).toBe('No change to the model')
  })
})

describe('what moved: one track per moved result, the largest move first, the rest counted', () => {
  it('CT4: ranked by core\'s numbers (60→10 before 20→25), one track each, and one line for the result that did not move; CONTRAST: nothing moved draws no track and no key', async () => {
    answer = { versions: [], changes: [], results: [result('small', 0.2, 0.25, 'up'), result('large', 0.6, 0.1, 'down'), result('same', 0.5, 0.5, 'unchanged')] }
    show(fixture('ui9-a6-since-v3'))
    const moved = await screen.findByTestId('core-compare-moved')
    expect([...moved.querySelectorAll('[data-compare-result]')].map((e) => e.getAttribute('data-compare-result'))).toEqual(['1', '0'])
    expect([...moved.querySelectorAll('[data-compare-track]')].map((t) => [t.getAttribute('data-first'), t.getAttribute('data-second')])).toEqual([['60', '10'], ['20', '25']])
    expect(moved.querySelector('[data-compare-result="1"]')!.textContent).toContain('B-large → A-large')
    expect([screen.getByTestId('core-compare-still').textContent, screen.getByTestId('core-compare-still').getAttribute('data-still')]).toEqual([notMoved(1), '1'])
    expect(moved.textContent).not.toContain('B-same')
    expect([...moved.querySelectorAll('[data-compare-key]')].map((e) => e.textContent)).toEqual(['Version 2', 'Version 3'])
    cleanup()
    answer = { versions: [], changes: [], results: [result('same', 0.5, 0.5, 'unchanged'), result('also', 0.1, 0.1, 'unchanged')] }
    show(fixture('ui9-a6-since-v3'))
    expect((await screen.findByTestId('core-compare-still')).textContent).toBe('2 results did not move.')
    expect([document.querySelectorAll('[data-compare-track]').length, document.querySelectorAll('[data-compare-track-key]').length]).toEqual([0, 0])
  })
})

describe('honest attribution: core\'s line once, and one useful press where core credits no single change', () => {
  const TWO: Since = {
    heading: 'Since the version before', from: { n: 1, label: 'version 1' }, to: { n: 3, label: 'version 3' },
    changed: [{ id: 'hire_a_part_time_mechanic', label: 'Hire', whose: 'theirs', was: 'theirs' }, { id: 'open_on_sundays', label: 'Sundays', whose: 'olumi', was: 'olumi' }],
    sole: null,
    lines: [
      { option: 'a', aim: 'x', from: 0.5, to: 0.5, from_text: 'about 50%', to_text: 'about 50%', line: 'LINE-SAME' },
      { option: 'b', aim: 'x', from: 0.66, to: 0.03, from_text: 'about 66%', to_text: 'about 3%', line: 'LINE-BIG' },
      { option: 'c', aim: 'x', from: 0.2, to: 0.3, from_text: 'about 20%', to_text: 'about 30%', line: 'LINE-SMALL' },
    ],
  }
  it('CT5: version 3 beside version 1 (core\'s pair, not 2 with 3): core\'s line for the largest move, once, and the ask puts an editable question in the message box', async () => {
    show(withSince(TWO))
    const credit = await screen.findByTestId('core-compare-credit')
    expect(compared()).toEqual([`/api/scenarios/${fixture('ui9-a6-since-v3').id}/compare?from=1&to=3`])
    expect([...credit.querySelectorAll('[data-view^="run.since.lines."]')].map((e) => [e.getAttribute('data-view'), e.textContent])).toEqual([['run.since.lines.1.line', 'LINE-BIG']])
    expect(document.body.textContent!.split('LINE-').length - 1).toBe(1)
    fireEvent.click(screen.getByTestId('core-compare-ask-go'))
    await waitFor(() => expect(screen.getByTestId('core-compare-ask-placed').textContent).toBe(ASK_WHICH.placed))
    expect(prefill.mock.calls).toEqual([[ASK_WHICH.request]])
    expect(paths.some((p) => p.includes('/turn') || p.includes('/messages'))).toBe(false) // nothing sent
  })
  it('CT6: CONTRASTS: core credits one change (`sole` set) says its line with no ask; no reading moved says nothing at all', async () => {
    show(withSince({ ...TWO, sole: 'open_on_sundays' }))
    expect((await screen.findByTestId('core-compare-credit')).getAttribute('data-sole')).toBe('open_on_sundays')
    expect(screen.queryByTestId('core-compare-ask')).toBeNull()
    cleanup()
    show(fixture('ui9-a6-since-v3')) // served: sole set, neither reading moved
    await screen.findByTestId('core-compare-out')
    expect([screen.queryByTestId('core-compare-credit'), screen.queryByTestId('core-compare-ask')]).toEqual([null, null])
  })
})

describe('one picker for every kind of comparison, and the empty states', () => {
  it('CT7: earlier versions, saved what-ifs and other scenarios in one select; a what-if is read side by side through core\'s /api/compare', async () => {
    me = { scenarios: [{ id: 's_other', title: 'Launch', label: 'Launch' }] }
    whatifs = { whatifs: [{ id: 'w_7', name: 'Busier week', by: 'Ada', at: 't', version: 3, edits: [], about: 'A what-if on version 3' }] }
    const view = fixture('ui9-a6-since-v3')
    show(view)
    const pick = screen.getByTestId('core-compare-with') as HTMLSelectElement
    await waitFor(() => expect([...pick.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Earlier versions', 'Saved what-ifs', 'Your other scenarios']))
    expect([...pick.options].map((o) => [o.value, o.textContent])).toEqual([['v:2', 'Version 2'], ['v:1', 'Version 1'], ['w_7', 'What-if: Busier week'], ['s_other', 'Launch']])
    fireEvent.change(pick, { target: { value: 'w_7' } })
    await waitFor(() => expect(paths).toContain(`/api/compare?a=${view.id}&b=w_7`))
    expect(screen.queryByTestId('core-compare-out')).toBeNull()
  })
  it('CT8: one approved version is one line and nothing else; CONTRAST: two versions draw the picker and the what-if press', async () => {
    const v = fixture('ui9-a6-since-v3')
    const { container } = show({ ...v, version: { ...v.version!, n: 1 }, model: { ...v.model!, run: { ...v.model!.run!, since: undefined } } })
    expect(screen.getByTestId('core-compare-one').textContent).toBe(COMPARE_ONE)
    expect(container.querySelector('[data-testid="core-compare-tab"]')!.children.length).toBe(1)
    expect(compared()).toEqual([])
    cleanup()
    show(v)
    expect([!!screen.queryByTestId('core-compare-picker'), !!screen.queryByTestId('core-compare-whatif-open')]).toEqual([true, v.model!.cards.some((c) => c.figure?.edit != null)])
  })
  it('CT9: the what-if press only where a figure can be set; CONTRAST: none settable and nothing waiting offers no press; no results says so once', async () => {
    const v = fixture('ui9-a6-since-v3')
    const settable = { ...v, model: { ...v.model!, cards: v.model!.cards.map((c, i) => (i === 0 ? { ...c, figure: { text: '5', title: 'T', edit: { prompt: 'P', ask: 'A' } } } : { ...c, figure: c.figure ? { ...c.figure, edit: null } : c.figure })) } } as View
    show(settable)
    expect(screen.getByTestId('core-compare-whatif-open')).toBeInTheDocument()
    cleanup()
    show({ ...settable, proposal: null, model: { ...settable.model!, cards: settable.model!.cards.map((c) => ({ ...c, figure: c.figure ? { ...c.figure, edit: null } : c.figure })) } } as View)
    expect(screen.queryByTestId('core-compare-whatif-open')).toBeNull()
    expect((await screen.findByTestId('core-compare-results-none')).textContent).toBe('No results in either version.')
    expect(screen.queryByTestId('core-compare-still')).toBeNull()
  })
})

/**
 * THE COMPARE TAB, redesigned 18 Nov (Paul: "Is the scenario/version comparison working?"). Bound by identity: the pair read (core's route and
 * its numbers), each changed figure by its card id, each moved result by its index in core's list, core's line by its View path. The real
 * path: the A6 journey View (`ui9-a6-since-v3`, served by olumi-core, copied unedited; version 3 beside version 2, one figure changed, no
 * reading moved). Core's comparison answers are shaped as API.md v1.7 gives them; the moved pair is core's own SCI-6 example (compareSince.spec).
 */
import { DETAILS_TURN } from '../../olumiView/look/FoldChevron'
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
import { useCanvasStore } from '../../canvas/store'
import { useCompare } from '../../olumiView/v12/views/useCompare'
import { useInputsOpen } from '../../olumiView/v12/bands/foldStore'
import { setTeamFetch } from '../team/api'
import { ASK_WHICH, COMPARE_ONE, COMPARE_ONE_VERSIONS, CoreCompareTab, moreChanges, notMoved, type Compared, type Since } from '../compare'
import { CompareCardMark, changedSince, useCompareMarks } from '../compareMarks'
import { SEPARATE_RUNS } from '../scenarioCompare'

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
    useCanvasStore.setState({ nodes: [{ id: since.changed[0]!.id }] } as never) // the card is drawn on the board
    fireEvent.click(named.querySelector(`[data-compare-card="${since.changed[0]!.id}"]`)!)
    expect(focus.mock.calls).toEqual([[since.changed[0]!.id]])
    useCanvasStore.setState({ nodes: [] } as never)
    cleanup()
    show(withSince({ ...since, changed: [{ id: 'no_such_card', label: 'Gone', whose: 'olumi', was: 'olumi' }] }))
    await screen.findByTestId('core-compare-out')
    expect(screen.getByTestId('core-compare-named').querySelector('[data-compare-card]')).toBeNull()
    expect(within(screen.getByTestId('core-compare-named')).getByRole('img').getAttribute('aria-label')).toBe('Olumi’s')
  })
  it('CT2 CHANGED BY DESIGN (18 Nov audit compare-model-01): one named figure and three change lines: core\'s lines are open at rest (no fold), so one figure never reads as the only change', async () => {
    answer = { versions: [], changes: LINES, results: [] }
    show(fixture('ui9-a6-since-v3'))
    await screen.findByTestId('core-compare-out')
    expect(screen.queryByTestId('core-compare-all-lines'), 'no fold for three').toBeNull()
    const lines = screen.getByTestId('core-compare-lines')
    expect(lines.closest('details'), 'not inside any closed fold').toBeNull()
    expect([...lines.querySelectorAll('[data-compare-line]')].map((l) => [l.textContent, l.querySelector('[role="img"]')?.getAttribute('aria-label') ?? null]))
      .toEqual([['↻ figure: hours from 20 to 25', null], ['+ risk: delay', 'Proposed by Olumi'], ['↻ figure: spend from 1,000 to 1,200', 'Their figure, read as a range']])
  })
  it('CT2b CONTRAST: four change lines stay behind one press, counted at rest', async () => {
    answer = { versions: [], changes: [...LINES, LINES[0]!], results: [] }
    show(fixture('ui9-a6-since-v3'))
    const all = await screen.findByTestId('core-compare-all-lines')
    expect(all.tagName).toBe('DETAILS'); expect(all.hasAttribute('open')).toBe(false)
    expect(all.querySelector('summary')!.textContent).toBe('All 4 changes in full')
    expect(all.querySelector('summary [data-fold-chevron="details"]'), 'polish 13: a chevron, not the native marker').not.toBeNull()
    // Review of dd8283b4: a chevron turns only with its OWN details (direct child of that summary), never with an open details further out.
    for (const ch of document.querySelectorAll<SVGElement>('[data-fold-chevron="details"]')) {
      expect(ch.parentElement?.tagName, 'the summary\'s direct child').toBe('SUMMARY')
      expect(ch.getAttribute('class')).toContain(DETAILS_TURN)
      expect(ch.getAttribute('class')).not.toContain('group-open:')
    }
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

describe('a changed figure folded away on the board', () => {
  it('CT11: a card Simple folded into the inputs group: the press opens that group, and the card is centred once the board draws it; CONTRAST CT1: a drawn card is centred at once', async () => {
    const view = fixture('ui9-a6-since-v3'), id = view.model!.run!.since!.changed[0]!.id
    useCanvasStore.setState({ nodes: [] } as never); useInputsOpen.setState({ open: {} })
    show(view)
    await screen.findByTestId('core-compare-out')
    fireEvent.click(document.querySelector(`[data-compare-card="${id}"]`)!)
    expect([focus.mock.calls.length, useInputsOpen.getState().open[view.id]]).toEqual([0, true])
    useCanvasStore.setState({ nodes: [{ id }] } as never)
    expect(focus.mock.calls).toEqual([[id]])
    useCanvasStore.setState({ nodes: [] } as never); useInputsOpen.setState({ open: {} })
  })
})

describe('what moved: each moved result in core\'s words, the largest move first, the rest counted; separate runs, no track', () => {
  it('CT4: ranked by core\'s numbers (60→10 before 20→25), no track, "Separate runs" once beside the heading, and one line for the result that did not move; CONTRAST: nothing moved draws no heading and no label, only the counted line', async () => {
    answer = { versions: [], changes: [], results: [result('small', 0.2, 0.25, 'up'), result('large', 0.6, 0.1, 'down'), result('same', 0.5, 0.5, 'unchanged')] }
    show(fixture('ui9-a6-since-v3'))
    const moved = await screen.findByTestId('core-compare-moved')
    expect([...moved.querySelectorAll('[data-compare-result]')].map((e) => e.getAttribute('data-compare-result'))).toEqual(['1', '0'])
    expect([moved.querySelectorAll('[data-compare-track]').length, moved.querySelectorAll('[data-mark]').length]).toEqual([0, 0])
    expect([...moved.querySelectorAll('[data-compare-runs]')].map((e) => [e.getAttribute('data-compare-runs'), e.textContent, e.parentElement!.querySelector('h4')?.textContent])).toEqual([['separate', SEPARATE_RUNS.label, 'What moved']])
    expect(moved.querySelector('[data-compare-result="1"]')!.textContent).toContain('B-large → A-large')
    // The unmoved result is counted at rest, and its own row (core's words in both versions) is one press away, never drawn as a track.
    const still = screen.getByTestId('core-compare-still')
    expect([still.tagName, still.hasAttribute('open'), still.querySelector('summary')!.textContent]).toEqual(['DETAILS', false, notMoved(1)])
    expect([...still.querySelectorAll('[data-compare-still-row]')].map((e) => [e.getAttribute('data-compare-still-row'), e.textContent])).toEqual([['2', 'same: B-same → A-same (unchanged)']])
    expect([...moved.querySelectorAll('[data-compare-result]')].some((e) => e.textContent!.includes('B-same'))).toBe(false)
    expect(moved.querySelectorAll('[data-compare-key]').length).toBe(0)
    cleanup()
    answer = { versions: [], changes: [], results: [result('same', 0.5, 0.5, 'unchanged'), result('also', 0.1, 0.1, 'unchanged')] }
    show(fixture('ui9-a6-since-v3'))
    expect((await screen.findByTestId('core-compare-still')).querySelector('summary')!.textContent).toBe('2 results did not move.')
    expect(screen.getByTestId('core-compare-moved').querySelector('h4'), 'no "What moved" heading over nothing that moved (audit compare-model-02)').toBeNull()
    // Nothing moved: the label would label nothing, so it is not drawn (S4 compare4); the counted line above says it.
    expect([document.querySelectorAll('[data-compare-track]').length, screen.getByTestId('core-compare-moved').querySelectorAll('[data-compare-runs]').length]).toEqual([0, 0])
    cleanup()
    answer = { versions: [], changes: [], results: [result('large', 0.6, 0.1, 'down'), result('same', 0.5, 0.5, 'unchanged')] }
    show(fixture('ui9-a6-since-v3'))
    expect((await screen.findByTestId('core-compare-moved')).querySelector('h4')?.textContent, 'CONTRAST: with a move the heading stands').toBe('What moved')
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
    // Core's line for every result, one press away, the largest move first; no one line stands for the rest, and none is drawn at rest.
    const readings = screen.getByTestId('core-compare-readings')
    expect([readings.hasAttribute('open'), readings.querySelector('summary')!.textContent]).toEqual([false, 'Olumi’s reading of each result (3)'])
    expect([...credit.querySelectorAll('[data-view^="run.since.lines."]')].map((e) => [e.getAttribute('data-view'), e.textContent])).toEqual([['run.since.lines.1.line', 'LINE-BIG'], ['run.since.lines.0.line', 'LINE-SAME'], ['run.since.lines.2.line', 'LINE-SMALL']])
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

describe('one rule for "moved": core\'s words', () => {
  it('CT12: a number that drifts under the same words (about 50% in both) is not a move: no track, no credit, no ask; CONTRAST CT5 moves in words', async () => {
    const v = fixture('ui9-a6-since-v3'), since = v.model!.run!.since!
    const drift: Since = { ...since, sole: null, lines: [{ ...since.lines[0]!, from: 0.5004, to: 0.5031, from_text: 'about 50%', to_text: 'about 50%', line: 'LINE-DRIFT' }] }
    show(withSince(drift))
    await screen.findByTestId('core-compare-out')
    expect([screen.queryByTestId('core-compare-credit'), screen.queryByTestId('core-compare-ask'), document.querySelectorAll('[data-compare-track]').length]).toEqual([null, null, 0])
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
  it('CT8: one approved version with nothing else to compare is one line and nothing else; CONTRAST: with a saved what-if it is still compared (Codex P1)', async () => {
    const v = fixture('ui9-a6-since-v3')
    const one = { ...v, collab: { ...v.collab, shared: [] }, version: { ...v.version!, n: 1 }, model: { ...v.model!, cards: v.model!.cards.map((c) => ({ ...c, figure: c.figure ? { ...c.figure, edit: null } : c.figure })), run: { ...v.model!.run!, since: undefined } } } as View
    const { container } = show(one)
    await waitFor(() => expect(paths).toContain(`/api/scenarios/${v.id}/whatifs`))
    expect(screen.getByTestId('core-compare-one').textContent).toBe(COMPARE_ONE)
    expect(container.querySelector('[data-testid="core-compare-tab"]')!.children.length).toBe(1)
    expect([screen.queryByTestId('core-compare-picker'), compared()]).toEqual([null, []])
    cleanup(); paths = []
    whatifs = { whatifs: [{ id: 'w_7', name: 'Busier week', by: 'Ada', at: 't', version: 1, edits: [], about: 'A what-if on version 1' }] }
    show(one)
    await waitFor(() => expect(paths).toContain(`/api/compare?a=${v.id}&b=w_7`))
    expect([...(screen.getByTestId('core-compare-with') as HTMLSelectElement).options].map((o) => o.value)).toEqual(['w_7'])
    expect(screen.getByTestId('core-compare-base').textContent).toBe('Version 1 with')
    expect(screen.getByTestId('core-compare-one').textContent).toBe(COMPARE_ONE_VERSIONS)
    expect(paths.some((p) => p.includes(`/scenarios/${v.id}/compare`))).toBe(false)
  })
  it('CT8b: with nothing to compare yet, the people comparison is one press where its stage can draw; CONTRAST: not before a reveal is authorised, not with two versions', async () => {
    const v = fixture('ui9-a6-since-v3')
    const one = { ...v, version: { ...v.version!, n: 1 }, model: { ...v.model!, run: { ...v.model!.run!, since: undefined } } } as View
    const { container } = show(one)
    await waitFor(() => expect(paths).toContain(`/api/scenarios/${v.id}/whatifs`))
    expect(screen.getByTestId('core-compare-one').textContent).toBe(COMPARE_ONE)
    fireEvent.click(screen.getByTestId('core-compare-people'))
    expect(useCompare.getState().open).toBe(true)
    useCompare.setState({ open: false }); cleanup()
    show({ ...one, gated: true, collab: { ...one.collab, shared: [] } } as View)
    await waitFor(() => expect(screen.getByTestId('core-compare-one')).toBeTruthy())
    expect(screen.queryByTestId('core-compare-people')).toBeNull()
    cleanup(); show(v)
    await waitFor(() => expect(screen.getByTestId('core-compare-picker')).toBeTruthy())
    expect(screen.queryByTestId('core-compare-people')).toBeNull()
    expect(container).toBeTruthy()
  })
  it('CT10: a pair that failed reads again when picked again, and draws its answer (Codex P2)', async () => {
    let failed = false
    setTeamFetch((async (u: unknown) => {
      const p = String(u); paths.push(p)
      if (p.includes('compare?from=2&to=3') && !failed) { failed = true; return new Response(JSON.stringify({ error: 'core was busy' }), { status: 500 }) }
      const body = p === '/api/me' ? me : p.endsWith('/whatifs') ? whatifs : p.endsWith('/versions') ? { versions: [] } : answer
      return new Response(JSON.stringify(body), { status: 200 })
    }) as unknown as typeof fetch)
    show(fixture('ui9-a6-since-v3'))
    expect((await screen.findByTestId('core-compare-error')).textContent).toBe('core was busy')
    const pick = screen.getByTestId('core-compare-with') as HTMLSelectElement
    fireEvent.change(pick, { target: { value: 'v:1' } })
    await screen.findByTestId('core-compare-out')
    fireEvent.change(pick, { target: { value: 'v:2' } })
    await waitFor(() => expect(compared().filter((p) => p.includes('from=2&to=3')).length).toBe(2))
    await screen.findByTestId('core-compare-out')
    expect(screen.queryByTestId('core-compare-error')).toBeNull()
  })
  it('CT9: the what-if press only where a figure can be set; CONTRAST: none settable and nothing waiting offers no press; no results says so once', async () => {
    const v = fixture('ui9-a6-since-v3')
    const settable = { ...v, model: { ...v.model!, cards: v.model!.cards.map((c, i) => (i === 0 ? { ...c, figure: { text: '5', title: 'T', edit: { prompt: 'P', ask: 'A' } } } : { ...c, figure: c.figure ? { ...c.figure, edit: null } : c.figure })) } } as View
    show(settable)
    const press = screen.getByTestId('core-compare-whatif-open')
    expect([press.textContent, press.getAttribute('aria-expanded'), screen.queryByTestId('whatif-save')]).toEqual(['Save a what-if to compare', 'false', null])
    fireEvent.click(press)
    expect([press.textContent, press.getAttribute('aria-expanded'), !!screen.queryByTestId('whatif-save')]).toEqual(['Close the what-if', 'true', true])
    fireEvent.click(press)
    expect(screen.queryByTestId('whatif-save')).toBeNull()
    cleanup()
    // A change held for approval: core offers no figure, so the press is not drawn (it could only refuse); the open form's own line is WhatIfSave's.
    show({ ...settable, proposal: { id: 9 }, model: { ...settable.model!, cards: settable.model!.cards.map((c) => ({ ...c, figure: c.figure ? { ...c.figure, edit: null } : c.figure })) } } as unknown as View)
    expect(screen.queryByTestId('core-compare-whatif-open')).toBeNull()
    cleanup()
    show({ ...settable, proposal: null, model: { ...settable.model!, cards: settable.model!.cards.map((c) => ({ ...c, figure: c.figure ? { ...c.figure, edit: null } : c.figure })) } } as View)
    expect(screen.queryByTestId('core-compare-whatif-open')).toBeNull()
    expect((await screen.findByTestId('core-compare-results-none')).textContent).toBe('No results in either version.')
    expect(screen.queryByTestId('core-compare-still')).toBeNull()
  })
})

describe('the canvas version diff (core lines typed with record_id, wip/x-compare-core frozen shape)', () => {
  const typedLines = (cardId: string): Compared['changes'] => [
    { ...LINES[0]!, record_id: cardId, kind: 'factor' },
    { ...LINES[1]!, record_id: 'not_on_this_canvas', kind: 'risk' },
    { ...LINES[2]!, record_id: null, kind: null },
  ]
  it('CT13: core\'s typed lines are the one list (no named list), a press where the card is drawn; each named card carries "Changed since version 2" with core\'s line as hover; gone when the pair goes; CONTRASTS: an unnamed card, another version on the canvas', async () => {
    const view = fixture('ui9-a6-since-v3'), cardId = view.model!.cards[0]!.id
    answer = { versions: [], changes: typedLines(cardId), results: [] }
    const tab = show(view)
    await screen.findByTestId('core-compare-out')
    expect(screen.queryByTestId('core-compare-named'), 'said once: the View\'s named list is not drawn beside typed lines').toBeNull()
    const rows = [...screen.getByTestId('core-compare-lines').querySelectorAll('[data-compare-line]')]
    expect(rows.map((r) => [r.getAttribute('data-compare-line-record'), r.querySelector('[data-compare-card]')?.getAttribute('data-compare-card') ?? null]))
      .toEqual([[cardId, cardId], ['not_on_this_canvas', null], [null, null]])
    const m = useCompareMarks.getState()
    expect([m.sid, m.from, m.to, Object.keys(m.byId)]).toEqual([view.id, 2, 3, [cardId, 'not_on_this_canvas']])
    const mark = render(<CompareCardMark id={cardId} />).container.querySelector(`[data-compare-mark="${cardId}"]`)!
    expect([mark.textContent, mark.getAttribute('title')]).toEqual([changedSince(2), '↻ figure: hours\nfrom 20 to 25'])
    expect(mark.querySelector('svg'), 'the registry\'s version icon beside the chrome words').not.toBeNull()
    expect(render(<CompareCardMark id="some_other_card" />).container.querySelector('[data-compare-mark]'), 'a card core does not name has no mark').toBeNull()
    tab.unmount()
    expect(useCompareMarks.getState().sid, 'the marks leave with the pair').toBeNull()
  })
  it('CT13b: the mark is drawn only while the canvas shows the pair\'s LATER version (control: version 3 draws it; version 2 does not), and only for that scenario', () => {
    const view = fixture('ui9-a6-since-v3'), cardId = view.model!.cards[0]!.id
    useCompareMarks.getState().show({ sid: view.id, from: 2, to: 3, byId: { [cardId]: [{ text: 'LINE', detail: '' }] } })
    const at = (n: number, sid = view.id) => {
      useViewStore.setState({ sid, view: { ...view, id: sid, version: { ...view.version!, n } } } as never)
      const { container, unmount } = render(<CompareCardMark id={cardId} />)
      const got = container.querySelector('[data-compare-mark]')?.textContent ?? null
      unmount()
      return got
    }
    expect([at(3), at(2), at(3, 's_other00000000')]).toEqual([changedSince(2), null, null])
    useCompareMarks.getState().clear()
  })
  it('CT14: more than three typed lines: three open at rest, the rest behind one press counted in words; CONTRAST CT2: an older core\'s untyped lines keep the named list', async () => {
    const view = fixture('ui9-a6-since-v3'), cardId = view.model!.cards[0]!.id
    answer = { versions: [], changes: [...typedLines(cardId), { ...LINES[0]!, record_id: 'fourth', kind: 'factor' }], results: [] }
    show(view)
    await screen.findByTestId('core-compare-out')
    expect(screen.getByTestId('core-compare-lines').querySelectorAll('[data-compare-line]').length).toBe(3)
    const more = screen.getByTestId('core-compare-more-lines')
    expect([more.hasAttribute('open'), more.querySelector('summary')!.textContent, more.querySelector('[data-compare-line]')!.getAttribute('data-compare-line-record')]).toEqual([false, moreChanges(1), 'fourth'])
    cleanup(); useCompareMarks.getState().clear()
    answer = { versions: [], changes: LINES, results: [] }
    show(view)
    await screen.findByTestId('core-compare-out')
    expect(screen.getByTestId('core-compare-named')).toBeTruthy()
    expect(useCompareMarks.getState().byId).toEqual({})
  })
})

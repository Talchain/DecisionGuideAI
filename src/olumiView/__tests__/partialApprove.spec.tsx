/**
 * Partial approval (core L8, View `proposal.changes` / `proposal.groups`; approve `only` / `only_top`, API v1.4/v1.8): core's change card,
 * each line ticked by its own id, and "Approve ticked" sends exactly the ticked lines, never more; Approve alone stays the whole proposal.
 * Core's golden (wip/v3.1-one e4b0bae): proposal.view3.json, two changed figures, no groups.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { KEPT_WITHOUT, LEAVE_OFF_SEP, NEEDED_BY, REFUSAL_NEEDS, TICK_NEEDED, WILL_LEAVE_OFF, ViewChat, useViewChat } from '../ViewChat'
import { leadLineOf, withheldWords } from '../previous/CoreCard'
import { setTeamFetch } from '../../olumiCore/team/api'
import { isOpen, setOpen } from './reviewRow'
import { tipOf } from './tipHelpers'
import { VIEW_ICON_BUTTON_PRIMARY_CLASS } from '../../v5/blocks/chipClass'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
const p = golden.proposal!

let posts: Array<{ path: string; body: unknown }> = []
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />).container
}
// CHANGED BY DESIGN (sx-panel, PANEL-SPEC 1): a closed review draws core's row and its actions only (Approve in view at rest); the change list,
// its ticks and the readings are drawn when the row is open. These rows read the list, so they open the row first, as the person does.
const showOpen = (view: View) => { const c = show(view); const r = c.querySelector('[data-testid="view-proposal-review"]'); if (r !== null) setOpen(r, true); return c }
beforeEach(() => {
  posts = []
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST') { posts.push({ path: String(u), body: JSON.parse(String(init!.body)) }); return new Response('{"version":9,"n":2,"receipt":"r"}', { status: 201 }) }
    return new Response(JSON.stringify(golden), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); useViewChat.setState({ busy: false, said: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null }) })

describe('partial approval', () => {
  it('each of core\'s lines, in order, with its tick and what a tap opens; Approve ticked sends exactly the ticked record in `only`', async () => {
    expect(p.changes.length).toBe(2)
    const c = showOpen(golden)
    p.changes.forEach((ch, i) => {
      expect(c.querySelector(`[data-view="proposal.changes.${i}.text"]`)?.textContent).toBe(ch.text)
      expect(c.querySelector(`[data-view="proposal.changes.${i}.detail"]`)?.textContent).toBe(ch.detail)
      expect(screen.getByTestId(`view-change-tick-${i}`).getAttribute('aria-label')).toBe(`Choose ${ch.text}`)
    })
    expect(screen.getByTestId('view-approve-ticked')).toHaveAttribute('aria-disabled', 'true')
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(screen.getByTestId('view-approve-ticked')).toHaveAttribute('aria-label', 'Approve ticked · 1')
    // 18 Nov: the count stays visible beside the double tick, inside the one control, and follows the ticks
    expect(screen.getByTestId('view-approve-ticked').querySelector('svg.lucide-check-check')).not.toBeNull()
    expect(screen.getByTestId('view-approve-ticked-count').textContent).toBe('1')
    expect(screen.getByTestId('view-approve-ticked').contains(screen.getByTestId('view-approve-ticked-count'))).toBe(true)
    fireEvent.click(screen.getByTestId('view-change-tick-0'))
    expect(screen.getByTestId('view-approve-ticked-count').textContent).toBe('2')
    fireEvent.click(screen.getByTestId('view-change-tick-0'))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base, only: [p.changes[1]!.id], only_top: [] } })
  })

  it('a top-level field goes in `only_top`, never `only`, even named like a record; a group\'s tick chooses every line under it', async () => {
    const changes = [p.changes[0]!, { ...p.changes[0]!, top: true, family: 'question', text: '↻ title', detail: '' }]
    const grouped = { ...golden, proposal: { ...p, changes, groups: [{ heading: 'Everything', lines: [0, 1] }] } }
    showOpen(grouped)
    fireEvent.click(screen.getByTestId('view-change-group-0'))
    expect(screen.getByTestId('view-approve-ticked')).toHaveAttribute('aria-label', 'Approve ticked · 2')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: [changes[0]!.id], only_top: [changes[0]!.id] })
  })
  it('a group box says when only SOME of its lines are ticked (a closed group never hides a part selection): mixed with one of two, checked with both, clear with none', () => {
    const changes = [p.changes[0]!, { ...p.changes[0]!, top: true, family: 'question', text: '↻ title', detail: '' }]
    showOpen({ ...golden, proposal: { ...p, changes, groups: [{ heading: 'Everything', lines: [0, 1] }] } })
    const box = () => screen.getByTestId('view-change-group-0') as HTMLInputElement
    const state = () => [box().checked, box().indeterminate, box().hasAttribute('data-group-part')]
    expect(state(), 'none ticked').toEqual([false, false, false])
    fireEvent.click(screen.getByTestId('view-change-tick-0'))
    expect(state(), 'one of two').toEqual([false, true, true])
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(state(), 'both').toEqual([true, false, false])
    fireEvent.click(screen.getByTestId('view-change-tick-0')); fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(state(), 'none again').toEqual([false, false, false])
  })

  it('DL 11 Nov, now inside the one-row review (contract 3): once the review is opened, a grouped proposal rests with every group closed, its heading and tick in view; a group opens on press and shows each of core\'s lines', () => {
    const changes = [p.changes[0]!, { ...p.changes[0]!, top: true, family: 'question', text: '↻ title', detail: '' }]
    show({ ...golden, proposal: { ...p, changes, groups: [{ heading: 'Everything', lines: [0, 1] }] } })
    // Contract 3: the proposal is drawn only when the person opens the review; the rule the row binds is the same, one level down.
    const review = screen.getByTestId('view-proposal-review')
    expect(isOpen(review)).toBe(false)
    setOpen(review, true)
    const box = screen.getByTestId('view-change-group-box-0') as HTMLDetailsElement
    expect(box.open).toBe(false)
    expect(screen.getByText('Everything')).toBeVisible()
    expect(screen.getByTestId('view-change-group-0'), 'the group\'s own tick is in the resting view').toBeVisible()
    box.open = true
    expect(screen.getByTestId('view-change-tick-0')).toBeVisible()
    expect(screen.getByTestId('view-change-tick-1')).toBeVisible()
  })
  it('the filled button follows the ticks (Codex root 21:10Z, 18 Nov): nothing ticked, the filled button is the whole proposal; a line ticked, the filled button is Approve ticked, first, and the whole proposal is the quiet one saying how many lines it takes; unticked, back as it was. What each sends does not change', async () => {
    showOpen(golden)
    const filled = (id: string) => VIEW_ICON_BUTTON_PRIMARY_CLASS.split(' ').every((k) => screen.getByTestId(id).classList.contains(k))
    const first = () => screen.getByTestId('view-proposal-actions').querySelector('[data-testid="view-approve"],[data-testid="view-approve-ticked"]')?.getAttribute('data-testid')
    const rest = () => [filled('view-approve'), filled('view-approve-ticked'), first(), screen.getByTestId('view-approve').getAttribute('aria-label'), screen.queryByTestId('view-approve-count')?.textContent ?? null]
    expect(rest(), 'nothing ticked').toEqual([true, false, 'view-approve', 'Approve these changes', null])
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(rest(), 'one line ticked: the green button is the ticked one').toEqual([false, true, 'view-approve-ticked', `Approve all · ${p.changes.length}`, String(p.changes.length)])
    expect(screen.getByTestId('view-approve-ticked')).toHaveAttribute('aria-label', 'Approve ticked · 1')
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(rest(), 'unticked again').toEqual([true, false, 'view-approve', 'Approve these changes', null])
    // The filled button, pressed with one line ticked, sends that line and no other.
    fireEvent.click(screen.getByTestId('view-change-tick-0'))
    fireEvent.click(screen.getByTestId(first()!))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base, only: [p.changes[0]!.id], only_top: [] } })
  })
  it('a selection is never dropped silently (Codex root 21:24Z): with a line ticked, collapsing the review leaves NO approve control; the filled button reopens the review with the ticks kept, and nothing was sent. CONTRAST: collapsed with nothing ticked, the filled button is the whole proposal as before', async () => {
    const c = showOpen(golden), review = c.querySelector('[data-testid="view-proposal-review"]')!
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    setOpen(review, false)
    expect(isOpen(review), 'fixture: the review is collapsed').toBe(false)
    expect([screen.queryByTestId('view-approve'), screen.queryByTestId('view-approve-ticked'), screen.queryByTestId('view-review-changes') !== null]).toEqual([null, null, true])
    fireEvent.click(screen.getByTestId('view-review-changes'))
    expect(isOpen(review)).toBe(true)
    expect([(screen.getByTestId('view-change-tick-1') as HTMLInputElement).checked, screen.getByTestId('view-approve-ticked').getAttribute('aria-label')], 'the ticks are kept').toEqual([true, 'Approve ticked · 1'])
    expect(posts, 'nothing was approved by collapsing or reopening').toHaveLength(0)
    // CONTRAST: untick, collapse: nothing is chosen, so the closed review offers the whole proposal as it always did.
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    setOpen(review, false)
    expect([screen.getByTestId('view-approve').getAttribute('aria-label'), screen.queryByTestId('view-approve-ticked'), screen.queryByTestId('view-review-changes')]).toEqual(['Approve these changes', null, null])
  })
  it('a refused approval is said IN the review, beside the actions, in core\'s words, once (015): not under the message box; the ticks stay as they were', async () => {
    const WORDS = 'the chosen changes need ‘A figure’; choose them too'
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST') { posts.push({ path: String(u), body: JSON.parse(String(init!.body)) }); return new Response(JSON.stringify({ error: WORDS }), { status: 409 }) }
      return new Response(JSON.stringify(golden), { status: 200 })
    }) as typeof fetch)
    const c = showOpen(golden)
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(screen.queryByTestId('view-proposal-said')).not.toBeNull())
    const said = screen.getByTestId('view-proposal-said')
    expect([said.textContent, said.getAttribute('role'), c.querySelector('[data-testid="view-chat-proposal"]')!.contains(said), useViewChat.getState().said]).toEqual([WORDS, 'alert', true, null])
    expect((screen.getByTestId('view-change-tick-1') as HTMLInputElement).checked, 'the selection is kept').toBe(true)
    expect(posts).toHaveLength(1)
  })
  it('core\'s REQUIRED needs are kept whole and shown (015; Codex root 21:32Z): ticking a line ticks what it requires and what THAT requires, each saying why at rest; unticking a needed line unticks every line that needs it; unticking the first line leaves the others; the payload is the ticked set. CONTRAST: a line core marks with nothing is ticked alone and says nothing', async () => {
    const base = p.changes[0]!
    // Core's REQUIRED needs (mandatory, all of them); core sends each line's needs already followed to the end, and the page follows them again by id.
    const mk = (id: string, text: string, ids: string[] | null) => ({ ...base, id, top: false, text, detail: '', together: null, needs: (ids ?? []).map((n) => ({ id: n, top: false, kind: 'required', why: `why ${id}` })) })
    const changes = [mk('a', 'line A', ['b']), mk('b', 'line B', ['c']), mk('c', 'line C', null), mk('d', 'line D', null)]
    const c = showOpen({ ...golden, proposal: { ...p, changes, groups: null } } as unknown as View)
    const tick = (i: number) => screen.getByTestId(`view-change-tick-${i}`) as HTMLInputElement
    const ticks = () => [0, 1, 2, 3].map((i) => tick(i).checked)
    const why = (i: number) => screen.queryByTestId(`view-change-why-${i}`)?.textContent ?? null, by = (i: number) => screen.queryByTestId(`view-change-needed-by-${i}`)?.textContent ?? null
    fireEvent.click(tick(0))
    expect(ticks(), 'A brings B, and B brings C').toEqual([true, true, true, false])
    expect([by(0), by(1), by(2), c.querySelector('[data-view="proposal.changes.0.needs.0.why"]')?.textContent, c.querySelector('[data-view="proposal.changes.1.needs.0.why"]')?.textContent]).toEqual([null, `${NEEDED_BY} line A`, `${NEEDED_BY} line B`, 'why a', 'why b'])
    fireEvent.click(tick(2))
    expect(ticks(), 'C unticked: B needs it and leaves, then A').toEqual([false, false, false, false])
    fireEvent.click(tick(0)); fireEvent.click(tick(0))
    expect(ticks(), 'A unticked: nothing needs A, so B and C stay, in view').toEqual([false, true, true, false])
    expect([by(1), by(2)]).toEqual([null, `${NEEDED_BY} line B`])
    fireEvent.click(tick(3))
    expect([ticks(), why(3), by(3)], 'a line with no partners: ticked alone, nothing said').toEqual([[false, true, true, true], null, null])
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: ['b', 'c', 'd'], only_top: [] })
  })
  // Core's review-boundary contract (DL, 18 Nov 21:51Z): `changes[].needs [{ id, top, kind: 'required' | 'optional', why }]`, the approval's `without`, the typed 409.
  const base0 = p.changes[0]!
  const need = (id: string, kind: 'required' | 'optional', why: string) => ({ id, top: false, kind, why })
  const ln = (id: string, text: string, needs: ReturnType<typeof need>[] = []) => ({ ...base0, id, top: false, text, detail: '', together: null, needs })
  // h: a person's own words that Olumi tied to its note n (optional); f: a line that needs figure q (required); q and n: Olumi's additions.
  const boundary = () => ({ ...golden, proposal: { ...p, groups: null, changes: [ln('h', 'their claim', [need('n', 'optional', 'core says: an association of Olumi’s')]), ln('n', 'Olumi’s note'), ln('f', 'a calculation', [need('q', 'required', 'core says: it reads this figure')]), ln('q', 'a figure')] } }) as unknown as View
  const tickOf = (i: number) => screen.getByTestId(`view-change-tick-${i}`) as HTMLInputElement
  it('core\'s `needs` (the review-boundary contract): a REQUIRED need is ticked with the line and says core\'s why; an OPTIONAL one (Olumi\'s association on a person\'s own words) is never ticked for them: the kept line says what it is kept without, and the approval states it in `without`. CONTRAST: ticking the note too sends no `without`', async () => {
    const c = showOpen(boundary())
    fireEvent.click(tickOf(0))
    expect([0, 1, 2, 3].map((i) => tickOf(i).checked), 'their claim alone: Olumi’s note is not ticked for them').toEqual([true, false, false, false])
    const off = screen.getByTestId('view-change-without-0')
    expect([off.textContent, off.getAttribute('data-view')]).toEqual([`${KEPT_WITHOUT} Olumi’s note · core says: an association of Olumi’s`, 'proposal.changes.0.needs.0.why'])
    fireEvent.click(tickOf(2))
    expect([0, 1, 2, 3].map((i) => tickOf(i).checked), 'the calculation brings its figure').toEqual([true, false, true, true])
    expect([screen.getByTestId('view-change-needed-by-3').textContent, c.querySelector('[data-view="proposal.changes.2.needs.0.why"]')?.textContent]).toEqual([`${NEEDED_BY} a calculation`, 'core says: it reads this figure'])
    fireEvent.click(tickOf(3))
    expect([0, 1, 2, 3].map((i) => tickOf(i).checked), 'the figure unticked: the line that needs it leaves with it').toEqual([true, false, false, false])
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: ['h'], only_top: [], without: [{ id: 'h', concerns: ['n'] }] })
    cleanup(); posts.length = 0
    showOpen(boundary())
    fireEvent.click(tickOf(0)); fireEvent.click(tickOf(1))
    expect(screen.queryByTestId('view-change-without-0'), 'the note is ticked too: nothing is left off').toBeNull()
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: ['h', 'n'], only_top: [] })
  })
  it('every omission is said beside the approve controls, OUTSIDE any group (Codex root 22:08Z): a group ticked while CLOSED still shows, before the press, what Approve ticked will leave off; the payload is the same. CONTRAST: nothing left off, nothing said', async () => {
    const grouped = boundary() as unknown as { proposal: { groups: unknown } }
    grouped.proposal.groups = [{ heading: 'Statements', lines: [0] }, { heading: 'Olumi’s additions', lines: [1, 2, 3] }]
    showOpen(grouped as unknown as View)
    const group0 = screen.getByTestId('view-change-group-box-0') as HTMLDetailsElement
    expect(group0.open, 'fixture: the group is closed').toBe(false)
    expect(screen.queryByTestId('view-proposal-leave-off')).toBeNull()
    // The statements group ticked from its CLOSED heading: the claim is chosen, Olumi's note (in the other, closed group) is not.
    fireEvent.click(screen.getByTestId('view-change-group-0'))
    const box = screen.getByTestId('view-proposal-leave-off')
    // In the card's foot with the actions (kept in view together by the stylesheet), never inside a group.
    expect([group0.open, box.closest('details'), box.textContent, box.closest('[data-testid="view-proposal-foot"]')?.contains(screen.getByTestId('view-proposal-actions'))])
      .toEqual([false, null, `${WILL_LEAVE_OFF}their claim · ${LEAVE_OFF_SEP} Olumi’s note`, true])
    // CONTRAST: the note ticked too, nothing is left off, nothing is said; untick it again and it is said again.
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(screen.queryByTestId('view-proposal-leave-off')).toBeNull()
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(screen.queryByTestId('view-proposal-leave-off')).not.toBeNull()
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: ['h'], only_top: [], without: [{ id: 'h', concerns: ['n'] }] })
  })
  it('core\'s ONE_OF (core 2f0235e0): a figure that needs one of two readers ticks neither for the person; once ticked it says core\'s why until one reader is ticked; either one satisfies it. CONTRAST: a refusal naming the group marks the readers and offers no automatic tick for them', () => {
    const one = (id: string) => ({ id, top: false, kind: 'one_of' as const, why: 'core says: read only by ‘r1’, ‘r2’; choose one of them too' })
    showOpen({ ...golden, proposal: { ...p, groups: null, changes: [{ ...ln('f', 'a figure'), needs: [one('r1'), one('r2')] }, ln('r1', 'reader one', [need('f', 'required', 'core says: reads f')]), ln('r2', 'reader two', [need('f', 'required', 'core says: reads f')])] } } as unknown as View)
    const tick = (i: number) => screen.getByTestId(`view-change-tick-${i}`) as HTMLInputElement
    fireEvent.click(tick(0))
    expect([[0, 1, 2].map((i) => tick(i).checked), screen.getByTestId('view-change-one-of-0').textContent, screen.getByTestId('view-change-one-of-0').getAttribute('data-view')]).toEqual([[true, false, false], 'core says: read only by ‘r1’, ‘r2’; choose one of them too', 'proposal.changes.0.needs.0.why'])
    fireEvent.click(tick(2))
    expect([[0, 1, 2].map((i) => tick(i).checked), screen.queryByTestId('view-change-one-of-0')], 'reader two satisfies it; reader one is not ticked').toEqual([[true, false, true], null])
  })
  it('a refused ONE_OF (core 2f0235e0 as served): a group with ONE member is ticked by the one press (no choice to make); a group of TWO is marked and never ticked for the person', async () => {
    const one = (id: string) => ({ id, top: false, kind: 'one_of' as const, why: 'core says: choose one of them too' })
    const lines = [{ ...ln('f', 'a figure'), needs: [one('r1')] }, ln('r1', 'reader one', [need('f', 'required', 'core says: reads f')]), { ...ln('g', 'another figure'), needs: [one('s1'), one('s2')] }, ln('s1', 'reader s1'), ln('s2', 'reader s2')]
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST') { posts.push({ path: String(u), body: JSON.parse(String(init!.body)) }); return new Response(JSON.stringify({ error: 'core’s sentence', code: 'needs', needs: [{ of: 'f', id: 'r1', top: false, kind: 'one_of', why: 'w1' }, { of: 'g', id: 's1', top: false, kind: 'one_of', why: 'w2' }, { of: 'g', id: 's2', top: false, kind: 'one_of', why: 'w2' }] }), { status: 409 }) }
      return new Response(JSON.stringify(golden), { status: 200 })
    }) as typeof fetch)
    showOpen({ ...golden, proposal: { ...p, groups: null, changes: lines } } as unknown as View)
    const tick = (i: number) => screen.getByTestId(`view-change-tick-${i}`) as HTMLInputElement
    fireEvent.click(tick(0)); fireEvent.click(tick(2))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(screen.queryByTestId('view-tick-needed')).not.toBeNull())
    expect([1, 3, 4].map((i) => screen.queryByTestId(`view-change-refused-${i}`) !== null), 'all three marked').toEqual([true, true, true])
    fireEvent.click(screen.getByTestId('view-tick-needed'))
    expect([0, 1, 2, 3, 4].map((i) => tick(i).checked), 'the sole reader ticked; s1 and s2 left to the person').toEqual([true, true, true, false, false])
  })
  it('a stated omission is part of the approval (core semantics 9): after an approval whose answer never came, a CHANGED omission is not sent; the same one is', async () => {
    let n = 0
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST') { posts.push({ path: String(u), body: JSON.parse(String(init!.body)) }); n++; return n === 1 ? new Response('{}', { status: 502 }) : new Response('{"version":9,"n":2,"receipt":"r"}', { status: 201 }) }
      return new Response(JSON.stringify(golden), { status: 200 })
    }) as typeof fetch)
    showOpen(boundary())
    fireEvent.click(tickOf(0))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    await waitFor(() => expect(screen.queryByTestId('view-proposal-said')).not.toBeNull())
    fireEvent.click(tickOf(1))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    expect([posts.length, screen.queryByTestId('view-readings-refused') !== null], 'the omission changed: nothing sent').toEqual([1, true])
    fireEvent.click(tickOf(1))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]!.body).toEqual(posts[0]!.body)
  })
  it('core\'s typed refusal (409 `code: needs`): the named line is MARKED with core\'s why and nothing is ticked for the person; one press of theirs ticks it. CONTRAST: a refusal with no code marks nothing and offers no press', async () => {
    const refuse = (body: object) => setTeamFetch((async (u: unknown, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST') { posts.push({ path: String(u), body: JSON.parse(String(init!.body)) }); return new Response(JSON.stringify(body), { status: 409 }) }
      return new Response(JSON.stringify(golden), { status: 200 })
    }) as typeof fetch)
    refuse({ error: 'core’s sentence', code: 'needs', needs: [{ of: 'h', id: 'q', top: false, kind: 'required', why: 'core says: this is needed' }] })
    showOpen(boundary())
    fireEvent.click(tickOf(0))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(screen.queryByTestId('view-change-refused-3')).not.toBeNull())
    expect([screen.getByTestId('view-change-refused-3').textContent, screen.getByTestId('view-proposal-said').textContent, tickOf(3).checked, [0, 1, 2].map((i) => screen.queryByTestId(`view-change-refused-${i}`))]).toEqual([`${REFUSAL_NEEDS} core says: this is needed`, 'core’s sentence', false, [null, null, null]])
    expect(screen.getByTestId('view-tick-needed').textContent).toBe(TICK_NEEDED)
    fireEvent.click(screen.getByTestId('view-tick-needed'))
    expect([[0, 1, 2, 3].map((i) => tickOf(i).checked), screen.queryByTestId('view-change-refused-3'), screen.queryByTestId('view-tick-needed')]).toEqual([[true, false, false, true], null, null])
    cleanup(); posts.length = 0
    refuse({ error: 'another refusal' })
    showOpen(boundary())
    fireEvent.click(tickOf(0))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(screen.queryByTestId('view-proposal-said')).not.toBeNull())
    expect([screen.getByTestId('view-proposal-said').textContent, screen.queryByTestId('view-tick-needed'), [0, 1, 2, 3].map((i) => screen.queryByTestId(`view-change-refused-${i}`))]).toEqual(['another refusal', null, [null, null, null, null]])
  })
  it('ANY-OF stays any-of (contract item 8): `together` is one step and never enforced by the page. A figure whose `together` lists two alternative readers is ticked with them, and unticking ONE reader leaves the figure and the other reader ticked (core needs one, not both); a partner\'s own partner is not followed', () => {
    const tg = (id: string, text: string, ids: string[] | null) => ({ ...p.changes[0]!, id, top: false, text, detail: '', together: ids === null ? null : { ids, why: `why ${id}` } })
    showOpen({ ...golden, proposal: { ...p, groups: null, changes: [tg('fig', 'a figure', ['r1', 'r2']), tg('r1', 'reader one', ['x']), tg('r2', 'reader two', null), tg('x', 'further', null)] } })
    const tick = (i: number) => screen.getByTestId(`view-change-tick-${i}`) as HTMLInputElement
    fireEvent.click(tick(0))
    expect([0, 1, 2, 3].map((i) => tick(i).checked), 'the figure and its listed partners, one step: reader one’s own partner is not followed').toEqual([true, true, true, false])
    expect(screen.getByTestId('view-change-why-0').textContent, 'core’s why, at rest once ticked').toBe('why fig')
    fireEvent.click(tick(2))
    expect([0, 1, 2, 3].map((i) => tick(i).checked), 'one reader unticked: the figure stays with the other').toEqual([true, true, false, false])
  })
  it('must not change: Approve is still the whole proposal (`base` alone); one line, or none, has no ticks', async () => {
    showOpen(golden)
    fireEvent.click(screen.getByTestId('view-change-tick-0'))
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base } })
    cleanup()
    // One line is the whole proposal: the line is drawn, with no tick and no second Approve.
    const one = showOpen({ ...golden, proposal: { ...p, changes: [p.changes[0]!] } })
    expect(one.querySelector('[data-view="proposal.changes.0.text"]')?.textContent).toBe(p.changes[0]!.text)
    expect(one.querySelector('[data-testid^="view-change-tick-"]')).toBeNull()
    expect(screen.queryByTestId('view-approve-ticked')).toBeNull()
    cleanup()
    const c = showOpen({ ...golden, proposal: { ...p, changes: [], groups: null } })
    expect(c.querySelector('[data-testid^="view-change-tick-"]')).toBeNull()
    expect(screen.queryByTestId('view-approve-ticked')).toBeNull()
    cleanup()
    // A core before L8 serves no list at all: the card still draws, with Approve alone.
    const older: Record<string, unknown> = { ...p }
    delete older.changes; delete older.groups
    showOpen({ ...golden, proposal: older as unknown as View['proposal'] })
    expect(screen.getByTestId('view-approve')).toHaveAccessibleName(/Approve/)
    expect(screen.queryByTestId('view-approve-ticked')).toBeNull()
  })
})

/**
 * R4 (DL 4 Nov, "never orphan Olumi's figure silently"; core 1dd2ca9, API v1.13): an added figure read only by other lines of its proposal is
 * approved only with one of them, and olumi.view/3 marks each such line `together: { ids, why }`. A tick on one ticks the lines it is marked
 * with; core's `why` is that line's hover. The View is core's own (fixtures/real/together.view3.json, from core's approve path).
 */
describe('a figure and the line that reads it are ticked together', () => {
  const pair: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'together.view3.json'), 'utf8'))
  const lines = pair.proposal!.changes
  const at = (id: string) => lines.findIndex((l) => l.id === id)
  const ticks = () => lines.map((_, i) => (screen.getByTestId(`view-change-tick-${i}`) as HTMLInputElement).checked)

  it('core marks the figure and its option, and nothing else (the fixture is the pair)', () => {
    expect(lines.map((l) => [l.id, l.together?.ids ?? null])).toEqual([['two_specialists', ['add_two']], ['add_two', ['two_specialists']], ['c_extra', null]])
  })

  it('ticking Olumi\'s figure ticks its option, untick either and both go; Approve ticked sends the two', async () => {
    showOpen(pair)
    fireEvent.click(screen.getByTestId(`view-change-tick-${at('two_specialists')}`))
    expect(ticks()).toEqual([true, true, false])
    fireEvent.click(screen.getByTestId(`view-change-tick-${at('add_two')}`))
    expect(ticks()).toEqual([false, false, false])
    fireEvent.click(screen.getByTestId(`view-change-tick-${at('add_two')}`))
    expect(ticks()).toEqual([true, true, false])
    expect(screen.getByTestId('view-approve-ticked')).toHaveAttribute('aria-label', 'Approve ticked · 2')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: pair.proposal!.base, only: ['two_specialists', 'add_two'], only_top: [] })
  })

  it('each marked line carries core\'s why as its hover (the one Tip, never a native title), verbatim; an unmarked line has none', async () => {
    const c = showOpen(pair)
    for (const [i, l] of lines.entries()) {
      const hover = c.querySelector<HTMLElement>(`[data-view-hover="proposal.changes.${i}.together.why"]`)
      expect(hover?.hasAttribute('title') ?? false, `${l.id}: no native title`).toBe(false)
      // A line with a detail is one summary: it owns ONE Tip, core's why first and, on a line of Olumi's, core's title for Olumi's mark after it (one hover, not two).
      const words = hover === null ? null : await tipOf(hover)
      expect(words === null ? null : words.split('\n')[0], l.id).toBe(l.together?.why ?? null)
      if (words !== null) expect(words, `${l.id}: why, then Olumi's mark`).toBe([l.together?.why, l.olumi?.title].filter((w): w is string => typeof w === 'string' && w !== '').join('\n'))
    }
  })

  it('CONTRAST: a line core marks with nothing is ticked alone', () => {
    showOpen(pair)
    fireEvent.click(screen.getByTestId(`view-change-tick-${at('c_extra')}`))
    expect(ticks()).toEqual([false, false, true])
  })
})

/**
 * Contract 3 minimum (ONE-PLAN 15 Nov: "the pending review collapses to one row; all changes can be read without approving"). Each CATCH names
 * the line of the product before this change that makes it fail.
 */
describe('contract 3: the waiting proposal is one row, closed at rest', () => {
  const row = () => screen.getByTestId('view-proposal-row')
  const review = () => screen.getByTestId('view-proposal-review')

  it('CATCH: at rest the review is closed and shows only core\'s heading line (before: NextStepCard drew <Proposal> open under a "Next step" header, so no view-proposal-review existed and the actions were in view)', () => {
    const c = show(golden)
    const section = screen.getByTestId('view-next-step')
    expect(section.getAttribute('data-step')).toBe('approve')
    expect(section.getAttribute('aria-label')).toBe('Next step')
    expect(screen.getByTestId('view-chat-pinned').contains(section), 'still in the pinned box').toBe(true)
    expect(isOpen(review())).toBe(false)
    expect(row().tagName).toBe('SPAN')
    expect(row().textContent).toBe(`${p.heading} · ${p.on}`)
    expect(row().querySelector('[data-view="proposal.heading"]')?.textContent).toBe(p.heading)
    expect(row().querySelector('[data-view="proposal.on"]')?.textContent).toBe(p.on)
    // The heading is drawn once (the row's own line), not again inside the body.
    expect(c.querySelectorAll('[data-view="proposal.heading"]')).toHaveLength(1)
    expect(screen.queryByText('Next step'), 'no "Next step" header for this kind').toBeNull()
    expect(row()).not.toBeVisible()
    fireEvent.click(screen.getByTestId('view-chat-foot-proposal'))
    expect(row()).toBeVisible()
    // CHANGED BY DESIGN (sx-panel, PANEL-SPEC 1, UI owner 16 Nov: "one filled button ... never below the fold, never folded away"): closed, the
    // card keeps Approve and Set aside in view; the changes still wait for a press. Was: the actions were hidden with the list.
    expect(screen.getByTestId('view-proposal-actions'), 'closed: Approve and Set aside are in view').toBeVisible()
    expect(screen.getByTestId('view-approve')).toBeVisible()
    expect(screen.queryByTestId('view-approve-ticked'), 'closed: no ticks, so no Approve ticked').toBeNull()
    expect(screen.queryByTestId('view-changes'), 'closed: the changes are not on screen').toBeNull()
    expect(screen.getByTestId('view-chat-pinned').className).not.toContain('min-h-[112px]')
  })

  it('CATCH: opening the row shows every change, core\'s words for each, and the actions, without approving (before: the actions were never behind a row)', () => {
    const c = show(golden)
    setOpen(review(), true)
    expect(screen.getByTestId('view-changes')).toBeVisible()
    p.changes.forEach((ch, i) => {
      expect(c.querySelector(`[data-view="proposal.changes.${i}.text"]`)?.textContent).toBe(ch.text)
      expect(screen.getByTestId(`view-change-tick-${i}`)).toBeVisible()
    })
    expect(screen.getByTestId('view-proposal-actions')).toBeVisible()
    expect(screen.getByTestId('view-approve-ticked')).toBeVisible()
    expect(posts, 'reading is not approving').toHaveLength(0)
  })

  it('CATCH: pressing Review opens the list and a second press closes it again; a new proposal starts closed', () => {
    show(golden)
    const toggle = screen.getByTestId('view-proposal-review-toggle')
    fireEvent.click(screen.getByTestId('view-chat-foot-proposal'))
    fireEvent.click(toggle)
    expect(isOpen(review())).toBe(true)
    expect(screen.getByTestId('view-changes')).toBeVisible()
    fireEvent.click(toggle)
    expect(isOpen(review())).toBe(false)
    // CHANGED BY DESIGN (sx-panel, PANEL-SPEC 1): closing hides the list; the actions stay in view. Was: the actions hid with it.
    expect(screen.queryByTestId('view-changes')).toBeNull()
    expect(screen.getByTestId('view-proposal-actions')).toBeVisible()
    cleanup()
    show({ ...golden, proposal: { ...p, id: p.id + 1 } })
    expect(isOpen(review()), 'the details is keyed on the proposal id').toBe(false)
  })

  it('CATCH: the readings rule moves nothing while the review is closed (before: land() ran regardless and sized the box from rows that are not on screen)', () => {
    const box = () => screen.getByTestId('view-chat-pinned')
    let fire: (() => void)[] = []
    const ro = globalThis.ResizeObserver
    globalThis.ResizeObserver = class { constructor(cb: ResizeObserverCallback) { fire.push(() => cb([], this as unknown as ResizeObserver)) } observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
    try {
      const mark = { what: 'Budget', status: 'not yet confirmed', title: 'A figure of Olumi\'s', reading: { id: 'r1' } } as unknown as NonNullable<View['proposal']>['marks'][number]
      show({ ...golden, you: 'Paul', proposal: { ...p, marks: [mark] } })
      box().style.maxHeight = '200px'
      fire.forEach((f) => f())
      expect(box().style.maxHeight, 'closed: the box keeps its own height').toBe('')
      expect(isOpen(review())).toBe(false)
    } finally { globalThis.ResizeObserver = ro }
  })

  it('CATCH: the stylesheet\'s readings rules apply only while the review is open (before: bare `.ok-pinned [data-reading-row]` hid More ways and squeezed the thread at rest)', () => {
    const css = readFileSync(path.resolve('src/olumiView/look', 'olumiLook.css'), 'utf8')
    expect(css).toContain(".ok-pinned:not([hidden]):has([data-foot-source=proposal]:not([hidden]) [data-review-body]:not([hidden]) [data-reading-row]) { flex-shrink: 1; }")
    expect(css).toContain("[data-testid='view-chat']:has(.ok-pinned:not([hidden]) [data-foot-source=proposal]:not([hidden]) [data-review-body]:not([hidden]) [data-reading-row]) > [data-testid='view-more-ways'] { display: none; }")
    expect(css).toContain("[data-testid='view-chat']:has(.ok-pinned:not([hidden]) [data-foot-source=proposal]:not([hidden]) [data-review-body]:not([hidden]) [data-reading-row]) > [data-thread-wrap] { min-height: 0; overflow: hidden; }")
    // CONTRAST: the old, unconditional selectors are gone.
    expect(css).not.toContain(".ok-pinned:has([data-reading-row])")
    expect(css).not.toContain(":has(.ok-pinned [data-reading-row])")
  })
})

/**
 * Contract 3 (ONE-PLAN 15 Nov): a card with no chance shows the outcome's blocker in plain words, never "No chance yet". Core's own View
 * (__tests__/fixtures/live-loop11-workshop-r3-pending.view.json, two options withheld, two with a chance), bound by card id.
 */
describe('contract 3: a withheld chance says why, in core\'s words', () => {
  const pending: View = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures', 'live-loop11-workshop-r3-pending.view.json'), 'utf8'))
  const card = (id: string) => structuredClone(pending.model!.cards.find((c) => c.id === id)!)

  it('CATCH: a withheld option\'s words are core\'s `why`, not `text` "No chance yet" (before: leadLineOf returned headline.text)', () => {
    for (const id of ['open_on_sundays', 'stop_taking_e_bike_jobs']) {
      const h = card(id).headline!
      expect(h.state, id).toBe('none')
      expect(h.text, `${id}: core still sends the bare words`).toBe('No chance yet')
      expect(h.why, id).toBeTruthy()
      expect(withheldWords(h), id).toBe(h.why)
      expect(leadLineOf(card(id)), id).toBe(h.why)
      expect(leadLineOf(card(id)), id).not.toBe('No chance yet')
    }
  })

  it('the field used is picked in order: `why`, else `title`, else `text`', () => {
    const h = card('open_on_sundays').headline!
    expect(withheldWords({ ...h, why: null, title: 'T', text: 'X' })).toBe('T')
    expect(withheldWords({ ...h, why: '', title: 'T', text: 'X' })).toBe('T')
    expect(withheldWords({ ...h, why: null, title: '', text: 'X' })).toBe('X')
    expect(withheldWords({ ...h, why: 'W', title: 'T', text: 'X' })).toBe('W')
  })

  it('CONTRAST: an option with a chance has no withheld words and keeps core\'s headline text', () => {
    for (const id of ['hire_a_part_time_mechanic', 'leave_things_as_they_are']) {
      const c = card(id)
      expect(c.headline!.state, id).toBe('chance')
      expect(withheldWords(c.headline!), id).toBeNull()
      expect(leadLineOf(c), id).toBe(c.headline!.text)
    }
  })
})

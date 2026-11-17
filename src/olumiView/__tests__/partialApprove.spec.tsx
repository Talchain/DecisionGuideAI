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
import { ViewChat, useViewChat } from '../ViewChat'
import { leadLineOf, withheldWords } from '../previous/CoreCard'
import { setTeamFetch } from '../../olumiCore/team/api'
import { isOpen, setOpen } from './reviewRow'

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
    expect(screen.getByTestId('view-approve-ticked')).toBeDisabled()
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(screen.getByTestId('view-approve-ticked')).toHaveTextContent('Approve ticked · 1')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base, only: [p.changes[1]!.id], only_top: [] } })
  })

  it('a top-level field goes in `only_top`, never `only`, even named like a record; a group\'s tick chooses every line under it', async () => {
    const changes = [p.changes[0]!, { ...p.changes[0]!, top: true, family: 'question', text: '↻ title', detail: '' }]
    const grouped = { ...golden, proposal: { ...p, changes, groups: [{ heading: 'Everything', lines: [0, 1] }] } }
    showOpen(grouped)
    fireEvent.click(screen.getByTestId('view-change-group-0'))
    expect(screen.getByTestId('view-approve-ticked')).toHaveTextContent('Approve ticked · 2')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: [changes[0]!.id], only_top: [changes[0]!.id] })
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
  it('must not change: Approve is still the whole proposal (`base` alone); one line, or none, has no ticks', async () => {
    showOpen(golden)
    fireEvent.click(screen.getByTestId('view-change-tick-0'))
    fireEvent.click(screen.getByText('Approve'))
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
    expect(screen.getByText('Approve')).toBeInTheDocument()
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
    expect(screen.getByTestId('view-approve-ticked')).toHaveTextContent('Approve ticked · 2')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: pair.proposal!.base, only: ['two_specialists', 'add_two'], only_top: [] })
  })

  it('each marked line carries core\'s why as its hover, verbatim; an unmarked line has none', () => {
    const c = showOpen(pair)
    lines.forEach((l, i) => {
      const hover = c.querySelector(`[data-view-hover="proposal.changes.${i}.together.why"]`)
      expect(hover?.getAttribute('title') ?? null, l.id).toBe(l.together?.why ?? null)
    })
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
    expect(row().tagName).toBe('BUTTON')
    expect(row().textContent).toBe(`${p.heading} · ${p.on}`)
    expect(row().querySelector('[data-view="proposal.heading"]')?.textContent).toBe(p.heading)
    expect(row().querySelector('[data-view="proposal.on"]')?.textContent).toBe(p.on)
    // The heading is drawn once (the row's own line), not again inside the body.
    expect(c.querySelectorAll('[data-view="proposal.heading"]')).toHaveLength(1)
    expect(screen.queryByText('Next step'), 'no "Next step" header for this kind').toBeNull()
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

  it('CATCH: pressing the row opens it and a second press closes it again; a new proposal starts closed (before: no row to press)', () => {
    show(golden)
    const row = screen.getByTestId('view-proposal-row')
    fireEvent.click(row)
    expect(isOpen(review())).toBe(true)
    expect(screen.getByTestId('view-changes')).toBeVisible()
    fireEvent.click(row)
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
    expect(css).toContain(".ok-pinned:has([data-review-body]:not([hidden]) [data-reading-row]) { flex-shrink: 1; }")
    expect(css).toContain("[data-testid='view-chat']:has(.ok-pinned [data-review-body]:not([hidden]) [data-reading-row]) > [data-testid='view-more-ways'] { display: none; }")
    expect(css).toContain("[data-testid='view-chat']:has(.ok-pinned [data-review-body]:not([hidden]) [data-reading-row]) > [data-thread-wrap] { min-height: 0; overflow: hidden; }")
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

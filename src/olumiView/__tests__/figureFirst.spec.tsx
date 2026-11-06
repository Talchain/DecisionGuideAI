/**
 * "Let us give our figure first" on the Olumi tab (canon wave step 4; core API `GET …/figure-first`, `POST …/figure-first`, `POST
 * …/figure-first/show`, the View's `session.figure_first`). Bound by identity: every drawn word is core's own at its place, each request body
 * is exactly the route's, and the entry never draws Olumi's figure (contrast: the side by side does). Everything here is core's own answer,
 * read from a scripted olumi-core (wip/r16-estimate-first 53e7ffe, the "rich" model, no AI calls): Ana's View with the offer, her blind
 * entry, her View after giving "1 to 2" (`given-range`), Cy's after giving "2" (`given-point`), Ben's show answer and his View after it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { setTeamFetch } from '../../olumiCore/team/api'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewChat, ViewComposer, useViewChat } from '../ViewChat'

const DIR = path.resolve('src/olumiView/fixtures/figure-first')
const json = <T,>(n: string): T => JSON.parse(readFileSync(path.join(DIR, n), 'utf8'))
const view = (n: string): View => json<View>(`${n}.view3.json`)
type Entry = { quantity: string; version: number; heading: string; question: string; ask: string; note: string; feeds_text: string | null; show: string }
type Given = { label: string; theirs: { text: string; title: string; value?: number; low?: number; high?: number }; olumi: { text: string; title: string; basis: string; low: number; high: number; likely: number | null }; seen_before: { text: string }; adopted: { text: string } | null; note: string }
type FF = { offer: { quantity: string; label: string; text: string } | null; given: Given | null; headings: Record<'theirs' | 'olumi' | 'basis' | 'seen' | 'adopted', string> }
const ffOf = (v: View): FF => (v as unknown as { session: { figure_first: FF } }).session.figure_first
const ENTRY = json<Entry>('entry.json')
const SHOWN = json<{ quantity: string; label: string; olumi: { text: string; title: string; basis: string } }>('shown.json')
const OFFER = view('offer'), RANGE = view('given-range'), POINT = view('given-point'), AFTER_SHOW = view('after-show')
const OLUMI = ffOf(RANGE).given!.olumi

const SID = 's_3656cf1e21c1'
/** A fresh page key per row: the entry's state is the page's, and a row never sees another row's entry (imports nothing but the tab). */
let UUID = ''
let row = 0
const VIEW_PATH = `/api/scenarios/${SID}/view?schema=3`
const FF_PATH = `/api/scenarios/${SID}/figure-first`

let posts: { url: string; body: unknown }[] = [], gets: string[] = []
/** Core on the wire: GET …/figure-first answers the entry, a View read answers `next()`, each POST is recorded and answered by `respond`. */
function core(next: () => View, respond: (url: string) => Response | Promise<Response> = () => new Response('{}', { status: 201 }), entry: () => Response = () => new Response(JSON.stringify(ENTRY), { status: 200 })) {
  setTeamFetch((async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { posts.push({ url, body: JSON.parse(String(init.body)) }); return respond(url) }
    gets.push(url)
    return url === FF_PATH ? entry() : new Response(JSON.stringify(next()), { status: 200 })
  }) as unknown as typeof fetch)
}
const show = (v: View) => useViewStore.setState({ uuid: UUID, sid: SID, view: v, error: null, status: 'ready', stale: false, at: null })
const renderTab = () => render(<><ViewChat /><ViewComposer /></>).container
const click = (el: Element) => act(async () => { fireEvent.click(el) })
const q = (c: ParentNode, s: string) => c.querySelector<HTMLElement>(s)
const menuItem = (c: HTMLElement) => q(c, '[data-testid="view-session-method"][data-method="figure_first"]')!
const entryPanel = (c: HTMLElement) => q(c, '[data-testid="view-figure-first-entry"]')
const ff = (el: ParentNode, k: string) => q(el, `[data-ff="${k}"]`)?.textContent ?? null
async function openEntry(c: HTMLElement) {
  await click(menuItem(c))
  await waitFor(() => expect(ff(entryPanel(c)!, 'heading')).toBe(ENTRY.heading))
  return entryPanel(c)!
}
const type = (c: HTMLElement, typed: string, text: string) => {
  fireEvent.change(q(c, '[data-testid="view-figure-first-typed"]')!, { target: { value: typed } })
  fireEvent.change(q(c, '[data-testid="view-figure-first-text"]')!, { target: { value: text } })
}

beforeEach(() => { posts = []; gets = []; UUID = `00000000-0000-4000-8000-3656cf1e21c1:${++row}` })
afterEach(() => {
  cleanup()
  setTeamFetch(null)
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})

describe('the entry: core\'s blind entry, opened from the menu', () => {
  it('the menu carries core\'s item; a press reads the entry and sends nothing (never POST …/method)', async () => {
    expect(ffOf(OFFER).offer).toEqual({ quantity: 'two_specialists', label: 'two specialists', text: 'Let us give our figure first' })
    core(() => OFFER)
    show(OFFER)
    const c = renderTab()
    expect(menuItem(c).textContent).toBe('Let us give our figure first')
    await openEntry(c)
    expect(gets).toEqual([FF_PATH])
    expect(posts).toEqual([])
  })

  it('draws heading, question, feeds, ask, note and the show button exactly as core sends them', async () => {
    core(() => OFFER)
    show(OFFER)
    const c = renderTab()
    const panel = await openEntry(c)
    for (const k of ['heading', 'question', 'ask', 'note', 'feeds_text', 'show'] as const) expect(ff(panel, k), k).toBe(ENTRY[k])
    // The figure box is labelled by core's ask; the words box by core's question, which asks for them.
    expect(q(c, 'label[for="view-ff-typed"]')!.textContent).toBe(ENTRY.ask)
    expect(q(c, '[data-testid="view-figure-first-text"]')!.getAttribute('aria-labelledby')).toBe('view-ff-question')
  })

  it('never draws Olumi\'s figure or its basis (contrast: the side by side draws all three)', async () => {
    // The offer View itself carries Olumi's figure on its canvas card; the entry panel must not.
    expect(JSON.stringify(OFFER)).toContain(OLUMI.text)
    core(() => OFFER)
    show(OFFER)
    const c = renderTab()
    const panel = await openEntry(c)
    for (const w of [OLUMI.text, OLUMI.title, OLUMI.basis]) expect(panel.textContent, w).not.toContain(w)
    cleanup()
    show(RANGE)
    const drawer = q(renderTab(), '[data-testid="view-figure-first-given"]')!
    for (const w of [OLUMI.text, OLUMI.basis]) expect(drawer.textContent, w).toContain(w)
    expect(q(drawer, '[data-ff="given.olumi.text"]')!.getAttribute('title')).toBe(OLUMI.title)
  })
})

describe('giving their figure first', () => {
  it('posts exactly { quantity, version, text, typed } from the entry, reads the View again, closes the entry and draws the side by side', async () => {
    let served = OFFER
    core(() => served, () => { served = RANGE; return new Response(JSON.stringify({ contribution: 5 }), { status: 201 }) })
    show(OFFER)
    const c = renderTab()
    await openEntry(c)
    type(c, '1 to 2', 'We can onboard one well, two at a stretch')
    await click(q(c, '[data-testid="view-figure-first-send"]')!)
    await waitFor(() => expect(gets).toContain(VIEW_PATH))
    expect(posts).toEqual([{ url: FF_PATH, body: { quantity: ENTRY.quantity, version: ENTRY.version, text: 'We can onboard one well, two at a stretch', typed: '1 to 2' } }])
    await waitFor(() => expect(entryPanel(c)).toBeNull())
    expect(ff(c, 'given.theirs.text')).toBe(ffOf(RANGE).given!.theirs.text)
  })

  it('a figure core cannot read keeps what was typed and says core\'s words (the card\'s ask) in the panel', async () => {
    const ask = 'For “two specialists”, type one number, or a range like 150 to 400.'
    core(() => OFFER, () => new Response(JSON.stringify({ error: ask }), { status: 400 }))
    show(OFFER)
    const c = renderTab()
    await openEntry(c)
    type(c, 'lots', 'we can onboard two at most')
    await click(q(c, '[data-testid="view-figure-first-send"]')!)
    await waitFor(() => expect(q(c, '[data-testid="view-figure-first-said"]')?.textContent).toBe(ask))
    expect((q(c, '[data-testid="view-figure-first-typed"]') as HTMLInputElement).value).toBe('lots')
    expect(q(c, '[data-testid="view-chat-said"]')).toBeNull()
  })

  it('nothing is sent without their words, and the entry is held while a turn is in flight', async () => {
    core(() => OFFER)
    show(OFFER)
    const c = renderTab()
    await openEntry(c)
    type(c, '2', '')
    expect((q(c, '[data-testid="view-figure-first-send"]') as HTMLButtonElement).disabled).toBe(true)
    act(() => { useViewChat.setState({ busy: true }) })
    type(c, '2', 'because')
    expect((q(c, '[data-testid="view-figure-first-send"]') as HTMLButtonElement).disabled).toBe(true)
    expect((q(c, '[data-testid="view-figure-first-show"]') as HTMLButtonElement).disabled).toBe(true)
    expect(posts).toEqual([])
  })
})

describe('"Show me Olumi\'s figure instead"', () => {
  it('posts exactly { quantity, version } and draws Olumi\'s text, title and basis under core\'s headings', async () => {
    let served = OFFER
    core(() => served, () => { served = AFTER_SHOW; return new Response(JSON.stringify(SHOWN), { status: 200 }) })
    show(OFFER)
    const c = renderTab()
    const panel = await openEntry(c)
    await click(q(panel, '[data-testid="view-figure-first-show"]')!)
    await waitFor(() => expect(q(c, '[data-testid="view-figure-first-shown"]')).not.toBeNull())
    expect(posts).toEqual([{ url: `${FF_PATH}/show`, body: { quantity: ENTRY.quantity, version: ENTRY.version } }])
    const shown = q(c, '[data-testid="view-figure-first-shown"]')!
    expect(ff(shown, 'shown.olumi.text')).toBe(SHOWN.olumi.text)
    expect(ff(shown, 'shown.olumi.title')).toBe(SHOWN.olumi.title)
    expect(ff(shown, 'shown.olumi.basis')).toBe(SHOWN.olumi.basis)
    // After the show the View carries no figure_first at all: the headings drawn are the ones kept from the View when the entry opened.
    expect((AFTER_SHOW as unknown as { session: { figure_first: unknown } }).session.figure_first).toBeNull()
    expect(ff(shown, 'shown.headings.olumi')).toBe(ffOf(OFFER).headings.olumi)
    expect(ff(shown, 'shown.headings.basis')).toBe(ffOf(OFFER).headings.basis)
    await waitFor(() => expect(entryPanel(c)).toBeNull())
  })
})

describe('the side by side: both figures as given, on one axis, in core\'s words only', () => {
  /** Every string core sends for the side by side: the drawer may write these and nothing else (no distance, no "closer"). */
  const words = (v: View) => {
    const f = ffOf(v), g = f.given!
    return new Set([g.label, g.theirs.text, g.olumi.text, g.olumi.basis, g.seen_before.text, g.note, ...(g.adopted ? [g.adopted.text, f.headings.adopted] : []), f.headings.theirs, f.headings.olumi, f.headings.basis, f.headings.seen])
  }
  const textNodes = (el: Element): string[] => {
    const out: string[] = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.textContent!.trim() !== '') out.push(n.textContent!)
    return out
  }

  it.each([['given-range', RANGE], ['given-point', POINT]] as const)('%s: every word drawn is one of core\'s, each at its place', (_, v) => {
    const g = ffOf(v).given!, h = ffOf(v).headings
    show(v)
    const drawer = q(renderTab(), '[data-testid="view-figure-first-given"]')!
    const allowed = words(v)
    for (const t of textNodes(drawer)) expect(allowed.has(t), t).toBe(true)
    expect(ff(drawer, 'given.label')).toBe(g.label)
    expect(ff(drawer, 'headings.theirs')).toBe(h.theirs)
    expect(ff(drawer, 'given.theirs.text')).toBe(g.theirs.text)
    expect(ff(drawer, 'headings.olumi')).toBe(h.olumi)
    expect(ff(drawer, 'given.olumi.text')).toBe(g.olumi.text)
    expect(ff(drawer, 'headings.basis')).toBe(h.basis)
    expect(ff(drawer, 'given.olumi.basis')).toBe(g.olumi.basis)
    expect(ff(drawer, 'headings.seen')).toBe(h.seen)
    expect(ff(drawer, 'given.seen_before.text')).toBe(g.seen_before.text)
    expect(ff(drawer, 'given.note')).toBe(g.note)
    // Nothing adopted yet: no adopted row and no heading for it.
    expect(g.adopted).toBeNull()
    expect(q(drawer, '[data-ff="headings.adopted"]')).toBeNull()
  })

  it('one axis: Cy\'s single figure 2 sits exactly where Olumi\'s most likely 2 sits; Olumi\'s 1 to 3 spans both ends', () => {
    const g = ffOf(POINT).given!
    expect([g.theirs.value, g.olumi.likely, g.olumi.low, g.olumi.high]).toEqual([2, 2, 1, 3])
    show(POINT)
    const axis = q(renderTab(), '[data-testid="view-figure-first-axis"]')!
    const at = (k: string, end: 'from' | 'to' = 'from') => Number(q(axis, `[data-axis="${k}"]`)!.dataset[end])
    expect(at('theirs')).toBe(at('theirs', 'to'))
    expect(at('theirs')).toBeCloseTo(at('likely'), 9)
    expect(at('theirs')).toBeCloseTo((at('olumi') + at('olumi', 'to')) / 2, 9)
  })

  it('one axis: Ana\'s 1 to 2 and Olumi\'s 1 to 3 start at the same place, hers ending at the middle of Olumi\'s', () => {
    show(RANGE)
    const axis = q(renderTab(), '[data-testid="view-figure-first-axis"]')!
    const at = (k: string, end: 'from' | 'to' = 'from') => Number(q(axis, `[data-axis="${k}"]`)!.dataset[end])
    expect(at('theirs')).toBeCloseTo(at('olumi'), 9)
    expect(at('theirs', 'to')).toBeCloseTo(at('likely'), 9)
    expect(at('olumi', 'to')).toBeGreaterThan(at('theirs', 'to'))
  })
})

describe('the entry follows the View', () => {
  it('when the View moves on and core no longer offers the figure, the entry closes (and the side by side is the View\'s)', async () => {
    core(() => OFFER)
    show(OFFER)
    const c = renderTab()
    await openEntry(c)
    expect(RANGE.signature).not.toBe(OFFER.signature)
    act(() => { show(RANGE) })
    await waitFor(() => expect(entryPanel(c)).toBeNull())
    expect(q(c, '[data-testid="view-figure-first-given"]')).not.toBeNull()
  })

  it('when the View moves on and the offer still stands, the entry is read again, keeping what was typed', async () => {
    core(() => OFFER)
    show(OFFER)
    const c = renderTab()
    await openEntry(c)
    type(c, '1 to 2', 'half typed')
    const moved = { ...OFFER, signature: `${OFFER.signature}-moved` } as View
    act(() => { show(moved) })
    await waitFor(() => expect(gets.filter((g) => g === FF_PATH)).toHaveLength(2))
    await waitFor(() => expect(ff(entryPanel(c)!, 'heading')).toBe(ENTRY.heading))
    expect((q(c, '[data-testid="view-figure-first-typed"]') as HTMLInputElement).value).toBe('1 to 2')
    expect((q(c, '[data-testid="view-figure-first-text"]') as HTMLTextAreaElement).value).toBe('half typed')
  })
})

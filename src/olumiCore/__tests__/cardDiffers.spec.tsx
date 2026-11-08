/**
 * TM-04 (DL backlog row 7, 8 Nov): after the reveal, each link one member doubts and another keeps is a chip on both of its cards, in the
 * card's one rail, in core's words; a factor a member thinks is missing names no card, so it is said in the Team tab only.
 * Fixtures are core 5d8a009b's own output: zero-call, on a COPY of the seeded consulting board (~/olumi-work/v11-serve/core.db), made by
 * ~/olumi-work/tm04-witness/make-doubts.mjs.
 * - Ana and Cara each doubted one of the two links into "Time to first customer payment" and named a factor they think the model leaves out.
 * - Ben and Dan each kept the link their partner doubted, and all four shared their views.
 * - Core then answers one entry per link and aim, one per factor (no card), and the figure Priya and Tom differ on.
 * - `tm04-cara.view3.json` is the View Cara reads; `tm04-differences.core.json` is core's GET …/differences for her.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import type { View } from '../../olumiView/client'
import { useViewStore } from '../../olumiView/store'
import { useReveal } from '../../olumiView/reveal'
import { CardViewChips } from '../../olumiView/RevealMarks'
import { StrategyChips } from '../../olumiView/strategy/StrategyChips'
import { useUIStore } from '../../stores/uiStore'
import { setTeamFetch } from '../team/api'
import { differencesKey, resetDifferences, useDifferences, type Differences } from '../team/differences'

const FX = path.resolve('src/olumiView/fixtures/debate')
const view: View = JSON.parse(readFileSync(path.join(FX, 'tm04-cara.view3.json'), 'utf8'))
const core: Differences = JSON.parse(readFileSync(path.join(FX, 'tm04-differences.core.json'), 'utf8'))
const links = core.differences.filter((d) => d.kind === 'link')
/** Each doubted link once: its first entry (core's order), as the card shows it. */
const firsts = links.filter((d, i) => links.findIndex((x) => x.record === d.record) === i)
const factors = core.differences.filter((d) => d.kind === 'factor')
const figure = core.differences.find((d) => (d.kind ?? 'figure') === 'figure')!
const ends = [...new Set(firsts.flatMap((d) => d.cards ?? []))]
const marked = (view.collab.marks ?? []).map((m) => m.card)
const other = view.model!.cards.find((c) => !ends.includes(c.id) && !marked.includes(c.id))!.id

let reads = 0
beforeEach(() => {
  reads = 0
  setTeamFetch((async (url: string) => {
    if (String(url).endsWith('/differences')) { reads += 1; return new Response(JSON.stringify(core), { status: 200, headers: { 'content-type': 'application/json' } }) }
    return new Response(JSON.stringify({ error: 'not here' }), { status: 404, headers: { 'content-type': 'application/json' } })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000000', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  useReveal.setState({ selected: null, card: null, evidence: null, chip: null })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetDifferences(); vi.restoreAllMocks() })

/** Each card's rail portal as v10.tsx fills it (CardViewChips, then StrategyChips), for these cards. */
const rails = (cards: readonly string[]) =>
  render(<>{cards.map((k) => <div key={k} data-card={k}><CardViewChips card={k} /><StrategyChips card={k} /></div>)}</>).container
const railsOf = (c: HTMLElement, card: string) => c.querySelectorAll(`[data-card="${card}"] [data-testid^="reveal-chips-"], [data-card="${card}"] [data-testid^="strategy-chips-"]`)

describe('TM-04: a doubted link on both of its cards, in the card\'s one rail, in core\'s words', () => {
  it('core\'s own output: two doubted links, each with both its cards and an entry per aim; factors with no card; a figure on its card', () => {
    expect([firsts.length, links.length]).toEqual([2, 4])
    expect(firsts.map((d) => (d.cards ?? []).length)).toEqual([2, 2])
    expect(factors.map((d) => d.cards)).toEqual([[], []])
    // One end of the second link already carries a reveal chip (Maya's), so the rows below see a doubt beside it.
    expect(ends.some((k) => marked.includes(k))).toBe(true)
    expect(figure.cards).toEqual([figure.record])
  })

  it('HIGH: after the reveal, each doubted link is on both of its cards, once, in the card\'s one rail: core\'s label, who holds which explanation, core\'s sentence on hover', async () => {
    const c = rails([...ends, figure.record, other])
    await waitFor(() => expect(c.querySelectorAll('[data-differ-chip]').length).toBe(firsts.length * 2))
    for (const d of firsts) {
      for (const k of d.cards ?? []) {
        const r = railsOf(c, k)
        expect(r.length).toBe(1) // one rail, never a second
        const chips = c.querySelectorAll(`[data-card="${k}"] [data-differ-chip="${d.record}"]`)
        expect(chips.length).toBe(1) // once, though core runs it for each aim
        expect(r[0]!.contains(chips[0]!)).toBe(true)
        expect(chips[0]!.querySelector('[data-differ-label]')?.textContent).toBe(d.label)
        expect([...chips[0]!.querySelectorAll('[data-differ-side]')].map((e) => e.textContent)).toEqual(d.sides.map((s) => s.text))
        expect(chips[0]!.getAttribute('title')).toBe(d.status_text)
      }
    }
    // Beside the reveal's own chip, in the same rail.
    const both = ends.find((k) => marked.includes(k))!
    expect(railsOf(c, both)[0]!.querySelectorAll('[data-reveal-card-chip], [data-differ-chip]').length).toBeGreaterThanOrEqual(2)
    expect(c.querySelector(`[data-card="${other}"] [data-differ-chip], [data-card="${figure.record}"] [data-differ-chip]`)).toBeNull()
    for (const f of factors) expect(c.textContent).not.toContain(f.label) // a factor names no card: said in the Team tab only
    expect(reads).toBe(1) // one read for every card
  })

  it('catch: nothing is read or drawn before two views are shown, while gated, or on an earlier version', async () => {
    for (const set of [{ view: { ...view, collab: { ...view.collab, shared: view.collab.shared.slice(0, 1) } } }, { view: { ...view, gated: true } }, { at: 1 }]) {
      cleanup(); resetDifferences(); reads = 0
      useViewStore.setState({ view, at: null, ...set } as never)
      const c = rails(ends)
      await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
      expect([reads, c.querySelectorAll('[data-differ-chip]').length]).toEqual([0, 0])
    }
  })

  it('catch: a read for another View (an earlier version, before this reveal) is never drawn as this one\'s', async () => {
    setTeamFetch((() => new Promise<Response>(() => undefined)) as unknown as typeof fetch) // this View's own read never answers
    useDifferences.setState({ sid: view.id, key: `${view.id}|older`, read: `${view.id}|older`, data: core, error: null })
    const c = rails(ends)
    await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
    expect(c.querySelectorAll('[data-differ-chip]').length).toBe(0)
  })

  it('catch: when the read for a newer View fails, the last one\'s doubts are not drawn as the newer View\'s', async () => {
    const c = rails(ends)
    await waitFor(() => expect(c.querySelectorAll('[data-differ-chip]').length).toBeGreaterThan(0)) // CONTRAST: this View's read
    setTeamFetch((async () => new Response(JSON.stringify({ error: 'Olumi could not read this just now.' }), { status: 500, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch)
    const newer = { ...view, signature: `${view.signature}|newer` }
    act(() => { useViewStore.setState({ view: newer }) }) // a poll brings a newer View
    // Once its read has failed (the Team tab keeps the last answer and says the read failed), the cards still draw none of it.
    await waitFor(() => expect([useDifferences.getState().key, useDifferences.getState().error]).toEqual([differencesKey(view.id, newer), expect.any(String)]))
    expect(c.querySelectorAll('[data-differ-chip]').length).toBe(0)
  })

  it('HIGH: on a card whose only rail is the strategy chip, the doubt sits in that one rail beside it, never in a second', async () => {
    // A real strategy mark's shape (core 297e0c15, fixtures/strategy/growth-reveal-n1), moved onto one end of a doubted link that the
    // reveal marks with nothing, so StrategyChips is that card's rail.
    const grown: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy/growth-reveal-n1.view3.json'), 'utf8'))
    const k = ends.find((x) => !marked.includes(x))!
    const strategy = { ...grown.strategy!, marks: [{ ...grown.strategy!.marks[0]!, card: k }] }
    useViewStore.setState({ view: { ...view, strategy } as View })
    const c = rails([k])
    await waitFor(() => expect(c.querySelectorAll('[data-differ-chip]').length).toBeGreaterThan(0))
    const r = railsOf(c, k)
    expect([r.length, r[0]!.getAttribute('data-testid')]).toEqual([1, `strategy-chips-${k}`])
    expect(r[0]!.querySelector('[data-strategy-chip]')).not.toBeNull()
    expect(r[0]!.querySelectorAll('[data-differ-chip]').length).toBe(firsts.filter((d) => (d.cards ?? []).includes(k)).length)
  })

  it('catch: pressing the chip opens the difference in the Team tab, and the card is not pressed through it', async () => {
    const open = vi.fn()
    const was = useUIStore.getState().forceActivateOutputTab
    useUIStore.setState({ forceActivateOutputTab: open } as never)
    try {
      const outer = vi.fn()
      const c = render(<div onClick={outer}><CardViewChips card={ends[0]!} /><StrategyChips card={ends[0]!} /></div>).container
      await waitFor(() => expect(c.querySelector('[data-differ-chip]')).not.toBeNull())
      fireEvent.click(c.querySelector('[data-differ-chip]')!)
      expect([open.mock.calls, outer.mock.calls.length]).toEqual([[['team']], 0])
    } finally { useUIStore.setState({ forceActivateOutputTab: was } as never) }
  })
})

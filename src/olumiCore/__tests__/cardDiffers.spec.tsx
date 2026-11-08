/**
 * TM-04 (DL backlog row 7, 8 Nov): after the reveal, each link one member doubts and another keeps is a chip on both of its cards, in the
 * card's one rail, in core's words; a factor a member thinks is missing names no card, so it is said in the Team tab only. The chip's face
 * is core's `chip` (at most 28 characters), and a rail that holds one stays inside its card, wrapping rather than cutting (UI, 8 Nov).
 * Fixtures are the served candidate core's own output (olumi-core b143332b, which holds the chip, b365e50e): zero-call, on a COPY of the
 * seeded consulting board (~/olumi-work/v11-serve/core.db), after ~/olumi-work/tm04-chip/make-doubts-named.mjs. Core names each link's
 * doubter on its chip ("Ana doubts this link", "Cara doubts this link"), so every chip below is bound to its own entry's words.
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
import { CARD_WIDTH } from '../../olumiView/layout'
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
    // Core's words for each link's chip: who doubts it, at most 28 characters, a different chip for each link; none for a figure or factor.
    expect(firsts.map((d) => [d.record, d.chip])).toEqual([['link:first_cash_timing:time_to_contract', 'Ana doubts this link'], ['link:first_cash_timing:contract_to_cash', 'Cara doubts this link']])
    expect(links.every((d) => d.chip!.length <= 28)).toBe(true)
    expect([figure, ...factors].map((d) => d.chip)).toEqual([undefined, undefined, undefined])
  })

  it('HIGH: after the reveal, each doubted link is on both of its cards, once, in the card\'s one rail: core\'s chip on its face, the link and who holds which explanation in its name, the link and core\'s sentence on hover', async () => {
    const c = rails([...ends, figure.record, other])
    await waitFor(() => expect(c.querySelectorAll('[data-differ-chip]').length).toBe(firsts.length * 2))
    for (const d of firsts) {
      for (const k of d.cards ?? []) {
        const r = railsOf(c, k)
        expect(r.length).toBe(1) // one rail, never a second
        const chips = c.querySelectorAll(`[data-card="${k}"] [data-differ-chip="${d.record}"]`)
        expect(chips.length).toBe(1) // once, though core runs it for each aim
        expect(r[0]!.contains(chips[0]!)).toBe(true)
        // The face is core's chip, whole, and nothing else: no initials (core names only who doubts it), no link words cut short.
        expect([...chips[0]!.querySelectorAll(':scope > span:not(.sr-only)')].map((e) => e.textContent).join('')).toBe(d.chip)
        expect(chips[0]!.querySelector('[data-differ-chip-text]')?.textContent).toBe(d.chip)
        expect(chips[0]!.querySelector('.truncate')).toBeNull()
        // Its name: the chip, the link and each person's explanation, in core's words, each whole and apart (never run together).
        expect(chips[0]!.querySelector('[data-differ-label]')).toHaveClass('sr-only')
        expect(chips[0]!.querySelector('[data-differ-label]')?.textContent).toBe(d.label)
        expect([...chips[0]!.querySelectorAll('[data-differ-side]')].map((e) => e.textContent)).toEqual(d.sides.map((s) => s.text))
        expect(chips[0]!.textContent).toBe([d.chip, d.label, ...d.sides.map((s) => s.text)].join(' '))
        // On hover: which link it is, then core's sentence, so two chips with the same words on one card are told apart.
        expect(chips[0]!.getAttribute('title')).toBe(`${d.label}\n${d.status_text}`)
      }
    }
    // Beside the reveal's own chip, in the same rail.
    const both = ends.find((k) => marked.includes(k))!
    expect(railsOf(c, both)[0]!.querySelectorAll('[data-reveal-card-chip], [data-differ-chip]').length).toBeGreaterThanOrEqual(2)
    expect(c.querySelector(`[data-card="${other}"] [data-differ-chip], [data-card="${figure.record}"] [data-differ-chip]`)).toBeNull()
    for (const f of factors) expect(c.textContent).not.toContain(f.label) // a factor names no card: said in the Team tab only
    expect(reads).toBe(1) // one read for every card
  })

  it('HIGH: a rail that holds a doubted link is its card\'s width and wraps to a second row, every chip at its natural width; a rail of the reveal\'s chips alone keeps V11\'s', async () => {
    const c = rails([...ends, figure.record])
    await waitFor(() => expect(c.querySelectorAll('[data-differ-chip]').length).toBe(firsts.length * 2))
    for (const k of ends) {
      const r = railsOf(c, k)[0] as HTMLElement
      // Inside its card: the card's width, not centred out past its edges, and a second row rather than a squeezed or cut chip.
      expect([r.style.width, r.style.marginLeft]).toEqual([`${CARD_WIDTH}px`, ''])
      expect(r).toHaveClass('flex-wrap')
      expect(r).not.toHaveClass('flex-nowrap')
      for (const chip of r.querySelectorAll('[data-differ-chip]')) { expect(chip).toHaveClass('flex-none'); expect(chip).not.toHaveClass('min-w-0') }
    }
    // CONTRAST: the figure card's rail holds only the reveal's chips (Priya and Tom's), so it keeps V11's one row exactly: V11's to change.
    const v11 = railsOf(c, figure.record)[0] as HTMLElement
    expect(v11.querySelectorAll('[data-reveal-card-chip]').length).toBeGreaterThan(0)
    expect(v11.querySelector('[data-differ-chip]')).toBeNull()
    expect(v11).toHaveClass('flex-nowrap')
    expect([v11.style.width, v11.style.marginLeft]).toEqual(['380px', `${(CARD_WIDTH - 380) / 2}px`])
  })

  it('catch: a chip that is not words (core drift) is dropped from its entry and never drawn; the other link keeps its own', async () => {
    const drift = { ...core, differences: core.differences.map((d) => (d.record === firsts[0]!.record ? { ...d, chip: { words: 'not text' } } : d)) }
    setTeamFetch((async () => new Response(JSON.stringify(drift), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch)
    const c = rails(ends)
    await waitFor(() => expect(c.querySelectorAll('[data-differ-chip]').length).toBe(firsts.length * 2))
    expect(c.querySelectorAll(`[data-differ-chip="${firsts[0]!.record}"] [data-differ-chip-text]`).length).toBe(0)
    expect([...c.querySelectorAll(`[data-differ-chip="${firsts[1]!.record}"] [data-differ-chip-text]`)].map((e) => e.textContent)).toEqual([firsts[1]!.chip, firsts[1]!.chip])
  })

  it('catch: an older core sends no chip: the mark alone, its name still core\'s, and no words made here', async () => {
    const older = { ...core, differences: core.differences.map((d) => ({ ...d, chip: undefined })) }
    setTeamFetch((async () => new Response(JSON.stringify(older), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch)
    const c = rails(ends)
    await waitFor(() => expect(c.querySelectorAll('[data-differ-chip]').length).toBe(firsts.length * 2))
    for (const chip of c.querySelectorAll('[data-differ-chip]')) {
      expect(chip.querySelector('[data-differ-chip-text]')).toBeNull()
      expect([...chip.querySelectorAll(':scope > span:not(.sr-only)')].map((e) => e.textContent).join('')).toBe('')
      expect(chip.querySelector('[data-differ-label]')?.textContent).toBe(firsts.find((d) => d.record === chip.getAttribute('data-differ-chip'))!.label)
    }
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
    // Holding a doubt, that rail too stays inside its card and wraps.
    expect([(r[0] as HTMLElement).style.width, (r[0] as HTMLElement).style.marginLeft]).toEqual([`${CARD_WIDTH}px`, ''])
    expect(r[0]).toHaveClass('flex-wrap')
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

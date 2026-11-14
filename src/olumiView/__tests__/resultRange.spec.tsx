/**
 * The option card's range and its reliance on Olumi's own estimates ("always provide quantified uncertainty, being clear that it has estimated
 * something", Paul 14 Nov). Real path: the lane's card (CoreCard) mounted on core's own goldens (pricing, bakery, european), read from the View
 * alone: `headline.range` (core's words), the chance row's `chance`, and `run.rests[]`. Every expectation is bound by card id and by the rest's
 * option and aim, never by a value another card could satisfy; the words checked are core's, character for character.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useViewLens } from '../lens'
import { useCanvasStore } from '../../canvas/store'
import { CoreCard } from '../previous/CoreCard'
import { rangeBandOf, shareWidths, SHARE_FLOOR } from '../resultRange'

const golden = (n: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8')) as View
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
afterEach(() => { cleanup(); useViewLens.setState({ lens: 'full' }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useCanvasStore.setState({ nodes: [], edges: [], lodRung: undefined } as never) })

function draw(view: View, id: string) {
  const card = view.model!.cards.find((c) => c.id === id)!
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useCanvasStore.setState({ nodes: view.model!.cards.map((c) => ({ id: c.id, type: 'viewCard', data: { card: c, label: c.heading }, position: { x: 0, y: 0 } })), edges: [] } as never)
  const root = render(<ReactFlowProvider><Node {...({ id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
  const q = (sel: string) => root.querySelector<HTMLElement>(sel)
  return { card, root, band: q(`[data-band="${id}"]`), mark: q(`[data-chance-mark="${id}"]`), caption: q(`[data-range-caption="${id}"]`), share: q(`[data-rests-share="${id}"]`),
    olumi: q(`[data-share-olumi="${id}"]`), person: q(`[data-share-person="${id}"]`), track: q(`[data-view="${id}.chance.track"]`) }
}
const pct = (el: HTMLElement | null, prop: 'left' | 'width') => parseFloat(el!.style[prop])
const withRests = (view: View, patch: (r: NonNullable<NonNullable<View['model']>['run']>['rests'][number]) => void, option: string): View => {
  const v = structuredClone(view); for (const r of v.model!.run!.rests) if (r.option === option && r.kind === 'goal') patch(r); return v
}

describe('the range, as a band with the chance marked', () => {
  it('B1 catch (bakery second_oven): the band runs between the two figures core states, the chance is marked inside it, the caption is core\'s words', () => {
    const d = draw(golden('bakery'), 'second_oven')
    expect(d.card.headline!.range).toBe("about 53% if 'extra sold per oven' is low, about 81% if it is high")
    expect([pct(d.band, 'left'), pct(d.band, 'width')]).toEqual([53, 28])
    expect(d.band!.hasAttribute('data-open-low') || d.band!.hasAttribute('data-open-high')).toBe(false)
    expect(pct(d.mark, 'left')).toBeCloseTo(71.62, 5)
    expect(d.caption!.textContent).toBe(d.card.headline!.range)
    expect(pct(d.track!.querySelector('span'), 'width')).toBeCloseTo(71.62, 5)
  })
  it('B2 catch (pricing raise_price): "under" and "over" stay open: the band runs to both ends of the track, not to 1% and 99%', () => {
    const d = draw(golden('pricing'), 'raise_price')
    expect(d.card.headline!.range).toBe("under 1% if 'cups change' is low, over 99% if it is high")
    expect([pct(d.band, 'left'), pct(d.band, 'width')]).toEqual([0, 100])
    expect(d.band!.hasAttribute('data-open-low') && d.band!.hasAttribute('data-open-high')).toBe(true)
    expect(pct(d.mark, 'left')).toBeCloseTo(49.21, 5)
    expect(d.caption!.textContent).toBe(d.card.headline!.range)
  })
  it('B3 catch: one open end only ("under 1% … about 95%"): the band is 0 to 95 and open only at the low end; the reversed order reads the same', () => {
    expect(rangeBandOf("under 1% if 'x' is low, about 95% if it is high")).toEqual({ from: 0, to: 95, openLow: true, openHigh: false })
    expect(rangeBandOf("about 92% if 'x' is low, under 1% if it is high")).toEqual({ from: 0, to: 92, openLow: true, openHigh: false })
    expect(rangeBandOf("about 4% if 'x' is low, about 97% if it is high")).toEqual({ from: 4, to: 97, openLow: false, openHigh: false })
  })
  it('B4 must not change: words that are not core\'s two-ended sentence draw no band (the words stay), never a guessed one', () => {
    for (const w of ['£2,580/month', 'Outcome range', "under 1% if 'x' is low", "about 4% if 'x' is low, about 140% if it is high", '', null]) expect(rangeBandOf(w), String(w)).toBeNull()
    const v = structuredClone(golden('bakery')); v.model!.cards.find((c) => c.id === 'second_oven')!.headline!.range = 'it moves a lot with the oven'
    const d = draw(v, 'second_oven')
    expect(d.band).toBeNull(); expect(d.caption!.textContent).toBe('it moves a lot with the oven'); expect(d.mark).not.toBeNull()
  })
  it('B5 must not change: a chance with no range words draws the fill and the mark, no band, no caption', () => {
    const v = structuredClone(golden('bakery')); v.model!.cards.find((c) => c.id === 'second_oven')!.headline!.range = null
    const d = draw(v, 'second_oven')
    expect([d.band, d.caption]).toEqual([null, null]); expect(d.track).not.toBeNull(); expect(d.mark).not.toBeNull()
  })
  it('B6 must not change: where there is no result, core\'s own words stand and nothing is drawn (fixed: "never met"; none: "No chance yet")', () => {
    const fixed = draw(golden('pricing'), 'carry_on')
    expect(fixed.root.querySelector('[data-ok-face="fixed"]')!.textContent).toContain(fixed.card.headline!.text)
    expect([fixed.track, fixed.band, fixed.mark, fixed.share]).toEqual([null, null, null, null])
    cleanup()
    const v = structuredClone(golden('pricing')); const c = v.model!.cards.find((x) => x.id === 'raise_price')!
    c.headline = { ...c.headline!, state: 'none', text: 'No chance yet', range: null, why: 'Core could not work it out.' }
    const none = draw(v, 'raise_price')
    expect(none.root.querySelector('[data-ok-face="none"]')!.textContent).toContain('No chance yet'); expect(none.root.textContent).toContain('Core could not work it out.')
    expect([none.track, none.band, none.mark, none.caption]).toEqual([null, null, null, null])
  })
})

describe('how much of the result rests on Olumi\'s estimates', () => {
  it('S1 catch (pricing raise_price): the two-tone fill follows core\'s served shares and the label says "mostly"; one click opens Rests on', () => {
    const v = golden('pricing'), r = v.model!.run!.rests.find((x) => x.option === 'raise_price' && x.kind === 'goal')!
    const d = draw(v, 'raise_price')
    expect(pct(d.olumi, 'width')).toBeCloseTo(r.olumi_share * 100, 6); expect(pct(d.person, 'width')).toBe(0)
    expect(d.share!.textContent).toBe("Rests mostly on Olumi's estimates: check these")
    expect(d.share!.getAttribute('title')).toBe(r.hover)
    expect(d.share!.tagName).toBe('BUTTON'); expect(d.share!.className).toContain('nodrag')
    expect(useViewLens.getState().lens).toBe('full')
    act(() => { fireEvent.click(d.share!) })
    expect(useViewLens.getState().lens).toBe('rests_on')
  })
  it('S2 catch (bakery second_oven, 29%): partly, in the same blue; the person\'s own share is its own served number, not what is left over', () => {
    const v = withRests(golden('bakery'), (r) => { r.olumi_share = 0.3; r.person_share = 0.2; r.unassigned = 0.5 }, 'second_oven')
    const d = draw(v, 'second_oven')
    expect([pct(d.olumi, 'width'), pct(d.person, 'width')]).toEqual([30, 20])
    expect(d.share!.textContent).toBe("Rests partly on Olumi's estimates: check these")
  })
  it('S3 catch (european): the entry is this option\'s AIM entry, not another option\'s or a limit\'s: swapping the others\' shares changes nothing here', () => {
    const base = golden('european'), rests = base.model!.run!.rests
    const mine = rests.find((r) => r.option === 'single_country_test' && r.kind === 'goal')!
    expect(mine.olumi_share, 'precondition: its own share differs from the other options\' and from its own limits\'').not.toBe(rests.find((r) => r.option === 'broader_entry' && r.kind === 'goal')!.olumi_share)
    const d = draw(base, 'single_country_test')
    expect(pct(d.olumi, 'width')).toBeCloseTo(mine.olumi_share * 100, 6)
    cleanup()
    const swapped = structuredClone(base)
    for (const r of swapped.model!.run!.rests) if (r.option !== 'single_country_test' || r.kind !== 'goal') { r.olumi_share = 0.123; r.person_share = 0.456 }
    swapped.model!.run!.rests.reverse() // its limits now come before its goal: the entry is found by kind, option and aim, not by position
    expect(pct(draw(swapped, 'single_country_test').olumi, 'width')).toBeCloseTo(mine.olumi_share * 100, 6)
    cleanup()
    const mutated = structuredClone(base); mutated.model!.run!.rests.find((r) => r.id === mine.id)!.olumi_share = 0.5
    expect(pct(draw(mutated, 'single_country_test').olumi, 'width')).toBe(50)
  })
  it('S4 catch: a share core serves as numerical dust (5.5e-16) draws as none, and the words do not claim Olumi\'s estimates', () => {
    const v = withRests(golden('bakery'), (r) => { r.olumi_share = 5.5e-16; r.person_share = 0.4; r.unassigned = 0.6 }, 'second_oven')
    const d = draw(v, 'second_oven')
    expect(SHARE_FLOOR).toBeGreaterThan(5.5e-16)
    expect([pct(d.olumi, 'width'), pct(d.person, 'width')]).toEqual([0, 40])
    expect(d.share!.textContent).toBe('Rests on your own figures, not on Olumi’s estimates')
  })
  it('S5 must not change: with no entry for this option and aim, or both shares nothing, no fill and no claim are drawn', () => {
    const none = structuredClone(golden('bakery')); none.model!.run!.rests = none.model!.run!.rests.filter((r) => r.option !== 'second_oven')
    expect(draw(none, 'second_oven').share).toBeNull(); cleanup()
    const zero = withRests(golden('bakery'), (r) => { r.olumi_share = 0; r.person_share = 0; r.unassigned = 1 }, 'second_oven')
    expect(draw(zero, 'second_oven').share).toBeNull(); cleanup()
    const limitOnly = structuredClone(golden('bakery')); for (const r of limitOnly.model!.run!.rests) if (r.option === 'second_oven') r.kind = 'limit'
    expect(draw(limitOnly, 'second_oven').share).toBeNull()
  })
  it('S6 the fill never overflows its track: shares served as more than the whole are scaled to fit, each keeping its proportion', () => {
    const w = shareWidths({ id: 'x', olumi: 0.9, person: 0.3, line: '', hover: '' })
    expect(w.olumi + w.person).toBeCloseTo(100, 6); expect(w.olumi / w.person).toBeCloseTo(3, 6)
  })
})

describe('the card keeps its height', () => {
  it('H1 the track keeps its 3px height and 3px + 2px margins (the band and the mark are out of flow), so the card does not grow by them', () => {
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    expect(css).toMatch(/\.olumi-look \.ok-track \{[^}]*height: 3px;[^}]*margin: calc\(3px \* var\(--o-s\)\) 0 calc\(2px \* var\(--o-s\)\);/)
    for (const sel of ['.ok-band', '.ok-mark-chance']) expect(css).toMatch(new RegExp(`\\.ok-track > \\${sel} \\{[^}]*position: absolute;`))
  })
})

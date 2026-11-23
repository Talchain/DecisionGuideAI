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
import { laneTipOf, tipOf } from './tipHelpers'
import { useViewLens } from '../lens'
import { useCanvasStore } from '../../canvas/store'
import { CoreCard, withheldWords, leadLineOf } from '../previous/CoreCard'
import { restsOf } from '../layout'
import { rangeBandOf, shareWidths, SHARE_FLOOR, NEUTRAL_REST_WORDS } from '../resultRange'

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
  return { card, root, band: q(`[data-band="${id}"]`), mark: q(`[data-chance-mark="${id}"]`), share: q(`[data-rests-share="${id}"]`),
    olumi: q(`[data-share-olumi="${id}"]`), person: q(`[data-share-person="${id}"]`), track: q(`[data-view="${id}.chance.track"]`) }
}
const pct = (el: HTMLElement | null, prop: 'left' | 'width') => parseFloat(el!.style[prop])
/** Core's range is the track's accessible name and its Tip. */
const rangeIsTheTrack = (d: ReturnType<typeof draw>) =>
  [d.track!.getAttribute('tabindex'), d.track!.getAttribute('role'), d.track!.getAttribute('aria-label'),
    d.root.querySelector('[data-testid="lane-tip"]'), document.querySelector('[data-testid="lane-tip"]'),
    laneTipOf(d.track!), laneTipOf(d.track!, 'focus')]
const AT_TRACK = (words: string) => ['0', 'img', words, null, null, words, words]
const withRests = (view: View, patch: (r: NonNullable<NonNullable<View['model']>['run']>['rests'][number]) => void, option: string): View => {
  const v = structuredClone(view); for (const r of v.model!.run!.rests) if (r.option === option && r.kind === 'goal') patch(r); return v
}

describe('the range, as a band with the chance marked', () => {
  it('B1 catch (bakery second_oven): the band runs between the two figures core states, the chance is marked inside it, core\'s words are the track\'s tip on hover and focus', () => {
    const d = draw(golden('bakery'), 'second_oven')
    expect(d.card.headline!.range).toBe("about 53% if 'extra sold per oven' is low, about 81% if it is high")
    // placed from the row's numbers (driver.low 0.5346.., driver.high 0.8067..), not from the sentence's rounded 53 and 81
    const drv = (d.card.rows.find((r) => r.kind === 'chance') as { driver: { low: number; high: number } }).driver
    expect([pct(d.band, 'left'), pct(d.band, 'width')]).toEqual([drv.low * 100, (drv.high - drv.low) * 100].map((n) => expect.closeTo(n, 5)))
    expect(pct(d.band, 'left')).not.toBe(53)
    expect(d.band!.hasAttribute('data-open-low') || d.band!.hasAttribute('data-open-high')).toBe(false)
    expect(pct(d.mark, 'left')).toBeCloseTo(71.62, 5)
    expect(rangeIsTheTrack(d), 'core\'s words are the track\'s tip and name, not a caption').toEqual(AT_TRACK(d.card.headline!.range!))
    expect(pct(d.track!.querySelector('span'), 'width')).toBeCloseTo(71.62, 5)
  })
  it('B2 catch (pricing raise_price): the row\'s numbers are 0 and 1: the band runs to both ends of the track and is open at both', () => {
    const d = draw(golden('pricing'), 'raise_price')
    expect(d.card.headline!.range).toBe("under 1% if 'cups change' is low, over 99% if it is high")
    expect([pct(d.band, 'left'), pct(d.band, 'width')]).toEqual([0, 100])
    expect(d.band!.hasAttribute('data-open-low') && d.band!.hasAttribute('data-open-high')).toBe(true)
    expect(pct(d.mark, 'left')).toBeCloseTo(49.21, 5)
    expect(rangeIsTheTrack(d)).toEqual(AT_TRACK(d.card.headline!.range!))
  })
  const withDriver = (view: View, id: string, driver: unknown): View => {
    const v = structuredClone(view); const row = v.model!.cards.find((c) => c.id === id)!.rows.find((r) => r.kind === 'chance')! as unknown as { driver: unknown }; row.driver = driver; return v
  }
  it('B3 catch: one open end only (low 0, high 0.95): the band is 0 to 95 and open only at the low end; the reversed order reads the same', () => {
    const at = (low: number, high: number) => { const v = withDriver(golden('bakery'), 'second_oven', { figure: 'extra_sold_per_oven', low, high }); return rangeBandOf(v.model!.cards.find((c) => c.id === 'second_oven')!) }
    expect(at(0, 0.95)).toEqual({ from: 0, to: 95, openLow: true, openHigh: false })
    expect(at(0.95, 0)).toEqual({ from: 0, to: 95, openLow: true, openHigh: false })
    expect(at(0.04, 0.97)).toEqual({ from: 4, to: 97, openLow: false, openHigh: false })
  })
  it('B4 must not change: a row without the numbers draws no band (the words stay, as the track\'s tip), never a guessed one; numbers outside 0..1 or not finite draw none', () => {
    const card = (driver: unknown) => withDriver(golden('bakery'), 'second_oven', driver).model!.cards.find((c) => c.id === 'second_oven')!
    for (const dr of [null, { figure: 'f', low: 0.2, high: 1.4 }, { figure: 'f', low: -0.1, high: 0.5 }, { figure: 'f', low: Number.NaN, high: 0.5 }]) expect(rangeBandOf(card(dr)), JSON.stringify(dr)).toBeNull()
    const d = draw(withDriver(golden('bakery'), 'second_oven', null), 'second_oven')
    expect(d.band).toBeNull(); expect(rangeIsTheTrack(d)).toEqual(AT_TRACK(d.card.headline!.range!)); expect(d.mark).not.toBeNull()
  })
  it('B4b CONTRAST: changing the English (headline.range, the row\'s value and title) neither moves nor removes the band', () => {
    const base = draw(golden('bakery'), 'second_oven'), was = [pct(base.band, 'left'), pct(base.band, 'width')]
    cleanup()
    for (const words of ['it moves a lot with the oven', '', null, 'a wholly different sentence, 12% to 40%']) {
      const v = structuredClone(golden('bakery')); const c = v.model!.cards.find((x) => x.id === 'second_oven')!
      c.headline!.range = words
      const row = c.rows.find((r) => r.kind === 'chance')! as unknown as { value: string; title: string }; row.value = 'reworded'; row.title = 'reworded'
      const d = draw(v, 'second_oven')
      expect([pct(d.band, 'left'), pct(d.band, 'width')], String(words)).toEqual(was); cleanup()
    }
  })
  it('B5 must not change: a chance with no range words draws the fill and the mark and no caption (the band is the numbers\', so it stays)', () => {
    const v = structuredClone(golden('bakery')); v.model!.cards.find((c) => c.id === 'second_oven')!.headline!.range = null
    const d = draw(v, 'second_oven')
    expect(laneTipOf(d.track!)).toBeNull(); expect(d.band).not.toBeNull(); expect(d.track).not.toBeNull(); expect(d.mark).not.toBeNull()
    expect([d.track!.getAttribute('tabindex'), d.track!.getAttribute('aria-hidden')], 'no words: nothing to reach, as before').toEqual([null, 'true'])
  })
  it('B6 must not change: where there is no result, core\'s own words stand and nothing is drawn (fixed: "never met"; none: ONE quiet line, its why the hover, R6 16 Nov)', async () => {
    const fixed = draw(golden('pricing'), 'carry_on')
    expect(fixed.root.querySelector('[data-ok-face="fixed"]')!.textContent).toContain(fixed.card.headline!.text)
    expect([fixed.track, fixed.band, fixed.mark, fixed.share]).toEqual([null, null, null, null])
    cleanup()
    const v = structuredClone(golden('pricing')); const c = v.model!.cards.find((x) => x.id === 'raise_price')!
    c.headline = { ...c.headline!, state: 'none', text: 'No chance yet', range: null, why: 'Core could not work it out.', add: null }
    const none = draw(v, 'raise_price')
    // R6: the face is one quiet line, core's headline words where it sends no next step; the why is its hover; no press, no "?", no empty track.
    const line = none.root.querySelector<HTMLElement>('[data-ok-face="none"] .ok-quiet')!
    expect([line.textContent, await tipOf(line)]).toEqual(['No chance yet', 'Core could not work it out.'])
    expect(none.root.querySelector('[data-ok-face="none"] details, [data-ok-face="none"] summary, [data-ok-face="none"] .ok-empty, [data-ok-face="none"] .ok-q')).toBeNull()
    expect([none.track, none.band, none.mark]).toEqual([null, null, null])
  })
  it('B6b catch (R6): a withheld card with a next step draws that step as its one line, naming the field it came from; the why is behind the hover, off the face', async () => {
    const v = structuredClone(golden('pricing')); const c = v.model!.cards.find((x) => x.id === 'raise_price')!
    c.headline = { ...c.headline!, state: 'none', text: 'No chance yet', title: 'Every option shares this reason.', range: null, why: 'Core could not work it out.', add: 'Say what the target is.' }
    const d = draw(v, 'raise_price')
    const line = d.root.querySelector<HTMLElement>('[data-ok-face="none"] .ok-quiet')!
    expect(line.textContent).toBe('Say what the target is.')
    expect(line.getAttribute('data-view')).toBe('raise_price.headline.add')
    expect(await tipOf(line), 'the reason whole, then the step').toBe('Core could not work it out.\nSay what the target is.')
    expect(d.root.querySelectorAll('[data-ok-face="none"] summary')).toHaveLength(0)
    expect(d.root.querySelector('[data-ok-face="none"]')!.textContent, 'the reason is not on the face').not.toContain('Core could not work it out.')
    expect(withheldWords(c.headline)).toBe('Core could not work it out.')
  })
  it('B6c catch (R6): with no next step the line is core\'s headline text, and its hover is the reason: core\'s title where there is no why, else the text itself. Each names its own field', async () => {
    const v = structuredClone(golden('pricing')); const c = v.model!.cards.find((x) => x.id === 'raise_price')!
    c.headline = { ...c.headline!, state: 'none', text: 'No chance yet', title: 'The goal has no target yet.', range: null, why: null, add: null }
    const t = draw(v, 'raise_price')
    const line = t.root.querySelector<HTMLElement>('[data-ok-face="none"] .ok-quiet')!
    expect([line.textContent, await tipOf(line), line.getAttribute('data-view')]).toEqual(['No chance yet', 'The goal has no target yet.', 'raise_price.headline.text'])
    expect(withheldWords(c.headline)).toBe('The goal has no target yet.')
    cleanup()
    c.headline = { ...c.headline!, title: '', why: '' }
    const x = draw(v, 'raise_price')
    const line2 = x.root.querySelector<HTMLElement>('[data-ok-face="none"] .ok-quiet')!
    expect([line2.textContent, await tipOf(line2)]).toEqual(['No chance yet', 'No chance yet'])
    expect(withheldWords(c.headline)).toBe('No chance yet')
    expect(x.root.querySelector('details')).toBeNull()
  })
  it('B6d contrast: a chance and a fixed result are not withheld: withheldWords is null for them and their own words are unchanged', () => {
    const g = golden('pricing')
    expect(withheldWords(g.model!.cards.find((x) => x.id === 'raise_price')!.headline!)).toBeNull()
    const fixedH = g.model!.cards.find((x) => x.id === 'carry_on')!.headline!
    expect(withheldWords(fixedH)).toBeNull()
    expect(leadLineOf(g.model!.cards.find((x) => x.id === 'carry_on')!)).toBe(fixedH.text)
  })
})

type Rest = NonNullable<NonNullable<View['model']>['run']>['rests'][number]
const entryOf = (v: View, option: string, aim: string): Rest => v.model!.run!.rests.find((x) => x.kind === 'goal' && x.option === option && x.aim === aim)!
/** Words that credit a reader's own figures or Olumi's estimates: none may ever be written by the card itself. */
const CREDIT = /\byour\b|own figures|Olumi’s estimates|Olumi's estimates|\bmostly\b|\bpartly\b/i

describe('what the result rests on: core\'s own line for the entry, whatever the split (W5 round 2, reviewer 14 Nov)', () => {
  it('S1 catch (pricing raise_price): the label is the entry\'s own line, character for character; the Tip is the whole line; one click opens Rests on', () => {
    const v = golden('pricing'), r = entryOf(v, 'raise_price', 'profit_goal')
    const d = draw(v, 'raise_price')
    expect(pct(d.olumi, 'width')).toBeCloseTo(r.olumi_share * 100, 6); expect(pct(d.person, 'width')).toBe(0)
    // DL 15 Nov (Paul: "so much text"): core's line is off the face; the face says the UI's short label, the line is the button's Tip.
    expect(d.share!.textContent).toBe(NEUTRAL_REST_WORDS)
    expect(d.root.querySelector(`[data-view="raise_price.rests.line"]`)).toBeNull()
    expect(d.share!.getAttribute('data-rests-basis')).toBe('line')
    expect(laneTipOf(d.share!)).toBe(r.line)
    expect(d.share!.tagName).toBe('BUTTON'); expect(d.share!.className).toContain('nodrag')
    expect(useViewLens.getState().lens).toBe('full')
    act(() => { fireEvent.click(d.share!) })
    expect(useViewLens.getState().lens).toBe('rests_on')
  })
  it('S1c catch (DL 15 Nov: the Tip is transient): pressing the label shows the entry\'s whole line under it, by keyboard or touch; absent at rest, gone on a second press', () => {
    const v = golden('pricing'), r = entryOf(v, 'raise_price', 'profit_goal')
    const d = draw(v, 'raise_price')
    expect(d.root.querySelector('[data-rests-said="raise_price"]'), 'not on the face at rest').toBeNull()
    expect(d.share!.getAttribute('aria-expanded')).toBe('false')
    act(() => { fireEvent.click(d.share!) })
    const said = d.root.querySelector('[data-rests-said="raise_price"]')
    expect(said?.textContent, 'the whole line, character for character').toBe(r.line)
    expect(d.share!.getAttribute('aria-expanded')).toBe('true')
    expect(d.share!.textContent, 'the label itself is unchanged').toBe(NEUTRAL_REST_WORDS)
    act(() => { fireEvent.click(d.share!) })
    expect(d.root.querySelector('[data-rests-said="raise_price"]')).toBeNull()
  })
  it('S1b catch (DL 15 Nov: no sentence cut, and the face carries less): the line is not on the face; it is the button\'s Tip whole, and pressing it opens Rests on, which draws every entry\'s full line', () => {
    const v = golden('pricing'), r = entryOf(v, 'raise_price', 'profit_goal')
    const d = draw(v, 'raise_price')
    expect(d.root.querySelector('[data-view="raise_price.rests.line"]'), 'off the face').toBeNull()
    expect(d.share!.textContent).toBe(NEUTRAL_REST_WORDS)
    expect(laneTipOf(d.share!)).toBe(r.line)
    expect(restsOf(v.model!.run!)!.lines.map((l) => l.line.line), 'the Rests on view draws the entry\'s full line').toContain(r.line)
  })
  it('S2 catch: for every split the label is THAT entry\'s own line, never a word the card wrote from the shares (equal halves, a small Olumi share, all unassigned, many people)', () => {
    const splits: Array<[number, number, number]> = [[0.5, 0.5, 0], [0.04, 0.6, 0.36], [0, 0, 1], [0.98, 0, 0.02], [0.01, 0.7, 0.29], [0.3, 0.2, 0.5]]
    for (const [o, p, u] of splits) {
      const v = structuredClone(golden('bakery')), r = entryOf(v, 'second_oven', 'sell_360')
      r.olumi_share = o; r.person_share = p; r.unassigned = u; r.line = `Entry ${r.id} at ${o}/${p}/${u}: its own scoped line.`
      const d = draw(v, 'second_oven')
      expect(d.share, `${o}/${p}/${u}: drawn`).not.toBeNull()
      expect(laneTipOf(d.share!), `${o}/${p}/${u}`).toBe(r.line)
      expect(laneTipOf(d.share!)).not.toMatch(CREDIT)
      expect(d.share!.getAttribute('data-rests-basis')).toBe('line')
      const total = Math.max(1, o + p + u) // served shares that run over the whole are scaled to fit (S6); these never meaningfully do
      expect(pct(d.olumi, 'width')).toBeCloseTo((o / total) * 100, 6); expect(pct(d.person, 'width')).toBeCloseTo((p / total) * 100, 6)
      cleanup()
    }
  })
  it('S3 catch (european): the entry is this option\'s AIM entry, not another option\'s or a limit\'s: swapping the others\' shares and lines changes nothing here', () => {
    const base = golden('european'), rests = base.model!.run!.rests
    const mine = entryOf(base, 'single_country_test', 'reach_customer_target')
    expect(mine.olumi_share, 'precondition: its own share differs from the other options\' and from its own limits\'').not.toBe(entryOf(base, 'broader_entry', 'reach_customer_target').olumi_share)
    const d = draw(base, 'single_country_test')
    expect(pct(d.olumi, 'width')).toBeCloseTo(mine.olumi_share * 100, 6); expect(laneTipOf(d.share!)).toBe(mine.line)
    cleanup()
    const swapped = structuredClone(base)
    for (const r of swapped.model!.run!.rests) if (r.id !== mine.id) { r.olumi_share = 0.123; r.person_share = 0.456; r.line = 'NOT THIS CARD' }
    swapped.model!.run!.rests.reverse() // its limits now come before its goal: the entry is found by kind, option and aim, not by position
    const s = draw(swapped, 'single_country_test')
    expect(pct(s.olumi, 'width')).toBeCloseTo(mine.olumi_share * 100, 6); expect(laneTipOf(s.share!)).toBe(mine.line)
    cleanup()
    const mutated = structuredClone(base); mutated.model!.run!.rests.find((r) => r.id === mine.id)!.olumi_share = 0.5
    expect(pct(draw(mutated, 'single_country_test').olumi, 'width')).toBe(50)
    expect(rests.length).toBeGreaterThan(3)
  })
  it('S3b catch: two goal entries for one option under different aims: the card shows the entry of ITS headline aim, wherever it sits in the list', () => {
    const v = structuredClone(golden('pricing')), mine = entryOf(v, 'raise_price', 'profit_goal')
    v.model!.run!.rests.unshift({ ...structuredClone(mine), id: 'F_OTHER_AIM', aim: 'some_other_aim', line: 'THE OTHER AIM\'S LINE', hover: 'THE OTHER AIM\'S HOVER', olumi_share: 0.11 })
    const d = draw(v, 'raise_price')
    expect(laneTipOf(d.share!, 'focus')).toBe(mine.line)
    expect(pct(d.olumi, 'width')).toBeCloseTo(mine.olumi_share * 100, 6)
  })
  it('S4 catch: a share core serves as numerical dust (5.5e-16) draws as a bar of no width; the words are still the entry\'s line and credit nobody', () => {
    const v = withRests(golden('bakery'), (r) => { r.olumi_share = 5.5e-16; r.person_share = 0.4; r.unassigned = 0.6 }, 'second_oven')
    const d = draw(v, 'second_oven')
    expect(SHARE_FLOOR).toBeGreaterThan(5.5e-16)
    expect([pct(d.olumi, 'width'), pct(d.person, 'width')]).toEqual([0, 40])
    expect(laneTipOf(d.share!)).toBe(entryOf(v, 'second_oven', 'sell_360').line); expect(laneTipOf(d.share!)).not.toMatch(CREDIT)
  })
  it('S5 catch: a result that rests wholly on what is unassigned (0, 0, 1) still draws core\'s line and a full unassigned bar; only a missing entry draws nothing', () => {
    const zero = withRests(golden('bakery'), (r) => { r.olumi_share = 0; r.person_share = 0; r.unassigned = 1 }, 'second_oven')
    const z = draw(zero, 'second_oven')
    expect(z.share).not.toBeNull(); expect(laneTipOf(z.share!)).toBe(entryOf(zero, 'second_oven', 'sell_360').line)
    expect(pct(z.root.querySelector<HTMLElement>('[data-share-unassigned="second_oven"]'), 'width')).toBe(100); cleanup()
    const none = structuredClone(golden('bakery')); none.model!.run!.rests = none.model!.run!.rests.filter((r) => r.option !== 'second_oven')
    expect(draw(none, 'second_oven').share).toBeNull(); cleanup()
    const limitOnly = structuredClone(golden('bakery')); for (const r of limitOnly.model!.run!.rests) if (r.option === 'second_oven') r.kind = 'limit'
    expect(draw(limitOnly, 'second_oven').share).toBeNull()
  })
  it('S5b catch: shares that are not finite numbers are bars of no width, not a reason to hide the entry: the line is still drawn', () => {
    const v = withRests(golden('bakery'), (r) => { r.olumi_share = Number.NaN; r.person_share = Number.POSITIVE_INFINITY; r.unassigned = Number.NaN }, 'second_oven')
    const d = draw(v, 'second_oven')
    expect(laneTipOf(d.share!)).toBe(entryOf(v, 'second_oven', 'sell_360').line)
    expect([pct(d.olumi, 'width'), pct(d.person, 'width')]).toEqual([0, 0])
  })
  it('S6 the fill never overflows its track: shares served as more than the whole are scaled to fit, each keeping its proportion', () => {
    const w = shareWidths({ id: 'x', olumi: 0.9, person: 0.3, unassigned: 0, line: '', hover: '' })
    expect(w.olumi + w.person).toBeCloseTo(100, 6); expect(w.olumi / w.person).toBeCloseTo(3, 6)
  })
  it('S7b catch: the sentence is the entry\'s own, not another option\'s: changing this entry\'s line changes this card\'s words and no other\'s', () => {
    const v = withRests(golden('european'), (r) => { r.olumi_share = 0.1; r.person_share = 0.1; r.unassigned = 0.8; r.line = 'THIS ENTRY ONLY' }, 'single_country_test')
    expect(laneTipOf(draw(v, 'single_country_test').share!)).toBe('THIS ENTRY ONLY')
    cleanup()
    expect(laneTipOf(draw(v, 'broader_entry').share!)).toBe(entryOf(v, 'broader_entry', 'reach_customer_target').line)
  })
  it('S8 catch: where core serves no line (blank, or only spaces) the label is the neutral link, whatever the split, and it credits neither Olumi nor any person', () => {
    const splits: Array<[number, number, number]> = [[0.02, 0, 0.98], [0.5, 0.5, 0], [0.04, 0.6, 0.36], [0, 0, 1], [0.01, 0.7, 0.29]]
    for (const [o, p, u] of splits) for (const blank of ['', '  ']) {
      const v = withRests(golden('pricing'), (r) => { r.olumi_share = o; r.person_share = p; r.unassigned = u; r.line = blank }, 'raise_price')
      const d = draw(v, 'raise_price')
      expect(d.share!.textContent, `${o}/${p}/${u}`).toBe(NEUTRAL_REST_WORDS)
      expect(d.share!.getAttribute('data-rests-basis')).toBe('neutral')
      expect(d.root.querySelector('[data-rests-neutral="raise_price"]')).not.toBeNull()
      expect(d.root.querySelector('[data-view="raise_price.rests.line"]'), 'the neutral label is not a View string').toBeNull()
      expect(d.share!.textContent).not.toMatch(CREDIT)
      expect(laneTipOf(d.share!)).toBe(entryOf(v, 'raise_price', 'profit_goal').hover)
      act(() => { fireEvent.click(d.share!) }); expect(useViewLens.getState().lens).toBe('rests_on')
      cleanup(); useViewLens.setState({ lens: 'full' })
    }
  })
  it('S9 catch: the unassigned share is its own segment at its served width, and is not folded into the person\'s', () => {
    const v = withRests(golden('pricing'), (r) => { r.olumi_share = 0.02; r.person_share = 0; r.unassigned = 0.98 }, 'raise_price')
    const d = draw(v, 'raise_price')
    const un = d.root.querySelector<HTMLElement>('[data-share-unassigned="raise_price"]')
    expect(un).not.toBeNull(); expect(pct(un, 'width')).toBeCloseTo(98, 6); expect(pct(d.person, 'width')).toBe(0); expect(pct(d.olumi, 'width')).toBeCloseTo(2, 6)
    cleanup()
    const w = shareWidths({ id: 'x', olumi: 0.3, person: 0.2, unassigned: 0.5, line: '', hover: '' })
    expect(w.olumi).toBeCloseTo(30, 6); expect(w.person).toBeCloseTo(20, 6); expect(w.unassigned).toBeCloseTo(50, 6)
  })
  it('S10 catch (a second reader): the person\'s share is every person\'s figures together, so the card never reads who the figures were: whoever wrote them, the neutral words are the same and say "your own" to no one', () => {
    type Figure = NonNullable<NonNullable<NonNullable<View['model']>['run']>['rests'][number]['figures']>[number]
    const base = (whose: Array<Figure['whose']>) => withRests(golden('bakery'), (r) => { r.olumi_share = 0.001; r.person_share = 0.7; r.unassigned = 0.3; r.line = ''
      r.figures = whose.map((w, i): Figure => ({ id: `fig_${i}`, label: `figure ${i}`, whose: w, share: 0, text: '', line: '', mark: null, give: null })) }, 'second_oven')
    const read = (v: View) => { const t = draw(v, 'second_oven').share!.textContent; cleanup(); return t }
    const written = read(base(['theirs'])), others = read(base(['theirs', 'theirs', 'olumi'])), mixed = read(base(['mixed']))
    expect(written).toBe(NEUTRAL_REST_WORDS); expect(others).toBe(written); expect(mixed).toBe(written)
    expect(written).not.toMatch(CREDIT)
  })
})

describe('the card keeps its height', () => {
  it('H1 the track keeps its 3px height and takes no margin of its own (the 8px gap of the face spaces it; the band and the mark are out of flow), so the card does not grow by them', () => {
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    expect(css).toMatch(/\.olumi-look \.ok-track \{[^}]*height: 3px;[^}]*margin: 0;/)
    for (const sel of ['.ok-band', '.ok-mark-chance']) expect(css).toMatch(new RegExp(`\\.ok-track > \\${sel} \\{[^}]*position: absolute;`))
  })
})

/** The CSS that reveals the tip and keeps the quiet lens rules on the lane's bar only (Codex 02:2xZ): read as text, rule by rule. */
describe('the tip shows on hover and on keyboard focus only; no stylesheet rule restyles the lens bar', () => {
  const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
  const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), body: m[2]! }))
  it('C1 the track has no stylesheet-driven tooltip', () => {
    expect(rules.filter((r) => r.sel.includes('.ok-range-tip'))).toEqual([])
  })
  it('C2 no stylesheet rule restyles the lens bar: the R24 pill (icons, labels, highlight, count) is drawn by ViewLensBar alone', () => {
    expect(rules.filter((r) => r.sel.includes("[data-testid='lens-bar']") || r.sel.includes('data-lens-label'))).toEqual([])
  })
})

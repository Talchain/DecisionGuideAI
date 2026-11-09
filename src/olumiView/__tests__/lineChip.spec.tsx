/**
 * Core's one chip per link on its line (core API v1.30 `collab.link_marks`, olumi-core PR #22 41765715; canvas/edges/ViewLinkEdge.tsx,
 * canvas/edges/lineChipBoxes.ts). The View is core's own (zero-call core 42dbc844, candidate 6f6b2b0e with PR #22, on a COPY of the seeded consulting board, Cara's page:
 * Ana doubts links.0 and Cara links.1, the two links into "Time to first customer payment"; ../fixtures/linechip). The geometry is built
 * here: both links' ends are put on one short path, so their chips and another link's words would all sit at its middle. The board itself
 * is the browser witness's (~/olumi-work/tm04-chip).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { Position, ReactFlowProvider, type Node } from '@xyflow/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { useLineChips } from '../../canvas/edges/lineChipBoxes'
import { linkMarksOf } from '../../olumiCore/team/LinkMarks'
import { EdgeLabelLayer } from './edgeLabelLayer'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/linechip/cara.view3.json'), 'utf8')) as View
const links = view.model!.links
const [ana, cara] = linkMarksOf(view)
/** The chip's and the words' drawn sizes (jsdom lays nothing out; the browser witness measures the real ones). */
const CHIP = { w: 150, h: 24 }, WORDS = { w: 56, h: 18 }
const CTL = { w: 90, h: 24 }
const sizeOf = (el: HTMLElement) => (el.hasAttribute('data-link-mark-on') ? CHIP : el.hasAttribute('data-view-link-words') ? WORDS : el.hasAttribute('data-link-remove-at') ? CTL : { w: 0, h: 0 })

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) { return sizeOf(this).w })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return sizeOf(this).h })
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000000', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
})
afterEach(() => { cleanup(); useLineChips.setState({ chips: {} }); vi.restoreAllMocks() })

// Every link's two cards, well away from the one path all three are drawn on (so the cards leave the middle free).
const far = (id: string, k: number): Node => ({ id, position: { x: 2000 + 300 * k, y: 0 }, data: {}, width: 220, height: 100, measured: { width: 220, height: 100 } })
/** A reason link that is neither challenged nor proposed: drawn at rest only while it carries a chip. */
const REASON = links.findIndex((l) => l.kind === 'reason' && !l.alert && !l.proposed)
const ids = [...new Set([0, 1, 8, REASON].flatMap((i) => [links[i]!.from, links[i]!.to]))]
const nodes: Node[] = ids.map((id, k) => far(id, k))
/** A card lying on the path (flow units), for the rows where the middle is not free. */
const lying = (x: number, y: number, w: number, h: number): Node => ({ id: 'lying', position: { x, y }, data: {}, width: w, height: h, measured: { width: w, height: h } })
const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
/** The links drawn, each on the path from (110, 100) down to (110, 500); `selected` links are selected. */
const edges = (is: readonly number[], selected: readonly number[] = []) => <svg>
  {is.map((i) => <Edge key={i} id={`e${i}`} source={links[i]!.from} target={links[i]!.to} sourceX={110} sourceY={100} targetX={110} targetY={500}
    sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link: links[i], i }} selected={selected.includes(i)} />)}
</svg>
const draw = (is: readonly number[], extra: readonly Node[] = [], selected: readonly number[] = []) =>
  render(<ReactFlowProvider initialNodes={[...nodes, ...extra]}><EdgeLabelLayer>{edges(is, selected)}</EdgeLabelLayer></ReactFlowProvider>).container
const at = (el: Element | null, size: { w: number; h: number }) => {
  const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)\s*$/.exec((el as HTMLElement).style.transform)!
  return { x: Number(m[1]) - size.w / 2, y: Number(m[2]) - size.h / 2, w: size.w, h: size.h }
}
type Box = { x: number; y: number; w: number; h: number }
const meet = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const chipOf = (c: HTMLElement, i: number) => at(c.querySelector(`[data-link-mark-on="links.${i}"]`), CHIP)
const wordsOf = (c: HTMLElement, i: number) => at(c.querySelector(`[data-view-link-words="links.${i}"]`), WORDS)

describe('core\'s one chip per link, on its line', () => {
  it('core\'s own output: Ana\'s and Cara\'s chips are the two links that hold their links; links.8 has words and no chip', () => {
    expect([ana!.text, cara!.text]).toEqual(['Ana doubts this link', 'Cara doubts this link'])
    expect([links[0]!.holds, links[1]!.holds]).toEqual([ana!.link, cara!.link])
    expect([links[8]!.label, links[8]!.holds]).toEqual(['replaces', null])
  })

  it('HIGH: the chip is on its line, once, in core\'s words: the chip on its face; the stances and the question on hover', async () => {
    const c = draw([0, 8])
    await waitFor(() => expect(c.querySelector('[data-link-mark-on="links.0"]')).toBeVisible())
    const chips = c.querySelectorAll('[data-link-mark]')
    expect(chips.length).toBe(1) // links.8 holds no stance: no chip
    const chip = chips[0]!
    expect([chip.getAttribute('data-link-mark'), chip.getAttribute('data-link-mark-at')]).toEqual(['link:first_cash_timing:time_to_contract', 'line'])
    expect([...chip.querySelectorAll(':scope > span:not(.sr-only)')].map((e) => e.textContent).join('')).toBe('Ana doubts this link')
    expect(chip.getAttribute('title')).toBe([ana!.title, ana!.question].join('\n'))
    expect(chip.textContent).toBe([ana!.text, ana!.label, ana!.question].join(' '))
    // On the line: at the path's middle, where nothing else is.
    const box = chipOf(c, 0)
    expect([box.x + box.w / 2, box.y + box.h / 2]).toEqual([110, 300])
    // Its line is drawn in body ink, a little stronger than a resting link, so the chip reads as its own (CONTRAST: links.8, no chip).
    const lineOf = (i: number) => c.querySelector(`[data-view-link="links.${i}"] path.react-flow__edge-path`) as SVGPathElement
    expect([lineOf(0).style.stroke, lineOf(0).style.strokeWidth]).toEqual(['var(--text-body)', '1.5'])
    expect([lineOf(8).style.stroke, lineOf(8).style.strokeWidth]).not.toEqual(['var(--text-body)', '1.5'])
  })

  it('HIGH: another link\'s words never sit on a chip: they move along their own line, the chip stays', async () => {
    // CONTRAST: alone, links.8's words sit at the middle, which is where the chip of links.0 sits.
    const alone = draw([8])
    const lone = wordsOf(alone, 8)
    cleanup()
    const c = draw([0, 8])
    await waitFor(() => expect(Object.keys(useLineChips.getState().chips)).toEqual(['e0']))
    await waitFor(() => expect(meet(wordsOf(c, 8), chipOf(c, 0))).toBe(false))
    expect(meet(lone, chipOf(c, 0))).toBe(true)
    expect(wordsOf(c, 8).x + WORDS.w / 2).toBe(110) // still on its own line
    expect(chipOf(c, 0)).toEqual({ x: 110 - CHIP.w / 2, y: 300 - CHIP.h / 2, ...CHIP }) // the chip did not move for the words
  })

  it('a reason link someone doubts is drawn at rest with its chip (otherwise a reason link shows only while a card of it is active)', async () => {
    // A reason link core holds no stance on; give it links.0's hold, as a core holding a stance on it would.
    const reason = REASON
    const held = structuredClone(view)
    held.model!.links[reason]!.holds = held.model!.links[0]!.holds
    held.model!.links[0]!.holds = null
    // CONTRAST: as served (no stance on it), the reason link is not drawn at rest.
    const plain = draw([reason])
    expect(plain.querySelector(`[data-view-link="links.${reason}"]`)).toBeNull()
    cleanup()
    useViewStore.setState({ view: held })
    const c = draw([reason])
    await waitFor(() => expect(c.querySelector(`[data-link-mark-on="links.${reason}"]`)).toBeVisible())
    expect(c.querySelector(`[data-view-link="links.${reason}"]`)).not.toBeNull()
    expect(c.querySelector('[data-link-mark-text]')?.textContent).toBe('Ana doubts this link')
  })

  it('two chips on one stretch of line never sit on each other: the later link\'s chip moves clear of the earlier one\'s', async () => {
    const c = draw([0, 1])
    await waitFor(() => expect(Object.keys(useLineChips.getState().chips).sort()).toEqual(['e0', 'e1']))
    await waitFor(() => expect(meet(chipOf(c, 1), chipOf(c, 0))).toBe(false))
    expect([chipOf(c, 0).y + CHIP.h / 2, chipOf(c, 1).x + CHIP.w / 2]).toEqual([300, 110])
  })

  it('an edge that goes takes its chip\'s box back, and the words return to their middle', async () => {
    const c = draw([0, 8])
    await waitFor(() => expect(meet(wordsOf(c, 8), chipOf(c, 0))).toBe(false))
    cleanup()
    expect(useLineChips.getState().chips).toEqual({})
    const again = draw([8])
    expect(wordsOf(again, 8)).toEqual({ x: 110 - WORDS.w / 2, y: 300 - WORDS.h / 2, ...WORDS })
  })

  it('a chip whose mark goes (the edge stays drawn) takes its box back, and the words return to their middle', async () => {
    const c = draw([0, 8])
    await waitFor(() => expect(meet(wordsOf(c, 8), chipOf(c, 0))).toBe(false))
    act(() => { useViewStore.setState({ view: { ...view, collab: { ...view.collab, link_marks: undefined } } }) })
    await waitFor(() => expect(useLineChips.getState().chips).toEqual({}))
    expect(c.querySelector('[data-link-mark]')).toBeNull()
    await waitFor(() => expect(wordsOf(c, 8)).toEqual({ x: 110 - WORDS.w / 2, y: 300 - WORDS.h / 2, ...WORDS }))
  })

  it('a card on the middle of the line: the chip sits along its line clear of it; with no room by the line at all, it sits at the clear point nearest it, joined by a leader, still shown', async () => {
    // A card across the middle: the chip moves along its own line, off the card.
    const across = lying(0, 250, 220, 100)
    const c = draw([0], [across])
    await waitFor(() => expect(Object.keys(useLineChips.getState().chips)).toEqual(['e0']))
    const box = chipOf(c, 0)
    expect(meet(box, { x: 0, y: 250, w: 220, h: 100 })).toBe(false)
    expect(box.x + CHIP.w / 2).toBeCloseTo(110, 6) // on its line
    expect(c.querySelector('[data-link-mark-leader="links.0"]')).toBeNull()
    cleanup(); useLineChips.setState({ chips: {} })
    // A card over the whole line: no point by it is clear, so the chip sits off it with a leader, and is shown at rest.
    const over = lying(0, 90, 220, 420)
    const d = draw([0], [over])
    await waitFor(() => expect(Object.keys(useLineChips.getState().chips)).toEqual(['e0']))
    expect(meet(chipOf(d, 0), { x: 0, y: 90, w: 220, h: 420 })).toBe(false)
    expect(d.querySelector('[data-link-mark-leader="links.0"]')).not.toBeNull()
    expect(d.querySelector('[data-link-mark-on="links.0"]')).toBeVisible()
  })

  it('the remove control of the selected link keeps clear of its chip', async () => {
    const c = draw([0], [], [0])
    await waitFor(() => expect(Object.keys(useLineChips.getState().chips)).toEqual(['e0']))
    await waitFor(() => expect(c.querySelector('[data-link-remove-at="links.0"]')).toBeVisible())
    const ctl = at(c.querySelector('[data-link-remove-at="links.0"]'), CTL)
    // CONTRAST: the control's own first choice is the middle of the line, where the chip sits.
    expect(meet({ x: 110 - CTL.w / 2, y: 300 - CTL.h / 2, ...CTL }, chipOf(c, 0))).toBe(true)
    expect(meet(ctl, chipOf(c, 0))).toBe(false)
  })

  it('catch: on an earlier version no chip is drawn on a line', async () => {
    // CONTRAST: on the version shown, the chip is drawn.
    const now = draw([0])
    await waitFor(() => expect(now.querySelector('[data-link-mark]')).not.toBeNull())
    cleanup(); useLineChips.setState({ chips: {} })
    useViewStore.setState({ at: 1 })
    const c = draw([0, 1])
    expect(c.querySelector('[data-link-mark]')).toBeNull()
    expect(useLineChips.getState().chips).toEqual({})
  })
})

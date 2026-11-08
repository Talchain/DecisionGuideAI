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
import { cleanup, render, waitFor } from '@testing-library/react'
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
const sizeOf = (el: HTMLElement) => (el.hasAttribute('data-link-mark-on') ? CHIP : el.hasAttribute('data-view-link-words') ? WORDS : { w: 0, h: 0 })

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) { return sizeOf(this).w })
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) { return sizeOf(this).h })
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000000', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
})
afterEach(() => { cleanup(); useLineChips.setState({ chips: {} }); vi.restoreAllMocks() })

// Every link's two cards, well away from the one path all three are drawn on (so the cards leave the middle free).
const far = (id: string, k: number): Node => ({ id, position: { x: 2000 + 300 * k, y: 0 }, data: {}, width: 220, height: 100, measured: { width: 220, height: 100 } })
const ids = [...new Set([0, 1, 8].flatMap((i) => [links[i]!.from, links[i]!.to]))]
const nodes: Node[] = ids.map((id, k) => far(id, k))
const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
/** The links drawn, each on the path from (110, 100) down to (110, 500). */
const draw = (is: readonly number[]) => render(<ReactFlowProvider initialNodes={nodes}><EdgeLabelLayer><svg>
  {is.map((i) => <Edge key={i} id={`e${i}`} source={links[i]!.from} target={links[i]!.to} sourceX={110} sourceY={100} targetX={110} targetY={500}
    sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link: links[i], i }} />)}
</svg></EdgeLabelLayer></ReactFlowProvider>).container
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

  it('two chips on one stretch of line never sit on each other: the later link\'s chip moves clear of the earlier one\'s', async () => {
    const c = draw([0, 1])
    await waitFor(() => expect(Object.keys(useLineChips.getState().chips).sort()).toEqual(['e0', 'e1']))
    await waitFor(() => expect(meet(chipOf(c, 1), chipOf(c, 0))).toBe(false))
    expect([chipOf(c, 0).y + CHIP.h / 2, chipOf(c, 1).x + CHIP.w / 2]).toEqual([300, 110])
  })

  it('a chip that goes takes its box back, and the words return to their middle', async () => {
    const c = draw([0, 8])
    await waitFor(() => expect(meet(wordsOf(c, 8), chipOf(c, 0))).toBe(false))
    cleanup()
    expect(useLineChips.getState().chips).toEqual({})
    const again = draw([8])
    expect(wordsOf(again, 8)).toEqual({ x: 110 - WORDS.w / 2, y: 300 - WORDS.h / 2, ...WORDS })
  })

  it('catch: on an earlier version no chip is drawn on a line', () => {
    useViewStore.setState({ at: 1 })
    const c = draw([0, 1])
    expect(c.querySelector('[data-link-mark]')).toBeNull()
  })
})

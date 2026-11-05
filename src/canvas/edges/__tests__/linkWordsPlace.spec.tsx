/**
 * R5 (the design lead's R3 look check, item 3; github-3c approved the fix): a link's words ("!", "◇", its sign or strength) sit in React Flow's
 * label layer, above resting cards (R3: "a card never cuts them"), so where the path's midpoint fell over a card they were drawn over its text.
 * They now sit at the nearest point along the link's own path that is clear of every card, still in the label layer; where none is clear, at
 * the midpoint as before. Geometry constructed (no browser slot: github-3c, 5 Nov): a card lying across the link's midpoint.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { getBezierPath, Position, ReactFlowProvider, type Node } from '@xyflow/react'
import type { ViewLink } from '../../../olumiView/client'
import { ViewLinkEdge } from '../ViewLinkEdge'
import { linkWordsAt } from '../linkWordsPlace'
import { EdgeLabelLayer } from '../../../olumiView/__tests__/edgeLabelLayer'

afterEach(cleanup)
/** The edge with only the props it reads (React Flow passes the rest). */
const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
const ends = { sourceX: 0, sourceY: 0, targetX: 0, targetY: 400, sourcePosition: Position.Bottom, targetPosition: Position.Top }
const [path, mx, my] = getBezierPath(ends)
/** A card lying across the link's midpoint (flow units), and one well clear of it. */
const across = { x: mx - 100, y: my - 40, w: 200, h: 80 }, clear = { x: 400, y: 0, w: 200, h: 80 }
const inside = (p: { x: number; y: number }, b: typeof across) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h

describe('a link\'s words sit at the nearest point along its path that is clear of every card', () => {
  it('a card across the midpoint: the words move along the path, off the card, as near the middle as the cards allow', () => {
    const at = linkWordsAt(path, [across, clear], { w: 0, h: 0 }, { x: mx, y: my })
    expect(inside({ x: mx, y: my }, across)).toBe(true)
    expect(inside(at, across)).toBe(false)
    expect(Math.abs(at.x - mx)).toBeLessThan(1) // a vertical link: the words stay on it
    expect(Math.abs(at.y - my)).toBeLessThanOrEqual(40 + 0.05 * 400 + 1) // the first clear step past the card's edge
  })

  it('CONTRAST: a clear midpoint keeps the words at the midpoint; with no clear point anywhere, the midpoint as before', () => {
    expect(linkWordsAt(path, [clear], { w: 0, h: 0 }, { x: mx, y: my })).toEqual({ x: mx, y: my })
    const everywhere = { x: -1000, y: -1000, w: 3000, h: 3000 }
    expect(linkWordsAt(path, [everywhere], { w: 0, h: 0 }, { x: mx, y: my })).toEqual({ x: mx, y: my })
  })

  it('the words\' own size counts: a box that would touch the card is not clear', () => {
    const at = linkWordsAt(path, [across], { w: 20, h: 30 }, { x: mx, y: my })
    const box = { x: at.x - 10, y: at.y - 15, w: 20, h: 30 }
    const overlaps = box.x < across.x + across.w && box.x + box.w > across.x && box.y < across.y + across.h && box.y + box.h > across.y
    expect(overlaps).toBe(false)
  })

  it('on the canvas: the link edge places its words off the card React Flow holds there', () => {
    const nodes: Node[] = [{ id: 'k', position: { x: across.x, y: across.y }, data: {}, width: across.w, height: across.h, measured: { width: across.w, height: across.h } }]
    const link = { from: 'a', to: 'b', kind: 'causal', label: '!', title: 't', doubt: false, alert: true, proposed: false, effect: null } as unknown as ViewLink
    const c = render(<ReactFlowProvider initialNodes={nodes}><EdgeLabelLayer><svg><Edge id="e" source="a" target="b" {...ends} data={{ link, i: 0 }} /></svg></EdgeLabelLayer></ReactFlowProvider>).container
    const words = c.querySelector<HTMLElement>('[data-view-link-words="links.0"]')!
    const m = /translate\(([-\d.e]+)px, ([-\d.e]+)px\)$/.exec(words.style.transform)!
    expect(inside({ x: Number(m[1]), y: Number(m[2]) }, across), words.style.transform).toBe(false)
  })
})

/**
 * R5 (the design lead's R3 look check, item 3; github-3c approved the fix): a link's words ("!", "◇", its sign or strength) sit in React Flow's
 * label layer, above resting cards (R3: "a card never cuts them"), so where the path's midpoint fell over a card they were drawn over its text.
 * They now sit at the nearest point along the link's own path that is clear of every card, still in the label layer; where none is clear, at
 * the midpoint as before. Geometry constructed (no browser slot: github-3c, 5 Nov): a card lying across the link's midpoint.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path_ from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { getBezierPath, Position, ReactFlowProvider, useStoreApi, type Node } from '@xyflow/react'
import type { ViewLink } from '../../../olumiView/client'
import { ViewLinkEdge } from '../ViewLinkEdge'
import { linkWordsAt, NEAR, REACH } from '../linkWordsPlace'
import { linkWordsIdOf } from '../../../olumiView/canvas'
import { EdgeLabelLayer } from '../../../olumiView/__tests__/edgeLabelLayer'

afterEach(cleanup)
/** The edge with only the props it reads (React Flow passes the rest). */
const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
const ends = { sourceX: 0, sourceY: 0, targetX: 0, targetY: 400, sourcePosition: Position.Bottom, targetPosition: Position.Top }
const [path, mx, my] = getBezierPath(ends)
/** A card lying across the link's midpoint (flow units), and one well clear of it. */
const across = { x: mx - 100, y: my - 40, w: 200, h: 80 }, clear = { x: 400, y: 0, w: 200, h: 80 }
const inside = (p: { x: number; y: number }, b: typeof across) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h
type B = { x: number; y: number; w: number; h: number }
const boxOver = (p: { x: number; y: number }, s: { w: number; h: number }, c: B) =>
  p.x - s.w / 2 < c.x + c.w && p.x + s.w / 2 > c.x && p.y - s.h / 2 < c.y + c.h && p.y + s.h / 2 > c.y
/** Where the edge drew its words (the last translate of their transform). */
const drawnAt = (el: HTMLElement) => { const m = /translate\(([-\d.e]+)px, ([-\d.e]+)px\)$/.exec(el.style.transform)!; return { x: Number(m[1]), y: Number(m[2]) } }
/** jsdom lays nothing out: the words measure as the browser measured them. */
function measureWordsAs(size: { w: number; h: number }): () => void {
  const was = { w: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!, h: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')! }
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-view-link-words') ? size.w : 0 } })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-view-link-words') ? size.h : 0 } })
  return () => { Object.defineProperty(HTMLElement.prototype, 'offsetWidth', was.w); Object.defineProperty(HTMLElement.prototype, 'offsetHeight', was.h) }
}
let api: ReturnType<typeof useStoreApi> | null = null
const Grab = () => { api = useStoreApi(); return null }
const node = (b: B & { id: string }): Node => ({ id: b.id, position: { x: b.x, y: b.y }, data: {}, width: b.w, height: b.h, measured: { width: b.w, height: b.h } })

describe('a link\'s words sit at the nearest point along its path that is clear of every card', () => {
  it('a card across the midpoint: the words move along the path, off the card, as near the middle as the cards allow', () => {
    const at = linkWordsAt(path, [across, clear], { w: 0, h: 0 }, { x: mx, y: my })
    expect(inside({ x: mx, y: my }, across)).toBe(true)
    expect(inside(at, across)).toBe(false)
    expect(Math.abs(at.x - mx)).toBeLessThan(1) // a vertical link: the words stay on it
    expect(Math.abs(at.y - my)).toBeLessThanOrEqual(40 + 0.05 * 400 + 1) // the first clear step past the card's edge
  })

  it('CONTRAST: a clear midpoint keeps the words at the midpoint', () => {
    expect(linkWordsAt(path, [clear], { w: 0, h: 0 }, { x: mx, y: my })).toEqual({ x: mx, y: my })
  })

  it('catch (DL 7 Nov, Paul\'s "ent!prise"): with no clear point on the path, the words sit off every card, never at the midpoint over one', () => {
    const size = { w: 11, h: 18 }, everywhere = { x: -1000, y: -1000, w: 3000, h: 3000 }
    for (const cs of [[everywhere], [across, { x: mx - 300, y: -50, w: 600, h: 500 }]]) {
      const at = linkWordsAt(path, cs, size, { x: mx, y: my })
      for (const c of cs) expect(boxOver(at, size, c), `${JSON.stringify(at)} over ${JSON.stringify(c)}`).toBe(false)
    }
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

describe('words off their path stay with their link (PL 7 Nov: never detached; DL 7 Nov: within a short reach, or only while near)', () => {
  // A vertical link (x = 0, y 0 to 400) covered end to end: a card over its upper part, a wider one over the rest and its middle.
  const vertical = getBezierPath({ sourceX: 0, sourceY: 0, targetX: 0, targetY: 400, sourcePosition: Position.Bottom, targetPosition: Position.Top })
  const vpath = vertical[0], vmid = { x: vertical[1], y: vertical[2] }, size = { w: 11, h: 18 }
  const toLink = (p: { x: number; y: number }) => (p.y >= 0 && p.y <= 400 ? Math.abs(p.x) : Math.hypot(p.x, p.y < 0 ? p.y : p.y - 400))
  it('catch: the words take the clear point nearest the LINK (not its middle), within REACH, with a leader to the link beyond NEAR', () => {
    // The only room within REACH is beside the link's upper part, more than REACH from its middle (y 200): rings round the middle alone miss it.
    const upper = { x: -60, y: -50, w: 120, h: 150 }, lower = { x: -200, y: 100, w: 400, h: 350 }
    const at = linkWordsAt(vpath, [upper, lower], size, vmid)
    for (const c of [upper, lower]) expect(boxOver(at, size, c), `${JSON.stringify(at)} over ${JSON.stringify(c)}`).toBe(false)
    expect(toLink(at)).toBeLessThanOrEqual(REACH)
    expect(toLink(at)).toBeGreaterThan(NEAR)
    expect(at.leaderTo, 'a leader joins words farther than NEAR to their link').toBeDefined()
    expect(Math.abs(at.leaderTo!.x)).toBeLessThan(0.01) // on the link
    expect(at.far).toBeUndefined()
  })
  it('must not change: words that find room within NEAR of their link need no leader', () => {
    const narrow = { x: -15, y: -50, w: 30, h: 500 }
    const at = linkWordsAt(vpath, [narrow], size, vmid)
    expect(boxOver(at, size, narrow)).toBe(false)
    expect(toLink(at)).toBeLessThanOrEqual(NEAR)
    expect(at.leaderTo).toBeUndefined()
  })
  it('no room within REACH: the words are far, off every card, with a leader to the link\'s middle', () => {
    const everywhere = { x: -1000, y: -1000, w: 3000, h: 3000 }
    const at = linkWordsAt(vpath, [everywhere], size, vmid)
    expect(boxOver(at, size, everywhere)).toBe(false)
    expect(at.far).toBe(true)
    expect(at.leaderTo).toEqual(vmid)
  })
  it('catch at the renderer: far words are not drawn at rest; with the link near they are, joined to it by their leader', () => {
    const restore = measureWordsAs(size)
    try {
      const everywhere = { id: 'cover', x: -1000, y: -1000, w: 3000, h: 3000 }
      const link = { from: 'a', to: 'b', kind: 'reason', label: '!', title: 't', doubt: false, alert: true, proposed: false, effect: null } as unknown as ViewLink
      const draw = (selected: boolean) => render(<ReactFlowProvider initialNodes={[node(everywhere)]}><EdgeLabelLayer><svg>
        <Edge id="e" source="a" target="b" sourceX={0} sourceY={0} targetX={0} targetY={400} sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i: 0 }} selected={selected} />
      </svg></EdgeLabelLayer></ReactFlowProvider>).container
      const rest = draw(false)
      expect(rest.querySelector('[data-view-link-words="links.0"]')).toBeNull()
      expect(rest.querySelector('[data-view-link-leader]')).toBeNull()
      cleanup()
      const near = draw(true)
      const at = drawnAt(near.querySelector<HTMLElement>('[data-view-link-words="links.0"]')!)
      expect(boxOver(at, size, everywhere)).toBe(false)
      const d = near.querySelector('[data-view-link-leader="links.0"]')?.getAttribute('d')
      expect(d).toBe(`M ${at.x},${at.y} L ${vmid.x},${vmid.y}`)
    } finally { restore() }
  })
  it('the words describe their link to a screen reader: they carry the id its edge names (React Flow\'s aria-describedby)', () => {
    const link = { from: 'a', to: 'b', kind: 'causal', label: '+', title: 't', doubt: false, alert: false, proposed: false, effect: null } as unknown as ViewLink
    const c = render(<ReactFlowProvider><EdgeLabelLayer><svg><Edge id="e" source="a" target="b" {...ends} data={{ link, i: 3 }} /></svg></EdgeLabelLayer></ReactFlowProvider>).container
    expect(c.querySelector('[data-view-link-words="links.3"]')?.id).toBe(linkWordsIdOf(3))
  })
})

describe('on the canvas, the edge places its words against the cards as React Flow holds them NOW', () => {
  type Fixture = { cards: (B & { id: string })[]; links: { edge: string; source: string; target: string; sourceX: number; sourceY: number; targetX: number; targetY: number; words: { w: number; h: number } }[] }
  const paul = JSON.parse(readFileSync(path_.resolve('src/canvas/edges/__tests__/fixtures/paul-board-marks.20261107.json'), 'utf8')) as Fixture
  it('catch (Paul\'s board, his "ent!prise"): the cards laid out after the links first drew, no "!" box intersects any card', () => {
    const restore = measureWordsAs(paul.links[0]!.words)
    try {
      // First drawn before layout (every card at the origin, unmeasured), as the canvas first mounts; then laid out where his board has them.
      const first = paul.cards.map((c) => ({ ...node({ ...c, x: 0, y: 0, w: 0, h: 0 }), measured: { width: 0, height: 0 } }))
      const c = render(<ReactFlowProvider initialNodes={first}><Grab /><EdgeLabelLayer><svg>
        {paul.links.map((l, i) => {
          const link = { from: l.source, to: l.target, kind: 'reason', label: '!', title: 't', doubt: false, alert: true, proposed: false, effect: null } as unknown as ViewLink
          return <Edge key={l.edge} id={l.edge} source={l.source} target={l.target} sourceX={l.sourceX} sourceY={l.sourceY} targetX={l.targetX} targetY={l.targetY}
            sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i }} selected />
        })}
      </svg></EdgeLabelLayer></ReactFlowProvider>).container
      act(() => { api!.getState().setNodes(paul.cards.map(node)) })
      paul.links.forEach((l, i) => {
        const at = drawnAt(c.querySelector<HTMLElement>(`[data-view-link-words="links.${i}"]`)!)
        for (const card of paul.cards) expect(boxOver(at, l.words, card), `${l.edge}: ${JSON.stringify(at)} over ${card.id}`).toBe(false)
      })
    } finally { restore() }
  })
  it('catch (PL 7 Nov, at the renderer): a rail link\'s measured words clear every card', () => {
    const restore = measureWordsAs({ w: 120, h: 36 })
    try {
      // The rail fixture's board (linkRail.spec.ts): the outcome at the right edge into its aim beside the question.
      const board = [{ id: 'aimL', x: 243, y: 0, w: 220, h: 115 }, { id: 'q', x: 479, y: 0, w: 272, h: 145 }, { id: 'aimR', x: 767, y: 0, w: 220, h: 192 },
        { id: 'option', x: 261, y: 224, w: 220, h: 330 }, { id: 'driverA', x: 151, y: 624, w: 220, h: 213 }, { id: 'driverB', x: 907, y: 624, w: 220, h: 304 },
        { id: 'outcomeL', x: 151, y: 1221, w: 220, h: 272 }, { id: 'outcomeR', x: 907, y: 1221, w: 220, h: 347 }]
      const link = { from: 'outcomeR', to: 'aimR', kind: 'causal', label: '+', title: 't', doubt: false, alert: false, proposed: false, effect: { text: 'strong', title: 't' } } as unknown as ViewLink
      const c = render(<ReactFlowProvider initialNodes={board.map(node)}><EdgeLabelLayer><svg>
        <Edge id="r" source="outcomeR" target="aimR" sourceX={1017} sourceY={1568} targetX={877} targetY={0} sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i: 0 }} selected />
      </svg></EdgeLabelLayer></ReactFlowProvider>).container
      expect(c.querySelector('g[data-rail]')).not.toBeNull()
      const at = drawnAt(c.querySelector<HTMLElement>('[data-view-link-words="links.0"]')!)
      for (const card of board) expect(boxOver(at, { w: 120, h: 36 }, card), `${JSON.stringify(at)} over ${card.id}`).toBe(false)
    } finally { restore() }
  })
})

/**
 * DL BLOCKER (demo-audit, 20 Nov): a stored model opened to "Something went wrong" (React #185, an update-depth loop) at 1232, in the link words' measure.
 * The loop (c2483f34): a signed link's words with no room by the link at rest (`far`) were hidden AND their sign REMOVED, so the empty box measured
 * smaller, fitted by the link, the sign came back, measured larger, no longer fitted, and so on without end (5d523f1a kept the sign in the hidden box).
 * The words keep one measured box whatever the placement says: a waiting part is hidden, never removed, so size and placement settle. Geometry
 * constructed: a gap by the link that the empty box fits and the box with its sign does not.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider, type Node } from '@xyflow/react'
import type { ViewLink } from '../../../olumiView/client'
import { isHidden } from '../../../olumiView/v12/links/__tests__/applied'
import { ViewLinkEdge } from '../ViewLinkEdge'
import { EdgeLabelLayer } from '../../../olumiView/__tests__/edgeLabelLayer'

afterEach(cleanup)
const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
type B = { id: string; x: number; y: number; w: number; h: number }
const node = (b: B): Node => ({ id: b.id, position: { x: b.x, y: b.y }, data: {}, width: b.w, height: b.h, measured: { width: b.w, height: b.h } })
/** jsdom lays nothing out: the words measure by what they hold (the sign drawn or not), as the browser measured them. */
const SMALL = { w: 11, h: 18 }, LARGE = { w: 60, h: 30 }
function measureByContent(): () => void {
  const of = (el: HTMLElement) => (el.querySelector('[data-view$=".label"]') !== null ? LARGE : SMALL)
  const was = { w: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')!, h: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')! }
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-view-link-words') ? of(this).w : 0 } })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get(this: HTMLElement) { return this.hasAttribute('data-view-link-words') ? of(this).h : 0 } })
  return () => { Object.defineProperty(HTMLElement.prototype, 'offsetWidth', was.w); Object.defineProperty(HTMLElement.prototype, 'offsetHeight', was.h) }
}
// A vertical link at x 0 between two walls of cards: a 16-wide gap by the line fits the box without its sign (11 wide), never with it (60 wide).
const walls: B[] = [{ id: 'left', x: -3000, y: -3000, w: 2992, h: 6400 }, { id: 'right', x: 8, y: -3000, w: 2992, h: 6400 }]
const link = { from: 'a', to: 'b', kind: 'reason', label: '!', title: 't', doubt: false, alert: true, proposed: false, effect: null } as unknown as ViewLink
const draw = () => render(<ReactFlowProvider initialNodes={walls.map(node)}><EdgeLabelLayer><svg>
  <Edge id="e" source="a" target="b" sourceX={0} sourceY={0} targetX={0} targetY={400} sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i: 0 }} />
</svg></EdgeLabelLayer></ReactFlowProvider>).container

describe('a link\'s words settle: their measured size never depends on where they were placed', () => {
  it('in a gap the empty box fits and the box with its sign does not, the edge renders (no update-depth loop): the words wait hidden at rest with their sign still in them', () => {
    const restore = measureByContent()
    try {
      const c = draw()
      const words = c.querySelector<HTMLElement>('[data-view-link-words="links.0"]')!
      const sign = c.querySelector<HTMLElement>('[data-view="links.0.label"]')
      expect(isHidden(words), 'far at rest: hidden').toBe(true)
      expect(sign, 'the sign stays in the box, so the box keeps its size').not.toBeNull()
      expect(c.querySelector('[data-view-link-leader]'), 'no leader to hidden words').toBeNull()
    } finally { restore() }
  })
})

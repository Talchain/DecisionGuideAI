/**
 * F8 (27 Sep 2026) — a click selects the LINE nearest the pointer, not the
 * topmost hit area. The served witness (build-vs-buy e-9 vs e-10, pricing-model
 * e-10 vs e-11 at the landing) is the browser probe; this pins the rule and the
 * DOM glue in jsdom, whose SVG has no geometry — so each path is given a real
 * straight-line geometry here (getTotalLength / getPointAtLength / getScreenCTM),
 * stated as a stub.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { pickNearestEdge, resolveNearestEdgeAtPoint, screenDistanceToPath, edgeGroupAtPoint } from '../nearestEdgeAtPoint'
import type { EdgeHoverSeat } from '../edgeHoverArbiter'
import { edgeGroup as lineGroup, stubElementsFromPoint, restoreElementsFromPoint } from './__helpers__/edgeLineGeometry'

/** A `.react-flow__edge` group whose drawn path is the segment (x0,y0)→(x1,y1) in screen px. */
const edgeGroup = (id: string, x0: number, y0: number, x1: number, y1: number, scale = 1) =>
  lineGroup(id, x0, y0, x1, y1, { scale })

afterEach(() => {
  document.body.innerHTML = ''
  restoreElementsFromPoint()
})

/** A hover seat with a logging behaviour, mounted on `canvas` (null: no `.react-flow` root). */
function seat(id: string, log: string[], canvas: Element | null = null): EdgeHoverSeat {
  const element = document.createElement('div')
  ;(canvas ?? document.body).appendChild(element)
  return {
    id,
    behaviour: { current: { enter: () => log.push(`enter ${id}`), leave: () => log.push(`leave ${id}`) } },
    element: { current: element },
  }
}

describe('pickNearestEdge — the rule', () => {
  it('the nearest line wins over the clicked (topmost) one', () => {
    expect(pickNearestEdge([{ id: 'e-10', distance: 5.1 }, { id: 'e-9', distance: 1.2 }], 'e-10')).toBe('e-9')
  })
  it('the clicked edge keeps a near-tie, so the pick never flips between two equal lines', () => {
    expect(pickNearestEdge([{ id: 'e-10', distance: 2.2 }, { id: 'e-9', distance: 2.0 }], 'e-10')).toBe('e-10')
  })
  it('nothing measurable → the clicked edge', () => {
    expect(pickNearestEdge([{ id: 'e-10', distance: Infinity }], 'e-10')).toBe('e-10')
  })
})

describe('screenDistanceToPath — through the camera transform', () => {
  it('measures in SCREEN px at a zoomed-out camera', () => {
    const { g } = edgeGroup('a', 0, 100, 400, 100, 0.5)
    const d = screenDistanceToPath(g.querySelector('path.react-flow__edge-path')!, 200, 106)
    expect(d).toBeCloseTo(6, 3)
  })
})

describe('resolveNearestEdgeAtPoint — the claimants are every hit area under the pointer', () => {
  it('build-vs-buy e-9 / e-10 shape: e-10 is on top, the pointer is on e-9\'s line → e-9', () => {
    // Two near-parallel links 6px apart, as in the landing gutter. e-10 paints later.
    const e9 = edgeGroup('e-9', 0, 200, 400, 200)
    const e10 = edgeGroup('e-10', 0, 206, 400, 206)
    stubElementsFromPoint(() => [e10.hit, e9.hit, document.body])
    expect(resolveNearestEdgeAtPoint(150, 200.5, 'e-10')).toBe('e-9')
  })

  it('CONTRAST: the pointer on e-10\'s own line keeps e-10', () => {
    const e9 = edgeGroup('e-9', 0, 200, 400, 200)
    const e10 = edgeGroup('e-10', 0, 206, 400, 206)
    stubElementsFromPoint(() => [e10.hit, e9.hit, document.body])
    expect(resolveNearestEdgeAtPoint(150, 205.5, 'e-10')).toBe('e-10')
  })

  it('a click the pointer did not make (keyboard: the clicked edge is not under the point) is left alone', () => {
    const e9 = edgeGroup('e-9', 0, 200, 400, 200)
    stubElementsFromPoint(() => [e9.hit])
    expect(resolveNearestEdgeAtPoint(0, 0, 'e-3')).toBe('e-3')
  })
})

describe('edgeHoverArbiter — the hover follows the same rule', () => {
  it('the pointer on e-9\'s line inside e-10\'s (topmost) hit area hovers e-9, and only e-9', async () => {
    const { registerEdgeHover, routeEdgeHover, endEdgeHover } = await import('../edgeHoverArbiter')
    const e9 = edgeGroup('e-9', 0, 200, 400, 200)
    const e10 = edgeGroup('e-10', 0, 206, 400, 206)
    stubElementsFromPoint(() => [e10.hit, e9.hit, document.body])
    const log: string[] = []
    const s9 = seat('e-9', log)
    const s10 = seat('e-10', log)
    const off9 = registerEdgeHover(s9)
    const off10 = registerEdgeHover(s10)
    routeEdgeHover(s10, 150, 200.5) // the event arrives at e-10's group
    expect(log).toEqual(['enter e-9'])
    routeEdgeHover(s10, 150, 205.5) // the pointer moves onto e-10's own line
    expect(log).toEqual(['enter e-9', 'leave e-9', 'enter e-10'])
    endEdgeHover()
    expect(log).toEqual(['enter e-9', 'leave e-9', 'enter e-10', 'leave e-10'])
    off9()
    off10()
  })
})

describe('edgeHoverArbiter — a label chip names its own edge', () => {
  it('hovering a chip that sits over a neighbour\'s line hovers the chip\'s edge, not the nearest line', async () => {
    const { registerEdgeHover, claimEdgeHover, endEdgeHover } = await import('../edgeHoverArbiter')
    const e9 = edgeGroup('e-9', 0, 200, 400, 200)
    const e10 = edgeGroup('e-10', 0, 206, 400, 206)
    stubElementsFromPoint(() => [e10.hit, e9.hit, document.body])
    const log: string[] = []
    const off9 = registerEdgeHover(seat('e-9', log))
    const s10 = seat('e-10', log)
    const off10 = registerEdgeHover(s10)
    claimEdgeHover(s10)
    expect(log).toEqual(['enter e-10'])
    endEdgeHover()
    off9()
    off10()
  })
})

describe('edgeHoverArbiter — one edge id mounted on two canvases (comparison view)', () => {
  /**
   * ⭐ review r08 note 4. `ComparisonCanvasLayout` mounts one MiniCanvas per
   * scenario over a shared edge list, so `e-9` is mounted twice. The hover must
   * go to the copy on the canvas the pointer is on. A registry keyed by edge id
   * alone handed it to whichever copy registered LAST — canvas B here.
   */
  it('the nearest line is looked up on the receiving edge\'s own canvas', async () => {
    const { registerEdgeHover, routeEdgeHover, endEdgeHover } = await import('../edgeHoverArbiter')
    const canvasA = document.createElement('div')
    canvasA.className = 'react-flow'
    const canvasB = document.createElement('div')
    canvasB.className = 'react-flow'
    document.body.append(canvasA, canvasB)
    const e9 = edgeGroup('e-9', 0, 200, 400, 200)
    const e10 = edgeGroup('e-10', 0, 206, 400, 206)
    stubElementsFromPoint(() => [e10.hit, e9.hit, document.body])
    const log: string[] = []
    const a9 = seat('e-9', log, canvasA)
    const a10 = seat('e-10', log, canvasA)
    const b9 = { ...seat('e-9', log, canvasB), behaviour: { current: { enter: () => log.push('enter B e-9'), leave: () => log.push('leave B e-9') } } }
    const b10 = { ...seat('e-10', log, canvasB), behaviour: { current: { enter: () => log.push('enter B e-10'), leave: () => log.push('leave B e-10') } } }
    const offs = [registerEdgeHover(a9), registerEdgeHover(a10), registerEdgeHover(b9), registerEdgeHover(b10)]
    routeEdgeHover(a10, 150, 200.5) // the event arrives at canvas A's e-10
    expect(log).toEqual(['enter e-9'])
    endEdgeHover()
    for (const off of offs) off()
  })
})

describe('edgeGroupAtPoint — the group of an edge UNDER the pointer', () => {
  it('finds the named edge among the hit areas at the point, and nothing it is not under', () => {
    const e9 = edgeGroup('e-9', 0, 200, 400, 200)
    const e10 = edgeGroup('e-10', 0, 206, 400, 206)
    stubElementsFromPoint(() => [e10.hit, e9.hit, document.body])
    expect(edgeGroupAtPoint(150, 200.5, 'e-9')).toBe(e9.g)
    expect(edgeGroupAtPoint(150, 200.5, 'e-10')).toBe(e10.g)
    expect(edgeGroupAtPoint(150, 200.5, 'e-3')).toBeNull()
  })
})

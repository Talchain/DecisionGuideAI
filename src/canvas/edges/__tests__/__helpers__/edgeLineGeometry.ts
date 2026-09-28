/**
 * F8 test geometry — jsdom's SVG has no geometry, so a drawn edge path is given
 * a real straight-line one here (getTotalLength / getPointAtLength /
 * getScreenCTM), stated as a stub. Shared by the resolver, the click / menu
 * re-point and the StyledEdge hover specs, so all three measure the same lines.
 *
 * ⚠ NOT A `.spec.` FILE — the vitest include glob would collect it as a suite.
 */

const SVG = 'http://www.w3.org/2000/svg'

/**
 * Give `drawn` the segment (x0,y0)→(x1,y1) in SCREEN px. User space is
 * screen / scale (a camera zoom), so the CTM is a pure scale.
 */
export function stubStraightLine(drawn: Element, x0: number, y0: number, x1: number, y1: number, scale = 1): void {
  const d = drawn as unknown as Record<string, unknown>
  const ux0 = x0 / scale, uy0 = y0 / scale, ux1 = x1 / scale, uy1 = y1 / scale
  const len = Math.hypot(ux1 - ux0, uy1 - uy0)
  d.getTotalLength = () => len
  d.getPointAtLength = (l: number) => ({ x: ux0 + ((ux1 - ux0) * l) / len, y: uy0 + ((uy1 - uy0) * l) / len })
  d.getScreenCTM = () => ({ a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 })
}

/**
 * A bare `.react-flow__edge` group (xyflow's wrapper shape: `data-id`, an
 * optional tabindex) whose drawn path is the segment (x0,y0)→(x1,y1).
 */
export function edgeGroup(
  id: string,
  x0: number, y0: number, x1: number, y1: number,
  opts: { scale?: number; parent?: Element; focusable?: boolean } = {},
) {
  const g = document.createElementNS(SVG, 'g')
  g.setAttribute('class', 'react-flow__edge')
  g.setAttribute('data-id', id)
  if (opts.focusable) g.setAttribute('tabindex', '0')
  const hit = document.createElementNS(SVG, 'path')
  hit.setAttribute('stroke', 'transparent')
  const drawn = document.createElementNS(SVG, 'path')
  drawn.setAttribute('class', 'react-flow__edge-path')
  stubStraightLine(drawn, x0, y0, x1, y1, opts.scale ?? 1)
  g.appendChild(hit)
  g.appendChild(drawn)
  ;(opts.parent ?? document.body).appendChild(g)
  return { g, hit, drawn }
}

type Doc = { elementsFromPoint?: unknown }
const originalElementsFromPoint = (document as Doc).elementsFromPoint

/** What `document.elementsFromPoint` returns, top to bottom, for every point. */
export function stubElementsFromPoint(stack: () => Element[]): void {
  ;(document as Doc).elementsFromPoint = stack
}

export function restoreElementsFromPoint(): void {
  ;(document as Doc).elementsFromPoint = originalElementsFromPoint
}

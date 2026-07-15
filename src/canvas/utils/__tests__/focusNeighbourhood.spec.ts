import { describe, expect, it } from 'vitest'
import { neighbourhoodNodeIds, computeFocusPlan } from '../focusNeighbourhood'

const edges = [
  { source: 'a', target: 'g' },
  { source: 'b', target: 'g' },
  { source: 'c', target: 'a' },
  { source: 'd', target: 'e' },
]

describe('neighbourhoodNodeIds — F2 focus neighbourhood', () => {
  it('includes the node itself plus every directly connected node (either direction)', () => {
    // a → g (out), c → a (in) ⇒ {a, g, c}
    expect([...neighbourhoodNodeIds('a', edges)].sort()).toEqual(['a', 'c', 'g'])
  })

  it('collects neighbours across multiple incident edges', () => {
    // g receives a and b ⇒ {g, a, b}
    expect([...neighbourhoodNodeIds('g', edges)].sort()).toEqual(['a', 'b', 'g'])
  })

  it('returns just the node when it has no incident edges', () => {
    expect([...neighbourhoodNodeIds('lonely', edges)]).toEqual(['lonely'])
  })

  it('handles an empty graph', () => {
    expect([...neighbourhoodNodeIds('x', [])]).toEqual(['x'])
  })
})

/**
 * computeFocusPlan — the single focus decision (F2 camera + F3 dim), pure and
 * pinned here; ReactFlowGraph's handleFocusNode only applies the plan.
 *
 * Pins:
 * - F3: dimNodeIds = every node OUTSIDE the neighbourhood; the target and its
 *   direct neighbours are never dimmed.
 * - F2 no-churn: moveCamera is false when the whole neighbourhood is already
 *   comfortably visible (see cameraComfort.spec.ts for the rule itself), true
 *   from far zoom / off-screen, and true (fail-open to fitting) when the
 *   camera cannot be measured.
 */
const planNode = (id: string, x: number, y: number) => ({
  id,
  position: { x, y },
  measured: { width: 200, height: 80 },
})

// a → g, c → a; d–e off in their own corner; 'lonely' disconnected.
const planNodes = [
  planNode('a', 200, 200),
  planNode('g', 500, 200),
  planNode('c', 200, 400),
  planNode('b', 500, 400),
  planNode('d', 3000, 3000),
  planNode('e', 3300, 3000),
  planNode('lonely', 200, 600),
]

const comfortableCamera = {
  viewport: { x: 0, y: 0, zoom: 1 },
  paneWidth: 1200,
  paneHeight: 900,
  insets: { top: 40, right: 40, bottom: 40, left: 40 },
}

describe('computeFocusPlan — F3 dim set (non-neighbours only)', () => {
  it('dims every node outside the neighbourhood; target + neighbours stay undimmed', () => {
    const plan = computeFocusPlan('a', planNodes, edges, null)
    expect(plan).not.toBeNull()
    expect([...plan!.focusNodeIds].sort()).toEqual(['a', 'c', 'g'])
    expect([...plan!.dimNodeIds].sort()).toEqual(['b', 'd', 'e', 'lonely'])
  })

  it('a disconnected focus target dims everything else', () => {
    const plan = computeFocusPlan('lonely', planNodes, edges, null)
    expect([...plan!.focusNodeIds]).toEqual(['lonely'])
    expect([...plan!.dimNodeIds].sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'g'])
  })

  it('returns null for an id that is not on the canvas (fail-closed)', () => {
    expect(computeFocusPlan('ghost', planNodes, edges, null)).toBeNull()
  })
})

describe('computeFocusPlan — F2 no-churn camera decision', () => {
  it('does NOT move the camera when the whole neighbourhood is already comfortably readable', () => {
    const plan = computeFocusPlan('a', planNodes, edges, comfortableCamera)
    expect(plan!.moveCamera).toBe(false)
  })

  it('moves the camera from a far zoom (target would be unreadable)', () => {
    const plan = computeFocusPlan('a', planNodes, edges, {
      ...comfortableCamera,
      viewport: { x: 0, y: 0, zoom: 0.2 },
    })
    expect(plan!.moveCamera).toBe(true)
  })

  it('moves the camera when a neighbour is off-screen, even if the target itself is visible', () => {
    // d is visible at this viewport; its neighbour e (d→e) is pushed off-pane.
    const plan = computeFocusPlan('d', planNodes, edges, {
      ...comfortableCamera,
      viewport: { x: -2900, y: -2800, zoom: 1 },
      paneWidth: 500,
      paneHeight: 500,
    })
    expect(plan!.moveCamera).toBe(true)
  })

  it('moves the camera when the camera state cannot be measured (fail-open to fitting)', () => {
    expect(computeFocusPlan('a', planNodes, edges, null)!.moveCamera).toBe(true)
  })
})

/**
 * A connection says WHAT IT JOINS, not which ids it joins.
 *
 * Measured on the deployed build (staging `e5a62322`, live model, 10 Sep 2026):
 * **21 of 21** `.react-flow__edge` groups carried React Flow's own default
 * name, `"Edge from 2891dabb to c12af5de"` — our internal node ids, spoken to
 * anyone who cannot see the canvas. Contrast control in the same probe: node
 * cards announced prose, so the surface can carry it; and `edgesWithInnerAria`
 * was **0**, so the rich name `StyledEdge` composes was not in the document at
 * all — it lives on an element that exists only while the label is visible.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildEdgeAccessibleName,
  withEdgeAccessibleNames,
  UNTITLED_NODE_NAME,
  type NameableEdge,
} from '../edgeAccessibleName'

const labels = new Map<string, string>([
  ['2891dabb', 'Outsource Overflow to a Third-Party Logistics Provider'],
  ['c12af5de', '3PL Overflow Capacity'],
  ['2a9eb771', 'Carrier Cut-off Compliance'],
  ['ac02582c', 'Next-Day Delivery Rate'],
])

/** Endpoint ids and labels taken from the real model the defect was measured on. */
const edges: NameableEdge[] = [
  { id: 'e-0', source: '2891dabb', target: 'c12af5de', data: {} },
  { id: 'e-1', source: '2a9eb771', target: 'ac02582c', data: {} },
]

describe('the sentence a connection answers to', () => {
  it('names both endpoints and keeps the direction explicit', () => {
    expect(
      buildEdgeAccessibleName({ sourceLabel: 'Carrier Cut-off Compliance', targetLabel: 'Next-Day Delivery Rate' }),
    ).toBe('Connection from Carrier Cut-off Compliance to Next-Day Delivery Rate')
  })

  it('appends the edge’s own painted description when it has one', () => {
    expect(
      buildEdgeAccessibleName({ sourceLabel: 'A', targetLabel: 'B', description: 'Moderate boost (likelihood not set)' }),
    ).toBe('Connection from A to B. Moderate boost (likelihood not set)')
  })

  /**
   * ⛔ THE HONESTY ARM. An edge nobody has estimated must contribute NO clause.
   * A fabricated "Raises 50%" spoken to someone who cannot see the canvas is as
   * false as one drawn on it, and harder to challenge — there is nothing on
   * screen to contradict it.
   */
  it('says nothing extra when the edge describes nothing', () => {
    for (const empty of [undefined, null, '', '   ']) {
      expect(buildEdgeAccessibleName({ sourceLabel: 'A', targetLabel: 'B', description: empty })).toBe(
        'Connection from A to B',
      )
    }
  })

  it('falls back to the estate’s existing word for an unlabelled node', () => {
    expect(buildEdgeAccessibleName({ sourceLabel: null, targetLabel: '  ' })).toBe(
      `Connection from ${UNTITLED_NODE_NAME} to ${UNTITLED_NODE_NAME}`,
    )
  })
})

describe('every edge gets named, and no id survives', () => {
  it('names all of them — this is the property the defect violated', () => {
    // Floor: an empty input would satisfy every assertion in the loop vacuously.
    expect(edges.length, 'fixture is empty').toBeGreaterThan(0)
    const named = withEdgeAccessibleNames(edges, labels, 'human')
    expect(named).toHaveLength(edges.length)
    for (const e of named) {
      expect(e.ariaLabel, `${e.id} has no accessible name`).toBeTruthy()
      // The precise regression: a raw endpoint id reaching the spoken name.
      expect(e.ariaLabel).not.toContain(e.source)
      expect(e.ariaLabel).not.toContain(e.target)
    }
  })

  /**
   * ⭐⭐ BOUND BY IDENTITY, PROVEN BY A DISCRIMINATING PAIR.
   *
   * A name built from the wrong endpoint is still a well-formed sentence, so a
   * "contains prose" assertion cannot see the defect. Arm 1: this edge's name
   * carries ITS OWN endpoints' labels. Arm 2 — the discrimination — renaming a
   * node this edge does NOT touch must leave its name byte-identical. One arm
   * alone proves sensitivity to something; the pair proves it is bound to the
   * named object.
   */
  it('uses its own endpoints, not another edge’s', () => {
    const [first] = withEdgeAccessibleNames(edges, labels, 'human')
    expect(first.ariaLabel).toContain('Outsource Overflow to a Third-Party Logistics Provider')
    expect(first.ariaLabel).toContain('3PL Overflow Capacity')
    // Arm 2: perturb a node that is NOT an endpoint of this edge.
    const perturbed = new Map(labels)
    perturbed.set('2a9eb771', 'RENAMED — NOT AN ENDPOINT OF e-0')
    const [firstAgain] = withEdgeAccessibleNames(edges, perturbed, 'human')
    expect(firstAgain.ariaLabel).toBe(first.ariaLabel)
    // ...and the edge that DOES touch it must move, or arm 2 proved nothing.
    const [, second] = withEdgeAccessibleNames(edges, perturbed, 'human')
    expect(second.ariaLabel).toContain('RENAMED — NOT AN ENDPOINT OF e-0')
  })

  it('never flattens a name a caller already chose', () => {
    const withOwn: NameableEdge[] = [{ ...edges[0], ariaLabel: 'A considered name' }]
    expect(withEdgeAccessibleNames(withOwn, labels, 'human')[0].ariaLabel).toBe('A considered name')
  })
})

/**
 * ⭐⭐ THE MOUNT-PATH GUARD — a value assertion cannot prove a reference.
 *
 * Every assertion above passes on a module nothing imports. The measured defect
 * was never that this logic was wrong; it was that **no name reached the
 * element React Flow labels**. So this reads the seam's SOURCE and pins that it
 * applies the naming, and pins its own precondition so it cannot pass by
 * pointing at a file that has moved.
 */
describe('the seam that feeds <ReactFlow> actually applies it', () => {
  const seam = resolve(__dirname, '../../ReactFlowGraph.tsx')
  const src = readFileSync(seam, 'utf8')

  it('precondition — this really is the file that builds memoizedEdges', () => {
    expect(src).toContain('const memoizedEdges')
    expect(src).toContain('<ReactFlow')
  })

  it('memoizedEdges names the edges before they reach React Flow', () => {
    expect(src).toContain('withEdgeAccessibleNames')
    expect(src).toContain("from './domain/edgeAccessibleName'")
  })
})

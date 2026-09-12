/**
 * ⭐ THE PILL AND THE PAYLOAD MUST ANSWER THE SAME QUESTION.
 *
 * `useSelectionContext` feeds `SelectionPill`, which tells the user which
 * element their next question is about. `deriveSelectedElementRefs` decides
 * what `selected_elements` actually carries. These were two independent reads
 * of the same store, and they disagreed on real states:
 *
 *   · a node with NO LABEL — the hook fell back to `?? id` and displayed a raw
 *     node id as if it were a name; the wire omits the label entirely;
 *   · a node with NO KIND — the hook named it in the pill; the wire DROPS it,
 *     because `kind` is required by the contract and there is nothing truthful
 *     to put there. So the product named an element the turn did not carry.
 *
 * Each case below is a DISCRIMINATING PAIR: it asserts what the wire does and
 * what the surface does, in the same test, on the same state. A test that only
 * checked the surface would pass just as happily while the two drifted apart
 * again — which is exactly how this defect survived.
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useSelectionContext, useSelectionCarriage } from '../useSelectionContext'
import { deriveSelectedElementRefs } from '../../conversation/selectedElementRefs'
import { useCanvasStore } from '../../store'

type Node = { id: string; type?: unknown; data?: unknown }
type Edge = { id: string; source?: unknown; target?: unknown }

function seed(nodeIds: string[], edgeIds: string[], nodes: Node[], edges: Edge[]) {
  useCanvasStore.setState({
    selection: { nodeIds: new Set(nodeIds), edgeIds: new Set(edgeIds), anchorPosition: null },
    nodes,
    edges,
  } as never)
  return { selection: { nodeIds: new Set(nodeIds), edgeIds: new Set(edgeIds) }, nodes, edges }
}

const NAMED = { id: 'n-1', type: 'option', data: { label: 'Hire a tech lead' } }
const KINDLESS = { id: 'n-kindless', type: '', data: { label: 'Named but kindless' } }
const UNLABELLED = { id: 'n-bare', type: 'factor', data: {} }

describe('useSelectionContext ⇄ the wire — one question, one answer', () => {
  it('names a carried element, and the wire carries exactly it', () => {
    const state = seed(['n-1'], [], [NAMED], [])
    const { result } = renderHook(() => useSelectionContext())
    expect(result.current).toEqual({ id: 'n-1', label: 'Hire a tech lead', kind: 'node' })
    // The pair: the surface's claim is true of the payload.
    expect(deriveSelectedElementRefs(state)).toEqual([
      { id: 'n-1', kind: 'option', label: 'Hire a tech lead' },
    ])
  })

  it('⭐ a KINDLESS node is named by neither — the pill no longer claims a turn the wire drops', () => {
    const state = seed(['n-kindless'], [], [KINDLESS], [])
    // The wire withholds…
    expect(deriveSelectedElementRefs(state)).toBeUndefined()
    // …so the surface must not name it. Before this fix it rendered the label.
    const { result } = renderHook(() => useSelectionContext())
    expect(result.current).toBeNull()
  })

  it('⭐ an UNLABELLED node yields no name rather than a raw id — an id is not a name', () => {
    const state = seed(['n-bare'], [], [UNLABELLED], [])
    const refs = deriveSelectedElementRefs(state)
    expect(refs).toEqual([{ id: 'n-bare', kind: 'factor' }])
    expect(refs?.[0]).not.toHaveProperty('label')

    const { result } = renderHook(() => useSelectionContext())
    // Before this fix the hook returned `{ label: 'n-bare' }` and the pill read
    // "Selected: n-bare", telling the user the product knew what they had
    // pointed at when it did not.
    expect(result.current).toBeNull()
  })

  it('a stale selection over a deleted node is named by neither', () => {
    const state = seed(['n-gone'], [], [NAMED], [])
    expect(deriveSelectedElementRefs(state)).toBeUndefined()
    const { result } = renderHook(() => useSelectionContext())
    expect(result.current).toBeNull()
  })

  it('an edge is displayed by endpoint LABELS while keeping the wire identity as its id', () => {
    const nodes = [NAMED, { id: 'n-2', type: 'factor', data: { label: 'Delivery velocity' } }]
    const state = seed([], ['rf-7'], nodes, [{ id: 'rf-7', source: 'n-1', target: 'n-2' }])
    expect(deriveSelectedElementRefs(state)).toEqual([{ id: 'n-1→n-2', kind: 'edge' }])

    const { result } = renderHook(() => useSelectionContext())
    expect(result.current).toEqual({
      id: 'n-1→n-2', // the WIRE's identity, so the pill's guard keys on what is sent
      label: 'Hire a tech lead → Delivery velocity', // display only
      kind: 'edge',
    })
  })

  it('a multi-element selection is carried by the wire and left to a different surface', () => {
    const nodes = [NAMED, { id: 'n-2', type: 'factor', data: { label: 'Delivery velocity' } }]
    const state = seed(['n-1', 'n-2'], [], nodes, [])
    // The wire DOES carry both…
    expect(deriveSelectedElementRefs(state)).toHaveLength(2)
    // …and this single-element pill correctly declines to describe it. That is
    // honest silence, not a withheld selection — nothing false is being said.
    const { result } = renderHook(() => useSelectionContext())
    expect(result.current).toBeNull()
    const { result: carriage } = renderHook(() => useSelectionCarriage())
    expect(carriage.current.kind).toBe('carried')
  })

  it('⭐ carriage distinguishes the two silences the context collapses', () => {
    seed([], [], [NAMED], [])
    expect(renderHook(() => useSelectionCarriage()).result.current.kind).toBe('none')

    seed(['n-gone'], [], [NAMED], [])
    expect(renderHook(() => useSelectionCarriage()).result.current.kind).toBe(
      'withheld_unresolvable',
    )

    const many = Array.from({ length: 21 }, (_, i) => ({
      id: `m-${i}`,
      type: 'factor',
      data: { label: `Factor ${i}` },
    }))
    seed(many.map((n) => n.id), [], many, [])
    const over = renderHook(() => useSelectionCarriage()).result.current
    expect(over.kind).toBe('withheld_over_cap')
    // Both silences return null from the context — which is why the pill needs
    // the carriage to tell them apart.
    expect(renderHook(() => useSelectionContext()).result.current).toBeNull()
  })
})

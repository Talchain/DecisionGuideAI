/**
 * The selection derivation, and the two absences it must name apart.
 *
 * ⭐ THE LOAD-BEARING TEST HERE IS THE PARITY ONE, and it is not a tidiness
 * check. The composer chip's whole justification is that it renders the WIRE's
 * answer rather than a second opinion — so the property that must never break
 * is that `describeSelectionCarriage(...).refs` is exactly what
 * `deriveSelectedElementRefs(...)` returns, for the same state. If those two
 * ever diverge, the chip is telling the user something the payload does not do,
 * which is the defect class this component was written to close.
 *
 * Every case binds BY IDENTITY (explicit ids and labels), never by a value
 * predicate another element could satisfy.
 */

import { describe, it, expect } from 'vitest'
import {
  deriveSelectedElementRefs,
  describeSelectionCarriage,
  MAX_SELECTED_ELEMENTS,
  type SelectionSourceState,
} from '../selectedElementRefs'

function state(partial: {
  nodeIds?: string[]
  edgeIds?: string[]
  nodes?: Array<{ id: string; type?: unknown; data?: unknown }>
  edges?: Array<{ id: string; source?: unknown; target?: unknown }>
}): SelectionSourceState {
  return {
    selection: {
      nodeIds: new Set(partial.nodeIds ?? []),
      edgeIds: new Set(partial.edgeIds ?? []),
    },
    nodes: partial.nodes ?? [],
    edges: partial.edges ?? [],
  }
}

const OPTION_A = { id: 'n-a', type: 'option', data: { label: 'Open a second roastery' } }
const OPTION_B = { id: 'n-b', type: 'option', data: { label: 'Stay single-site' } }
const KINDLESS = { id: 'n-kindless', type: '', data: { label: 'Has a name, no kind' } }
const UNLABELLED = { id: 'n-bare', type: 'factor', data: {} }

describe('deriveSelectedElementRefs — what the wire will carry', () => {
  it('carries a selected node with its id, kind and label', () => {
    const refs = deriveSelectedElementRefs(state({ nodeIds: ['n-a'], nodes: [OPTION_A, OPTION_B] }))
    expect(refs).toEqual([{ id: 'n-a', kind: 'option', label: 'Open a second roastery' }])
  })

  it('omits label rather than sending an empty string (the contract is .min(1))', () => {
    const refs = deriveSelectedElementRefs(state({ nodeIds: ['n-bare'], nodes: [UNLABELLED] }))
    expect(refs).toEqual([{ id: 'n-bare', kind: 'factor' }])
    expect(refs?.[0]).not.toHaveProperty('label')
  })

  it('drops a node with no kind rather than fabricating one', () => {
    expect(deriveSelectedElementRefs(state({ nodeIds: ['n-kindless'], nodes: [KINDLESS] })))
      .toBeUndefined()
  })

  it('drops a stale id over a deleted node rather than inventing a ref', () => {
    expect(deriveSelectedElementRefs(state({ nodeIds: ['n-gone'], nodes: [OPTION_A] })))
      .toBeUndefined()
  })

  it('orders by STORE order, not selection-set insertion order', () => {
    // Insert b first; the store lists a first. Store order must win, so the
    // payload is a pure function of the selected SETS.
    const sel = new Set(['n-b', 'n-a'])
    const refs = deriveSelectedElementRefs({
      selection: { nodeIds: sel, edgeIds: new Set() },
      nodes: [OPTION_A, OPTION_B],
      edges: [],
    })
    expect(refs?.map((r) => r.id)).toEqual(['n-a', 'n-b'])
  })

  it('addresses an edge by its canonical endpoint composite, never its UI id', () => {
    const refs = deriveSelectedElementRefs(
      state({ edgeIds: ['rf-edge-7'], edges: [{ id: 'rf-edge-7', source: 'n-a', target: 'n-b' }] }),
    )
    expect(refs).toEqual([{ id: 'n-a→n-b', kind: 'edge' }])
  })

  it('drops an edge whose id no longer resolves — no neighbouring-edge fallback', () => {
    const refs = deriveSelectedElementRefs(
      state({ edgeIds: ['rf-gone'], edges: [{ id: 'rf-edge-7', source: 'n-a', target: 'n-b' }] }),
    )
    expect(refs).toBeUndefined()
  })

  it('withholds ENTIRELY over the cap — a truncation would be a false statement', () => {
    const nodes = Array.from({ length: MAX_SELECTED_ELEMENTS + 1 }, (_, i) => ({
      id: `n-${i}`,
      type: 'factor',
      data: { label: `Factor ${i}` },
    }))
    const over = state({ nodeIds: nodes.map((n) => n.id), nodes })
    expect(deriveSelectedElementRefs(over)).toBeUndefined()

    // Discriminating twin: exactly AT the cap must still carry, so the test
    // above is proving the boundary and not merely that large sets fail.
    const atCap = nodes.slice(0, MAX_SELECTED_ELEMENTS)
    const carried = deriveSelectedElementRefs(
      state({ nodeIds: atCap.map((n) => n.id), nodes: atCap }),
    )
    expect(carried).toHaveLength(MAX_SELECTED_ELEMENTS)
  })

  it('degrades to undefined on a selection-less or absent store, never throws', () => {
    expect(deriveSelectedElementRefs(undefined)).toBeUndefined()
    expect(deriveSelectedElementRefs(null)).toBeUndefined()
    expect(deriveSelectedElementRefs({})).toBeUndefined()
  })
})

describe('describeSelectionCarriage — the two absences, named apart (trap 21)', () => {
  it('nothing selected is "none" — the composer should say nothing', () => {
    expect(describeSelectionCarriage(state({ nodes: [OPTION_A] }))).toEqual({ kind: 'none' })
  })

  it('an over-cap selection is WITHHELD, not "none" — silence there would be a lie', () => {
    const nodes = Array.from({ length: MAX_SELECTED_ELEMENTS + 1 }, (_, i) => ({
      id: `n-${i}`,
      type: 'factor',
      data: { label: `Factor ${i}` },
    }))
    const carriage = describeSelectionCarriage(state({ nodeIds: nodes.map((n) => n.id), nodes }))
    expect(carriage).toEqual({
      kind: 'withheld_over_cap',
      selectedCount: MAX_SELECTED_ELEMENTS + 1,
      cap: MAX_SELECTED_ELEMENTS,
    })
    // The discrimination that matters: it must NOT collapse to the silent case.
    expect(carriage.kind).not.toBe('none')
  })

  it('a stale selection under the cap is WITHHELD as unresolvable, not "none"', () => {
    const carriage = describeSelectionCarriage(state({ nodeIds: ['n-gone'], nodes: [OPTION_A] }))
    expect(carriage).toEqual({ kind: 'withheld_unresolvable', selectedCount: 1 })
    expect(carriage.kind).not.toBe('none')
  })

  it('⭐ PARITY: the carried refs ARE the wire payload, on every carrying state', () => {
    const cases: SelectionSourceState[] = [
      state({ nodeIds: ['n-a'], nodes: [OPTION_A, OPTION_B] }),
      state({ nodeIds: ['n-a', 'n-b'], nodes: [OPTION_A, OPTION_B] }),
      state({ nodeIds: ['n-bare'], nodes: [UNLABELLED] }),
      state({ edgeIds: ['e1'], edges: [{ id: 'e1', source: 'n-a', target: 'n-b' }] }),
      state({
        nodeIds: ['n-a'],
        edgeIds: ['e1'],
        nodes: [OPTION_A],
        edges: [{ id: 'e1', source: 'n-a', target: 'n-b' }],
      }),
    ]
    for (const s of cases) {
      const wire = deriveSelectedElementRefs(s)
      const carriage = describeSelectionCarriage(s)
      expect(carriage.kind).toBe('carried')
      // The chip may show only what the wire sends — byte-for-byte.
      expect(carriage.kind === 'carried' ? carriage.refs : null).toEqual(wire)
    }
  })

  it('⭐ PARITY (negative arm): whenever the wire withholds, nothing is ever "carried"', () => {
    const withholding: SelectionSourceState[] = [
      state({ nodeIds: ['n-gone'], nodes: [OPTION_A] }),
      state({ nodeIds: ['n-kindless'], nodes: [KINDLESS] }),
      state({ edgeIds: ['rf-gone'], edges: [{ id: 'e1', source: 'n-a', target: 'n-b' }] }),
    ]
    for (const s of withholding) {
      expect(deriveSelectedElementRefs(s)).toBeUndefined()
      expect(describeSelectionCarriage(s).kind).not.toBe('carried')
      expect(describeSelectionCarriage(s).kind).not.toBe('none')
    }
  })
})

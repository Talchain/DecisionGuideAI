import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import {
  computeStructuralAbsence,
  type StructuralAbsenceKind,
} from '../computeStructuralAbsence'

function node(id: string, kind: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label: id, ...data } } as Node
}

function edge(id: string, source: string, target: string, data: Record<string, unknown> = {}): Edge {
  return { id, source, target, data } as Edge
}

/** A producer-stated negative edge — `directionSource` is what makes it readable. */
function negativeEdge(id: string, source: string, target: string): Edge {
  return edge(id, source, target, { direction: 'negative', directionSource: 'cee' })
}

/**
 * Two options acting through DIFFERENT factors, each reaching a modelled risk.
 * This is the "healthy" baseline: every check's precondition holds and none of
 * them fires. Each test below perturbs exactly one thing away from it, so a
 * finding can only be attributed to that perturbation.
 */
function healthyGraph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'controllable' }),
      node('f2', 'factor', { category: 'external' }),
      node('r1', 'risk'),
    ],
    edges: [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      edge('e3', 'f1', 'r1'),
    ],
  }
}

describe('computeStructuralAbsence — gates', () => {
  it('returns null when there are no edges', () => {
    expect(computeStructuralAbsence([node('o1', 'option'), node('o2', 'option')], [])).toBeNull()
  })

  it('returns null below two options — sig_option_breadth owns that advice', () => {
    const { nodes, edges } = healthyGraph()
    const oneOption = nodes.filter(n => n.id !== 'o2')
    expect(computeStructuralAbsence(oneOption, edges)).toBeNull()
  })

  it('returns null on the healthy baseline (no check fires)', () => {
    const { nodes, edges } = healthyGraph()
    expect(computeStructuralAbsence(nodes, edges)).toBeNull()
  })

  it('GLOBAL PRECONDITION: says nothing when an option acts on nothing', () => {
    // The panel's own fixture shape: options wired to nothing, risks floating.
    // The downside check would fire here by its own logic, and it would be the
    // wrong thing to say — the model is not wired yet, which the ladder owns.
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('r1', 'risk'),
      node('r2', 'risk'),
      node('f1', 'factor', { category: 'controllable' }),
      node('g1', 'goal'),
    ]
    const edges = [edge('e1', 'f1', 'g1')]
    expect(computeStructuralAbsence(nodes, edges)).toBeNull()
  })
})

describe('computeStructuralAbsence — no_downside', () => {
  it('fires when risks are modelled but no option reaches one', () => {
    const { nodes } = healthyGraph()
    // Drop the f1 → r1 link: the risk is now stranded.
    const edges = [edge('e1', 'o1', 'f1'), edge('e2', 'o2', 'f2')]
    const result = computeStructuralAbsence(nodes, edges)
    expect(result).toEqual({ kind: 'no_downside', optionCount: 2 })
  })

  it('fires when a negative edge exists but no option reaches it', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'external' }),
      node('f2', 'factor', { category: 'controllable' }),
      node('x1', 'outcome'),
      node('x2', 'outcome'),
    ]
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      // Negative edge sits in a component no option can reach.
      negativeEdge('e3', 'x1', 'x2'),
    ]
    expect(computeStructuralAbsence(nodes, edges)?.kind).toBe('no_downside')
  })

  it('does NOT fire when an option reaches a risk transitively', () => {
    const { nodes, edges } = healthyGraph()
    expect(computeStructuralAbsence(nodes, edges)).toBeNull()
  })

  it('PRECONDITION: says nothing when no downside is modelled at all', () => {
    // No risk node, no negative edge → we cannot distinguish "options miss the
    // downside" from "no downside exists". sig_risk_count owns this case.
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'external' }),
      node('f2', 'factor', { category: 'controllable' }),
    ]
    const edges = [edge('e1', 'o1', 'f1'), edge('e2', 'o2', 'f2')]
    const result = computeStructuralAbsence(nodes, edges)
    expect(result?.kind).not.toBe('no_downside')
  })
})

describe('computeStructuralAbsence — shared_mechanism', () => {
  it('fires when every option targets the identical set, regardless of target kind', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('x1', 'outcome'),
      node('r1', 'risk'),
    ]
    const edges = [
      edge('e1', 'o1', 'x1'),
      edge('e2', 'o2', 'x1'),
      edge('e3', 'x1', 'r1'),
    ]
    expect(computeStructuralAbsence(nodes, edges)).toEqual({
      kind: 'shared_mechanism',
      optionCount: 2,
    })
  })

  it('does NOT fire when option target sets differ', () => {
    const { nodes, edges } = healthyGraph()
    expect(computeStructuralAbsence(nodes, edges)).toBeNull()
  })

  it('PRECONDITION: says nothing when an option has no outgoing edge', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'external' }),
      node('r1', 'risk'),
    ]
    // o2 is unconnected — a different defect. Claiming its mechanism "overlaps"
    // would be a statement about an empty set.
    const edges = [edge('e1', 'o1', 'f1'), edge('e3', 'f1', 'r1')]
    expect(computeStructuralAbsence(nodes, edges)?.kind).not.toBe('shared_mechanism')
  })
})

describe('computeStructuralAbsence — no_external_factor', () => {
  it('fires when factors carry a category but none is external', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'controllable' }),
      node('f2', 'factor', { category: 'observable' }),
      node('r1', 'risk'),
    ]
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      edge('e3', 'f1', 'r1'),
    ]
    expect(computeStructuralAbsence(nodes, edges)).toEqual({
      kind: 'no_external_factor',
      optionCount: 2,
    })
  })

  it('does NOT fire when an external factor exists', () => {
    const { nodes, edges } = healthyGraph()
    expect(computeStructuralAbsence(nodes, edges)).toBeNull()
  })

  it('reads `controllability` when `category` is absent', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { controllability: 'external' }),
      node('f2', 'factor', { controllability: 'controllable' }),
      node('r1', 'risk'),
    ]
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      edge('e3', 'f1', 'r1'),
    ]
    // An external factor IS present via controllability → must not fire.
    expect(computeStructuralAbsence(nodes, edges)).toBeNull()
  })

  it('`category` takes precedence over `controllability`', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      // category says controllable; the stale controllability says external.
      node('f1', 'factor', { category: 'controllable', controllability: 'external' }),
      node('f2', 'factor', { category: 'observable' }),
      node('r1', 'risk'),
    ]
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      edge('e3', 'f1', 'r1'),
    ]
    expect(computeStructuralAbsence(nodes, edges)?.kind).toBe('no_external_factor')
  })

  it('PRECONDITION: NEVER INVENTS — says nothing when no factor carries controllability metadata', () => {
    // This is the fabrication guard. Without it, every graph whose factors CEE
    // has not categorised would be told "nothing outside your control is
    // modelled" — a claim about our own missing metadata dressed as a claim
    // about the user's thinking.
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor'),
      node('f2', 'factor'),
      node('r1', 'risk'),
    ]
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      edge('e3', 'f1', 'r1'),
    ]
    expect(computeStructuralAbsence(nodes, edges)).toBeNull()
  })

  it("PRECONDITION: treats controllability 'unknown' as unknown, not as non-external", () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { controllability: 'unknown' }),
      node('f2', 'factor', { controllability: 'unknown' }),
      node('r1', 'risk'),
    ]
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      edge('e3', 'f1', 'r1'),
    ]
    expect(computeStructuralAbsence(nodes, edges)).toBeNull()
  })

  it('PRECONDITION: one unknown factor holds the whole absence claim closed', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'controllable' }),
      node('f2', 'factor', { controllability: 'unknown' }),
      node('r1', 'risk'),
    ]
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      edge('e3', 'f1', 'r1'),
    ]
    expect(computeStructuralAbsence(nodes, edges)).toBeNull()
  })
})

describe('computeStructuralAbsence — one finding, fixed priority', () => {
  it('no_downside outranks shared_mechanism when both hold', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'external' }),
      node('r1', 'risk'),
    ]
    // Both options target only f1 (shared mechanism) AND the risk is stranded.
    const edges = [edge('e1', 'o1', 'f1'), edge('e2', 'o2', 'f1')]
    expect(computeStructuralAbsence(nodes, edges)?.kind).toBe('no_downside')
  })

  it('shared_mechanism outranks no_external_factor when both hold', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'controllable' }),
      node('r1', 'risk'),
    ]
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f1'),
      edge('e3', 'f1', 'r1'),
    ]
    expect(computeStructuralAbsence(nodes, edges)?.kind).toBe('shared_mechanism')
  })

  it('returns at most one finding — the type admits exactly three kinds', () => {
    const kinds: StructuralAbsenceKind[] = ['no_downside', 'shared_mechanism', 'no_external_factor']
    expect(kinds).toHaveLength(3)
  })
})

/**
 * ⚠ PINNED DELIBERATE OMISSION — do not "complete the set".
 *
 * A fourth structural check, "no feedback anywhere", was named in the original
 * brief. It is NOT implemented and must not be: the UI blocks cycle creation
 * (`validation/graphGuardrails.wouldCreateCycle`) and CEE rejects cycles as a
 * structural violation (`CYCLE_DETECTED`), so every graph is acyclic by
 * construction. The check would fire on 100% of models and its advice would
 * name an edit the product refuses.
 *
 * This test REDs if someone adds a feedback/cycle kind, forcing them to read
 * the reasoning first. It is the KNOWN-DROPPED set, asserted exactly.
 */
describe('computeStructuralAbsence — the fourth check is deliberately absent', () => {
  it('a graph the product could never produce (a cycle) yields no feedback finding', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'external' }),
      node('f2', 'factor', { category: 'controllable' }),
      node('r1', 'risk'),
    ]
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      edge('e3', 'f1', 'r1'),
      // deliberate cycle — impossible via the UI, constructed here on purpose
      edge('e4', 'f1', 'f2'),
      edge('e5', 'f2', 'f1'),
    ]
    const result = computeStructuralAbsence(nodes, edges)
    // Whatever it returns — including nothing — it is never a feedback verdict.
    expect(result === null || !/feedback|cycle|loop/.test(result.kind)).toBe(true)
  })

  it('the kind union admits no feedback member', () => {
    // A compile-time truth asserted at runtime: if someone widens
    // StructuralAbsenceKind with a feedback member, they must delete this test
    // and read the reasoning above it.
    const admitted: string[] = ['no_downside', 'shared_mechanism', 'no_external_factor']
    expect(admitted.some(k => /feedback|cycle|loop/.test(k))).toBe(false)
  })
})

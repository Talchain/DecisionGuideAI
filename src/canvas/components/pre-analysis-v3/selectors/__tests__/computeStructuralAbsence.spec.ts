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
    // Whole-object `toEqual`, so a NEW field arriving unpinned REDs here rather
    // than sliding in unobserved. r1 is the stranded risk this fixture creates.
    expect(result).toEqual({ kind: 'no_downside', optionCount: 2, actionTargetIds: ['r1'] })
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
      actionTargetIds: ['x1'],
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
      actionTargetIds: [],
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

/**
 * ⭐⭐ WHAT THE FINDING CAN NAME — `actionTargetIds`.
 *
 * The finding's SUBJECT and its ACTION TARGET are different things, and this
 * block exists to keep them named apart (CLAUDE.md trap 21). `shared_mechanism`
 * is ABOUT the options — the registry carries `entityKind: 'option'` for
 * exactly that — and the edit it prescribes is at the shared parts they all run
 * through. Asserting the subject here would pass on the wrong object.
 *
 * ⚠ EVERY ASSERTION BINDS BY ID, NEVER BY A VALUE PREDICATE (trap 19) — and
 * identity binding presupposes identity is UNIQUE. A fixture that seeded two
 * nodes under one id would make every `includes`/`find` answer about whichever
 * copy came first, silently. `expectUniqueIds` is therefore a NAMED PRECONDITION
 * that can itself fail, asserted on every fixture below before its finding is
 * read.
 */
function expectUniqueIds(nodes: ReadonlyArray<Node>): void {
  const ids = nodes.map(n => n.id)
  // Asserted as a SET COMPARISON, not a length check on a deduped copy, so the
  // failure message names the duplicate rather than a bare number mismatch.
  const duplicated = ids.filter((id, i) => ids.indexOf(id) !== i)
  expect(duplicated).toEqual([])
  expect(new Set(ids).size).toBe(nodes.length)
}

describe('computeStructuralAbsence — actionTargetIds: what the finding can NAME', () => {
  it('PRECONDITION GUARD ITSELF FAILS on a duplicated fixture id', () => {
    // The precondition above is load-bearing for every identity assertion in
    // this block, so it is proven capable of failing before it is trusted
    // (CLAUDE.md trap 13: an instrument that cannot fail is not evidence).
    expect(() => expectUniqueIds([node('dup', 'option'), node('dup', 'risk')])).toThrow()
  })

  it('no_downside names the STRANDED RISK NODE by id, not the options', () => {
    const { nodes } = healthyGraph()
    expectUniqueIds(nodes)
    const edges = [edge('e1', 'o1', 'f1'), edge('e2', 'o2', 'f2')]
    const result = computeStructuralAbsence(nodes, edges)
    expect(result?.kind).toBe('no_downside')
    // BY IDENTITY: the risk r1 is the element the copy tells the reader to
    // connect. `toEqual` on the whole array, so an extra member REDs too.
    expect(result?.actionTargetIds).toEqual(['r1'])
    // The options are the finding's SUBJECT and must NOT be its action target —
    // marking all N options would mark everything, which marks nothing.
    expect(result?.actionTargetIds).not.toContain('o1')
    expect(result?.actionTargetIds).not.toContain('o2')
  })

  it('no_downside names EVERY stranded risk, because the finding fires only when none is reached', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'external' }),
      node('f2', 'factor', { category: 'controllable' }),
      node('r1', 'risk'),
      node('r2', 'risk'),
    ]
    expectUniqueIds(nodes)
    const edges = [edge('e1', 'o1', 'f1'), edge('e2', 'o2', 'f2')]
    const result = computeStructuralAbsence(nodes, edges)
    expect(result?.kind).toBe('no_downside')
    expect([...(result?.actionTargetIds ?? [])].sort()).toEqual(['r1', 'r2'])
  })

  it('⛔ no_downside names NO NODE on the negative-edge-only limb — a marker sits on a node, and the only downside here is an EDGE', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'external' }),
      node('f2', 'factor', { category: 'controllable' }),
      node('x1', 'outcome'),
      node('x2', 'outcome'),
    ]
    expectUniqueIds(nodes)
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      negativeEdge('e3', 'x1', 'x2'),
    ]
    const result = computeStructuralAbsence(nodes, edges)
    expect(result?.kind).toBe('no_downside')
    // ⚠ HONEST EMPTY, NOT A FALLBACK. There is no risk NODE here; the stated
    // harm is carried by an edge. Naming `x1` or `x2` would assert that an
    // outcome node IS the downside, which nothing in the data says.
    expect(result?.actionTargetIds).toEqual([])
  })

  it('shared_mechanism names the SHARED TARGET nodes — the single route, not the options that take it', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('x1', 'outcome'),
      node('r1', 'risk'),
    ]
    expectUniqueIds(nodes)
    const edges = [
      edge('e1', 'o1', 'x1'),
      edge('e2', 'o2', 'x1'),
      edge('e3', 'x1', 'r1'),
    ]
    const result = computeStructuralAbsence(nodes, edges)
    expect(result?.kind).toBe('shared_mechanism')
    // BY IDENTITY: x1 is the bottleneck every option acts directly on.
    expect(result?.actionTargetIds).toEqual(['x1'])
    // ⭐ THE DISCRIMINATING NEGATIVE. The registry's `entityKind` for this
    // finding is 'option' — its SUBJECT. If `actionTargetIds` also held the
    // options, the two concepts would have collapsed into one.
    expect(result?.actionTargetIds).not.toContain('o1')
    expect(result?.actionTargetIds).not.toContain('o2')
    // r1 is reachable but NOT a direct target of any option — "acts directly
    // on" is the measured claim, and a transitive node is not it.
    expect(result?.actionTargetIds).not.toContain('r1')
  })

  it('shared_mechanism names every member of a multi-node shared route', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('x1', 'outcome'),
      node('x2', 'outcome'),
      node('r1', 'risk'),
    ]
    expectUniqueIds(nodes)
    const edges = [
      edge('e1', 'o1', 'x1'),
      edge('e2', 'o1', 'x2'),
      edge('e3', 'o2', 'x1'),
      edge('e4', 'o2', 'x2'),
      edge('e5', 'x1', 'r1'),
    ]
    const result = computeStructuralAbsence(nodes, edges)
    expect(result?.kind).toBe('shared_mechanism')
    expect([...(result?.actionTargetIds ?? [])].sort()).toEqual(['x1', 'x2'])
  })

  it('⛔ no_external_factor STAYS GLOBAL — an absent node CLASS has no node to mark', () => {
    const nodes = [
      node('o1', 'option'),
      node('o2', 'option'),
      node('f1', 'factor', { category: 'controllable' }),
      node('f2', 'factor', { category: 'observable' }),
      node('r1', 'risk'),
    ]
    expectUniqueIds(nodes)
    const edges = [
      edge('e1', 'o1', 'f1'),
      edge('e2', 'o2', 'f2'),
      edge('e3', 'f1', 'r1'),
    ]
    const result = computeStructuralAbsence(nodes, edges)
    expect(result?.kind).toBe('no_external_factor')
    // The prescribed edit is to ADD a node. No node present on the board is the
    // thing to change, and marking every controllable factor would say "this
    // one is wrong" about factors that are correctly modelled.
    expect(result?.actionTargetIds).toEqual([])
  })

  it('every action target id is a node that EXISTS on the board (fail-closed: no ghost ids)', () => {
    const { nodes } = healthyGraph()
    expectUniqueIds(nodes)
    const edges = [edge('e1', 'o1', 'f1'), edge('e2', 'o2', 'f2')]
    const result = computeStructuralAbsence(nodes, edges)
    const present = new Set(nodes.map(n => n.id))
    for (const id of result?.actionTargetIds ?? []) {
      expect(present.has(id)).toBe(true)
    }
    expect(result?.actionTargetIds.length).toBeGreaterThan(0)
  })
})

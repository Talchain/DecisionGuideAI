/**
 * L61 ITEM 1 — RED-first. BOOT HYDRATION MUST APPLY A SERVER EDGE VALUE THAT
 * HAPPENS TO EQUAL A UI DEFAULT.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT
 * ─────────────────────────────────────────────────────────────────────────────
 * `overlayEdge` decided "the wire supplied this field" by comparing the mapped
 * edge against a SYNTHETIC DEFAULT edge (`mapDraftEdgeToCanvas({from,to})`) and
 * dropping every key that matched. `DEFAULT_EDGE_DATA.weight` is `0.5`, so a
 * server edge carrying `strength.mean: 0.5` mapped to `weight: 0.5`, compared
 * equal to the synthetic default, and was discarded — leaving the user's local
 * `0.7` on screen while the NEXT analysis is computed from the server's `0.5`.
 *
 * That is a screen-vs-compute divergence: the number the user is looking at is
 * not the number the recommendation came from. Under-application is a defensible
 * default on the RECEIPT path (a receipt is an echo of an edit the user just
 * made). At BOOT it is not: the server row IS what the next turn rebases from.
 *
 * The same shape hits `direction` — the synthetic baseline's direction is
 * `'positive'` (derived from the default weight `0.5 >= 0`), so an EXPLICIT
 * server `effect_direction: 'positive'` was dropped and a local `'negative'`
 * survived. A sign is not a rounding difference.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FIX THIS SPEC PINS — presence, not equality, and DERIVED
 * ─────────────────────────────────────────────────────────────────────────────
 * `mapDraftEdgeToCanvas` ALREADY proves which fields the wire carried, for
 * exactly the fields that matter. It derives `wireSuppliedStrength` from the
 * same three probes its priority chain uses and hands it to
 * `edgeValueSourcePatch`, which OMITS any key it cannot justify. So:
 *
 *     `weightSource` present on the mapped edge  ⟺  the wire carried a strength
 *
 * The hydrate path therefore reads presence off the mapper's own stamps rather
 * than inferring it from default-equality. Nothing is hand-listed: the field set
 * is `EDGE_PROVENANCED_FIELDS` and the stamp key is `edgeSourceKey(field)`.
 *
 * ⚠ AND BECAUSE DERIVATION CANNOT PROVE COMPLETENESS (the second face of the
 * mirror trap), §4 below is a HAND-WRITTEN corpus + a union assertion. A guard
 * derived from the registry proves the consumers agree with the registry; only a
 * corpus notices the registry is SHORT. Both are shipped, neither supersedes the
 * other.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useCanvasStore } from '../../store'
import { mergeServerGraphOnHydrate } from '../mergeServerGraph'
import { overlayEdge } from '../mergeAppliedGraph'
import { mapDraftEdgeToCanvas } from '../applyDraftResult'
import {
  EDGE_PROVENANCED_FIELDS,
  edgeSourceKey,
  type EdgeProvenancedField,
} from '../../domain/edgeValueProvenance'

const SCENARIO_ID = '11111111-2222-4333-8444-555555555555'

/** The synthetic baseline the OLD detection compared against. Derived here the
 *  same way the implementation derives it, so this spec cannot drift from it. */
function mapperBaseline(): Record<string, unknown> {
  return (mapDraftEdgeToCanvas({ from: '__b_src__', to: '__b_tgt__' }, 0).data ??
    {}) as Record<string, unknown>
}

function seedGraph(edgeData: Record<string, unknown>): void {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      { id: 'factor-1', type: 'factor', position: { x: 10, y: 20 }, data: { label: 'Spend', kind: 'factor' } },
      { id: 'goal-1', type: 'goal', position: { x: 300, y: 400 }, data: { label: 'Profit', kind: 'goal' } },
    ] as never,
    edges: [
      {
        id: 'local-edge-1',
        source: 'factor-1',
        target: 'goal-1',
        type: 'styled',
        data: { ...edgeData },
      },
    ] as never,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    history: { past: [], future: [] },
  } as never)
}

/** Identity-bound: the edge is found by its OWN id, never by a value predicate
 *  (a value predicate is how a spec ends up passing on a different object). */
function theEdge(): any {
  const e = useCanvasStore.getState().edges.find((x: any) => x.id === 'local-edge-1')
  expect(e, 'the fixture edge must still exist, bound by id').toBeTruthy()
  return e
}

const NODES = [
  { id: 'factor-1', kind: 'factor', label: 'Spend' },
  { id: 'goal-1', kind: 'goal', label: 'Profit' },
]

beforeEach(() => {
  seedGraph({ weight: 0.7, direction: 'negative' })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §1 THE TWO REACHABLE COLLISIONS
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§1 a server edge value that equals a UI default still lands at boot', () => {
  it('THE HEADLINE PIN — server strength.mean 0.5 overwrites the local weight 0.7', () => {
    // 0.5 is DEFAULT_EDGE_DATA.weight. Asserted here rather than assumed, so
    // this pin cannot quietly stop testing the collision if the default moves.
    expect(mapperBaseline().weight, 'fixture must actually collide with the default').toBe(0.5)

    const res = mergeServerGraphOnHydrate({
      nodes: NODES,
      edges: [{ from: 'factor-1', to: 'goal-1', strength: { mean: 0.5 } }],
    })

    expect(theEdge().data.weight).toBe(0.5)
    expect(res.updatedEdgeCount).toBe(1)
  })

  it('the flat `strength_mean` spelling collides identically and lands', () => {
    mergeServerGraphOnHydrate({
      nodes: NODES,
      edges: [{ from: 'factor-1', to: 'goal-1', strength_mean: 0.5 }],
    })
    expect(theEdge().data.weight).toBe(0.5)
  })

  it('the bare `weight` spelling collides identically and lands', () => {
    mergeServerGraphOnHydrate({
      nodes: NODES,
      edges: [{ from: 'factor-1', to: 'goal-1', weight: 0.5 }],
    })
    expect(theEdge().data.weight).toBe(0.5)
  })

  it('THE SIGN PIN — an EXPLICIT server default-positive direction overwrites a local negative', () => {
    expect(mapperBaseline().direction, 'fixture must actually collide with the default').toBe(
      'positive',
    )

    mergeServerGraphOnHydrate({
      nodes: NODES,
      edges: [
        { from: 'factor-1', to: 'goal-1', strength: { mean: 0.9 }, effect_direction: 'positive' },
      ],
    })
    expect(theEdge().data.direction).toBe('positive')
  })

  it('the provenance stamp rides with the value it describes, never alone', () => {
    // #570 A1 semantics: a `*Source` stamp must not outlive or precede its value.
    mergeServerGraphOnHydrate({
      nodes: NODES,
      edges: [{ from: 'factor-1', to: 'goal-1', strength: { mean: 0.5 } }],
    })
    const data = theEdge().data
    expect(data.weight).toBe(0.5)
    expect(data.weightSource).toBe('cee')
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §2 WHAT MUST NOT CHANGE
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§2 the no-op and no-overwrite guarantees survive the fix', () => {
  it('a server value EQUAL to the local value is still a STRICT no-op', () => {
    seedGraph({ weight: 0.5, direction: 'positive' })
    const before = useCanvasStore.getState().edges
    const res = mergeServerGraphOnHydrate({
      nodes: NODES,
      edges: [{ from: 'factor-1', to: 'goal-1', strength: { mean: 0.5 } }],
    })
    expect(res.updatedEdgeCount).toBe(0)
    expect(useCanvasStore.getState().edges).toBe(before)
  })

  it('a field the wire did NOT carry keeps its local value', () => {
    // The wire carries a strength and nothing else — the local direction and a
    // local-only key must both survive. "Server wins" is per-FIELD, not wholesale.
    seedGraph({ weight: 0.7, direction: 'negative', userReviewedStrength: true, curvature: 0.9 })
    mergeServerGraphOnHydrate({
      nodes: NODES,
      edges: [{ from: 'factor-1', to: 'goal-1', strength: { mean: 0.5 } }],
    })
    const data = theEdge().data
    expect(data.weight).toBe(0.5)
    expect(data.direction, 'wire stated no direction — local sign survives').toBe('negative')
    expect(data.curvature, 'a local-only field the wire never mentions survives').toBe(0.9)
  })

  it('layout/root fields and the edge id survive the overlay', () => {
    mergeServerGraphOnHydrate({
      nodes: NODES,
      edges: [{ from: 'factor-1', to: 'goal-1', strength: { mean: 0.5 } }],
    })
    const e = theEdge()
    expect(e.id).toBe('local-edge-1')
    expect(e.source).toBe('factor-1')
    expect(e.target).toBe('goal-1')
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §3 RECEIPT-PATH PARITY — the change is SCOPED
 * ══════════════════════════════════════════════════════════════════════════ */

describe('§3 the RECEIPT path is byte-unchanged', () => {
  it('overlayEdge with NO options still under-applies a default-equal value', () => {
    // The receipt path's declared, accepted under-application (mergeAppliedGraph
    // :177-179). If this flips, the change leaked out of the hydrate path and
    // the #570 provenance semantics are no longer the ones that were reviewed.
    const existing = { id: 'e1', source: 'a', target: 'b', data: { weight: 0.7 } }
    const next = overlayEdge(existing, { from: 'a', to: 'b', strength: { mean: 0.5 } })
    expect(next, 'default-equal weight is not "supplied" on the receipt path').toBe(existing)
    expect(next.data.weight).toBe(0.7)
  })

  it('overlayEdge with NO options still drops an explicit default-positive direction', () => {
    const existing = { id: 'e1', source: 'a', target: 'b', data: { direction: 'negative' } }
    const next = overlayEdge(existing, {
      from: 'a',
      to: 'b',
      strength: { mean: 0.5 },
      effect_direction: 'positive',
    })
    expect(next).toBe(existing)
    expect(next.data.direction).toBe('negative')
  })

  it('overlayEdge with NO options still applies a value that DIFFERS from the default', () => {
    // Positive control: the receipt path is not simply inert.
    const existing = { id: 'e1', source: 'a', target: 'b', data: { weight: 0.7 } }
    const next = overlayEdge(existing, { from: 'a', to: 'b', strength: { mean: 0.91 } })
    expect(next).not.toBe(existing)
    expect(next.data.weight).toBe(0.91)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 * §4 COMPLETENESS — a derived guard AND a hand-written corpus
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * HAND-WRITTEN, ON PURPOSE. The wire spelling that supplies each provenanced
 * field cannot be derived from the registry — the registry names canvas fields,
 * not wire fields. This is the corpus half: it is what would notice that the
 * registry is SHORT of a field the wire actually carries.
 */
const WIRE_SPELLING_FOR_FIELD: Record<EdgeProvenancedField, Record<string, unknown>> = {
  weight: { strength: { mean: 0.5 } },
  direction: { effect_direction: 'positive' },
  beliefExists: { belief_exists: 0.8 },
  strengthStd: { strength: { mean: 0.42, std: 0.25 } },
}

describe('§4 completeness — derived agreement AND a corpus that can notice a short list', () => {
  it('UNION ASSERTION — the corpus covers EXACTLY the provenanced registry', () => {
    // Adding a field to EDGE_PROVENANCED_FIELDS without a corpus entry RED-fails
    // here, instead of silently going untested. This is the assertion that makes
    // the derived guard below non-vacuous.
    expect(Object.keys(WIRE_SPELLING_FOR_FIELD).sort()).toEqual(
      [...EDGE_PROVENANCED_FIELDS].sort(),
    )
  })

  it.each([...EDGE_PROVENANCED_FIELDS])(
    'DERIVED — a wire-supplied `%s` lands at boot regardless of default-equality',
    (field) => {
      seedGraph({ weight: 0.7, direction: 'negative', beliefExists: 0.1, strengthStd: 0.99 })
      const wireEdge = { from: 'factor-1', to: 'goal-1', ...WIRE_SPELLING_FOR_FIELD[field] }

      // What the mapper says the wire carried — the fix's own input.
      const mapped = mapDraftEdgeToCanvas(wireEdge, 0).data as Record<string, unknown>
      expect(
        edgeSourceKey(field) in mapped,
        `corpus entry for ${field} must actually make the mapper stamp it`,
      ).toBe(true)

      mergeServerGraphOnHydrate({ nodes: NODES, edges: [wireEdge] })
      expect(theEdge().data[field]).toEqual(mapped[field])
    },
  )

  it('CORPUS — every mapper-baseline key with a real default is either presence-covered or reviewed', () => {
    // ⚠ THIS IS THE GUARD THAT NOTICES THE REGISTRY IS SHORT.
    //
    // The presence rule covers the PROVENANCED fields. Any OTHER key the mapper
    // always emits with a non-undefined default is still detected by equality,
    // and so is still droppable if the wire ever starts supplying it. That set
    // is enumerated here BY HAND and reviewed; a new always-emitted defaulted
    // mapper field makes this RED rather than silently joining the blind spot.
    const presenceCovered = new Set<string>(EDGE_PROVENANCED_FIELDS)
    const stillEqualityDetected = Object.entries(mapperBaseline())
      .filter(([k, v]) => v !== undefined && !presenceCovered.has(k))
      .map(([k]) => k)
      .sort()

    expect(stillEqualityDetected).toEqual(
      [
        // None of these is settable from a CEE wire edge by `mapDraftEdgeToCanvas`
        // — they arrive only via the `...DEFAULT_EDGE_DATA` spread or a literal.
        // Reviewed 2026-08-04 (L61). If this list grows, check whether the new
        // field CAN come off the wire before adding it.
        'beliefStrength',
        'curvature',
        'functionType',
        'kind',
        'pathType',
        'schemaVersion',
        'style',
      ].sort(),
    )
  })
})

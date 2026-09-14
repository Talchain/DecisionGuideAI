/**
 * The capture refuses to invent a strength — even though the contract demands one.
 *
 * ⭐⭐ THE PROPERTY THIS FILE DEFENDS, and it is the one that decides whether
 * this whole carrier is honest: `structural_add_edge` REQUIRES a `magnitude`,
 * and a freshly drawn link does not have one. `onConnect` builds it from
 * `USER_EDGE_DEFAULTS` — `weight: 0.3, direction: 'positive'`, with **no**
 * `weightSource` and **no** `directionSource` — so the canvas's own provenance
 * gates already read both as NOT SET.
 *
 * Putting that `0.3` on the wire would assert a strength the user never stated,
 * CEE would persist it as theirs, and PLoT would analyse it. That is the exact
 * constant `formatNumericLabel`'s header records the canvas once printing as a
 * measurement (ROADMAP 2.950) — the same defect, one layer down and harder to see.
 */
import { describe, it, expect } from 'vitest'
import { captureStructuralAddEdge } from '../structuralAddEdge'
import {
  resolveEdgeSignedStrengthDisplay,
  resolveEdgeDirectionDisplay,
} from '../../domain/edgeValueProvenance'
import { USER_EDGE_DEFAULTS } from '../../domain/edges'

const gates = {
  resolveSignedStrength: (d: unknown) =>
    resolveEdgeSignedStrengthDisplay(d as Record<string, unknown> | undefined),
  resolveDirection: (d: unknown) =>
    resolveEdgeDirectionDisplay(d as Record<string, unknown> | undefined),
  makeId: () => 'intent-1',
}

const run = (data: unknown, over: Record<string, unknown> = {}) =>
  captureStructuralAddEdge({
    edgesAfter: [{ id: 'e1', source: '2891dabb', target: 'c12af5de', data }],
    edgeId: 'e1',
    baseGraphHash: 'aag_v1:abc',
    externalMutationActive: false,
    ...gates,
    ...over,
  })

describe('⛔ a bare drawn link is NOT captured', () => {
  /**
   * ⚠ BOUND TO THE REAL CONSTANT, not to a hand-written copy of it. If someone
   * adds a provenance stamp to `USER_EDGE_DEFAULTS`, this reds — which is
   * exactly the change that would silently start fabricating strengths.
   */
  it('stands down on USER_EDGE_DEFAULTS, naming the reason', () => {
    const r = run({ ...USER_EDGE_DEFAULTS })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('strength_not_stated')
  })

  it('precondition — those defaults really do carry a weight the gate rejects', () => {
    // Pins its own precondition (trap 13b): if the default ever stopped carrying
    // a number, the case above would pass for the wrong reason.
    expect(USER_EDGE_DEFAULTS.weight).toBeGreaterThan(0)
    expect(resolveEdgeSignedStrengthDisplay(USER_EDGE_DEFAULTS as never).show).toBe(false)
  })

  it('stands down when a strength is set but the DIRECTION is not', () => {
    // A stated magnitude with an unstated direction is an edge whose sign cannot
    // be recovered — which the contract excludes by construction.
    const r = run({ weight: 0.6, weightSource: 'user' })
    expect(r.ok).toBe(false)
  })
})

describe('⭐ an edge somebody actually set IS captured', () => {
  const stated = {
    weight: 0.6,
    weightSource: 'user',
    direction: 'negative',
    directionSource: 'user',
  }

  it('captures the magnitude UNSIGNED and the direction separately', () => {
    const r = run(stated)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.intent.magnitude).toBe(0.6)
    expect(r.intent.direction).toBe('negative')
    expect(r.intent.from).toBe('2891dabb')
    expect(r.intent.to).toBe('c12af5de')
  })

  it('DEFERS rather than dropping when no turn has stamped a hash yet', () => {
    // The restored-graph case. `null` is "not yet", never "never" — dropping
    // here would put the connection on the canvas and nothing on the wire.
    const r = run(stated, { baseGraphHash: null })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.deferred).toBe(true)
    expect(r.intent.baseGraphHash).toBeNull()
  })

  it('binds by the edge ID, never by an endpoint scan', () => {
    const r = captureStructuralAddEdge({
      edgesAfter: [
        { id: 'other', source: '2891dabb', target: 'c12af5de', data: stated },
        { id: 'e1', source: 'aaaa1111', target: 'bbbb2222', data: stated },
      ],
      edgeId: 'e1',
      baseGraphHash: 'aag_v1:abc',
      externalMutationActive: false,
      ...gates,
    })
    expect(r.ok).toBe(true)
    // The decoy shares neither endpoint, so a scan would have taken the wrong one.
    if (r.ok) expect(r.intent.from).toBe('aaaa1111')
  })
})

describe('the stand-downs that are not about strength', () => {
  it('refuses a producer mutation — hydration is not a user gesture', () => {
    const r = run({ weight: 0.6, weightSource: 'user', direction: 'positive', directionSource: 'user' }, { externalMutationActive: true })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('external_mutation')
  })

  it('refuses when the edge is not on the canvas', () => {
    const r = run({}, { edgeId: 'missing' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('edge_absent')
  })
})

/**
 * ⭐ ONE RELATIONSHIP NEVER INHERITS ANOTHER'S FRAGILITY FINDING
 * (Codex EARLY_REVIEW, #63 5801910965).
 *
 * `fragileEdgeMatch` fell back to endpoint matching even when the report entry
 * supplied a DIFFERENT `edge_id`. With two parallel causal edges A→B (e1, e2)
 * and one fragile entry naming e1, both edges painted the Standard-view cue and
 * e2 borrowed e1's measured switch probability.
 *
 * The rule: a supplied `edge_id` is exclusive identity. The endpoint pair is a
 * fallback ONLY for an entry that carries no id, and an id-less entry that
 * would match more than one parallel edge is ambiguous, so it is withheld
 * rather than painted on every match.
 */
import { describe, expect, it } from 'vitest'
import {
  getFragileEdgeSwitchProbability,
  isEdgeFragile,
  isTopFragileEdge,
} from '../fragileEdgeMatch'

const E1 = { id: 'e1', source: 'fac_a', target: 'out_b' }
const E2 = { id: 'e2', source: 'fac_a', target: 'out_b' } // parallel to e1
const OTHER = { id: 'e3', source: 'fac_c', target: 'out_b' }

const byId = [{ edge_id: 'e1', from_id: 'fac_a', to_id: 'out_b', switch_probability: 0.62 }]
const idless = [{ from_id: 'fac_a', to_id: 'out_b', switch_probability: 0.62 }]

describe('fragile-edge identity (Codex 5801910965)', () => {
  it('CONTROL — one causal edge, entry by id: exactly that edge is fragile, with its value', () => {
    expect(isEdgeFragile(E1.id, E1.source, E1.target, byId)).toBe(true)
    expect(isTopFragileEdge(E1.id, E1.source, E1.target, byId)).toBe(true)
    expect(getFragileEdgeSwitchProbability(E1.id, E1.source, E1.target, byId)).toBe(0.62)
    expect(isEdgeFragile(OTHER.id, OTHER.source, OTHER.target, byId)).toBe(false)
  })

  it('parallel e1/e2, entry names e1: the cue and value land on e1 ONLY — e2 borrows nothing', () => {
    expect(isTopFragileEdge(E1.id, E1.source, E1.target, byId)).toBe(true)
    expect(isTopFragileEdge(E2.id, E2.source, E2.target, byId)).toBe(false)
    expect(isEdgeFragile(E2.id, E2.source, E2.target, byId)).toBe(false)
    expect(getFragileEdgeSwitchProbability(E2.id, E2.source, E2.target, byId)).toBeNull()
  })

  it('an id-less entry still matches its single edge by endpoints (the fallback survives)', () => {
    expect(isEdgeFragile(E1.id, E1.source, E1.target, idless)).toBe(true)
    expect(getFragileEdgeSwitchProbability(E1.id, E1.source, E1.target, idless)).toBe(0.62)
  })

  it('an id-less entry that would match PARALLEL edges is ambiguous — withheld on both, deterministically', () => {
    const parallel = { parallelEdgeIds: [E1.id, E2.id] }
    expect(isEdgeFragile(E1.id, E1.source, E1.target, idless, parallel)).toBe(false)
    expect(isEdgeFragile(E2.id, E2.source, E2.target, idless, parallel)).toBe(false)
    expect(isTopFragileEdge(E1.id, E1.source, E1.target, idless, parallel)).toBe(false)
    expect(getFragileEdgeSwitchProbability(E2.id, E2.source, E2.target, idless, parallel)).toBeNull()
    // Contrast: the SAME entry with a single matching edge still matches.
    expect(isEdgeFragile(E1.id, E1.source, E1.target, idless, { parallelEdgeIds: [E1.id] })).toBe(true)
  })
})

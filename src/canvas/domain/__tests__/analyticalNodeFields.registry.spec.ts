/**
 * analyticalNodeFields — FAIL-LOUD DRIFT GUARD (trap-12 closure).
 *
 * Two hand-maintained field lists drifted apart and each shipped a data-loss bug
 * the same week: the autosave dirty-gate missed success_threshold/threshold_source
 * (#457, targets not persisted) and the staleness gate missed probability/impact
 * (#453, risk edits didn't stale the analysis). Both now derive from ONE registry
 * (analyticalNodeFields.ts). This guard proves:
 *
 *   1. The registry is well-formed (no dupes, every field noted + purposed).
 *   2. The derived subsets equal the behavioural CONTRACT the two bugs established
 *      — reported as a NAMED-FIELD symmetric diff, never a bare boolean.
 *   3. The two real consumers (hasAnalyticalNodeChange / hasAnalyticalEdgeChange for
 *      'stale'; computeGraphHash for 'persist') actually HONOUR the registry — a
 *      field flagged for a purpose whose consumer ignores it fails RED.
 *   4. POSITIVE CONTROL: the same diff + behavioural machinery goes RED on a
 *      synthetic drift (a dropped field / a cosmetic field), so the green in (2)/(3)
 *      is load-bearing, not vacuous (traps #11, #13).
 */
import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import {
  NODE_FIELD_REGISTRY,
  EDGE_FIELD_REGISTRY,
  deriveFields,
  PERSIST_NODE_FIELDS,
  STALE_NODE_FIELDS,
  PERSIST_EDGE_FIELDS,
  STALE_EDGE_FIELDS,
  type AnalyticalFieldSpec,
} from '../analyticalNodeFields'
import { ANALYTICAL_NODE_DATA_FIELDS, ANALYTICAL_EDGE_FIELDS, hasAnalyticalNodeChange, hasAnalyticalEdgeChange } from '../analyticalChange'
import { computeGraphHash } from '../../hooks/useAutosave'

// ---------------------------------------------------------------------------
// The behavioural CONTRACT — the field sets the two bugs (#453/#457) and the
// current shipped behaviour require. Kept as an EXACT bidirectional lock: a field
// added to or removed from the registry MUST be mirrored here deliberately, which
// is exactly the drift-detection this guard exists to force.
// ---------------------------------------------------------------------------

const EXPECTED_PERSIST_NODE = [
  'observedState', 'interventions', 'is_baseline', 'success_threshold',
  'goal_threshold_raw', 'goal_threshold_unit', 'goal_threshold_cap', 'threshold_source',
]
const EXPECTED_STALE_NODE = [
  'observedState', 'interventions', 'is_baseline', 'success_threshold',
  'goal_threshold_raw', 'prior', 'kind', 'goalThreshold', 'goal_threshold',
  'probability', 'impact',
]
const EXPECTED_PERSIST_EDGE = ['weight', 'direction', 'strengthStd', 'confidence', 'beliefExists']
const EXPECTED_STALE_EDGE = [
  'weight', 'direction', 'strengthStd', 'confidence', 'beliefExists',
  'beliefStrength', 'belief', 'exists_probability',
]

/** Symmetric difference reported as named fields — the guard's failure message. */
function fieldDiff(expected: readonly string[], actual: readonly string[]) {
  const e = new Set(expected)
  const a = new Set(actual)
  return {
    missing: expected.filter((f) => !a.has(f)), // in contract, absent from registry
    extra: actual.filter((f) => !e.has(f)), // in registry, absent from contract
  }
}

const NO_DIFF = { missing: [], extra: [] }

// ---------------------------------------------------------------------------
// 1. Well-formedness
// ---------------------------------------------------------------------------

describe('analyticalNodeFields registry — well-formed', () => {
  for (const [name, registry] of [
    ['node', NODE_FIELD_REGISTRY],
    ['edge', EDGE_FIELD_REGISTRY],
  ] as const) {
    it(`${name}: no duplicate field names`, () => {
      const names = registry.map((f) => f.field)
      expect(names).toHaveLength(new Set(names).size)
    })
    it(`${name}: every field has >=1 purpose and a non-empty note`, () => {
      for (const spec of registry) {
        expect(spec.purposes.length, `${spec.field} has no purpose`).toBeGreaterThan(0)
        expect(spec.note.trim().length, `${spec.field} has no note`).toBeGreaterThan(0)
      }
    })
    it(`${name}: purposes are the known set only`, () => {
      const known = new Set(['persist', 'stale'])
      for (const spec of registry) {
        for (const p of spec.purposes) expect(known.has(p), `${spec.field}: unknown purpose ${p}`).toBe(true)
      }
    })
  }
})

// ---------------------------------------------------------------------------
// 2. Derived subsets == behavioural contract (named-field diff)
// ---------------------------------------------------------------------------

describe('analyticalNodeFields registry — derived subsets match the contract', () => {
  it('node persist subset', () => {
    expect(fieldDiff(EXPECTED_PERSIST_NODE, PERSIST_NODE_FIELDS)).toEqual(NO_DIFF)
  })
  it('node stale subset', () => {
    expect(fieldDiff(EXPECTED_STALE_NODE, STALE_NODE_FIELDS)).toEqual(NO_DIFF)
  })
  it('edge persist subset', () => {
    expect(fieldDiff(EXPECTED_PERSIST_EDGE, PERSIST_EDGE_FIELDS)).toEqual(NO_DIFF)
  })
  it('edge stale subset', () => {
    expect(fieldDiff(EXPECTED_STALE_EDGE, STALE_EDGE_FIELDS)).toEqual(NO_DIFF)
  })

  it('analyticalChange re-exports the registry-derived stale subset (no re-hardcoding)', () => {
    // Proves the staleness call site truly derives from the registry — if someone
    // pastes a literal array back into analyticalChange.ts, this fails.
    expect(ANALYTICAL_NODE_DATA_FIELDS).toEqual(STALE_NODE_FIELDS)
    expect(ANALYTICAL_EDGE_FIELDS).toEqual(STALE_EDGE_FIELDS)
  })
})

// ---------------------------------------------------------------------------
// 3. The real consumers HONOUR the registry (registry ↔ behaviour tie)
// ---------------------------------------------------------------------------

/** A value guaranteed to differ from `undefined`/absent for any field. */
const SENTINEL = { __changed__: true }
const nodeWith = (data: Record<string, unknown>): Node =>
  ({ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data } as Node)
const edgeWith = (data: Record<string, unknown>): Edge =>
  ({ id: 'e1', source: 'a', target: 'b', data } as Edge)

describe('analyticalNodeFields registry — staleness consumer honours every stale field', () => {
  it('hasAnalyticalNodeChange flags a change to each stale node field', () => {
    for (const field of STALE_NODE_FIELDS) {
      const changed = hasAnalyticalNodeChange(nodeWith({}), { data: { [field]: SENTINEL } })
      expect(changed, `stale node field '${field}' not seen by hasAnalyticalNodeChange`).toBe(true)
    }
  })
  it('hasAnalyticalEdgeChange flags a change to each stale edge field', () => {
    for (const field of STALE_EDGE_FIELDS) {
      const changed = hasAnalyticalEdgeChange(edgeWith({}), { data: { [field]: SENTINEL } })
      expect(changed, `stale edge field '${field}' not seen by hasAnalyticalEdgeChange`).toBe(true)
    }
  })
  it('does NOT flag a cosmetic field (proves the probe discriminates — trap #13)', () => {
    // If this were true, the loop above would pass vacuously.
    expect(hasAnalyticalNodeChange(nodeWith({}), { data: { description: 'new copy' } })).toBe(false)
    expect(hasAnalyticalNodeChange(nodeWith({}), { data: { body: 'x' } })).toBe(false)
  })
})

describe('analyticalNodeFields registry — persist consumer honours every persist field', () => {
  it('computeGraphHash flips for a change to each persist node field', () => {
    for (const field of PERSIST_NODE_FIELDS) {
      const before = computeGraphHash([nodeWith({})], [])
      const after = computeGraphHash([nodeWith({ [field]: SENTINEL })], [])
      expect(after, `persist node field '${field}' does not flip computeGraphHash`).not.toBe(before)
    }
  })
  it('computeGraphHash flips for a change to each persist edge field', () => {
    for (const field of PERSIST_EDGE_FIELDS) {
      const before = computeGraphHash([], [edgeWith({})])
      const after = computeGraphHash([], [edgeWith({ [field]: SENTINEL })])
      expect(after, `persist edge field '${field}' does not flip computeGraphHash`).not.toBe(before)
    }
  })
  it('computeGraphHash does NOT flip for a cosmetic node field (proves the probe discriminates)', () => {
    const before = computeGraphHash([nodeWith({})], [])
    const after = computeGraphHash([nodeWith({ description: 'new copy' })], [])
    expect(after).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// 4. POSITIVE CONTROLS — the guard's machinery goes RED on a synthetic drift.
//    (Mutation-proofing: proves 2 & 3 are load-bearing, not vacuous.)
// ---------------------------------------------------------------------------

describe('analyticalNodeFields registry — positive controls (guard catches drift)', () => {
  it('fieldDiff names a field DROPPED from the registry (the #453 regression)', () => {
    // Simulate the exact #453 drift: probability removed from the stale set.
    const drifted = STALE_NODE_FIELDS.filter((f) => f !== 'probability')
    const diff = fieldDiff(EXPECTED_STALE_NODE, drifted)
    expect(diff.missing).toEqual(['probability'])
    expect(diff.extra).toEqual([])
    // And it is NOT equal to NO_DIFF — the assertion in (2) would fail RED.
    expect(diff).not.toEqual(NO_DIFF)
  })

  it('fieldDiff names a field ADDED to the registry but not to the contract', () => {
    const drifted = [...STALE_NODE_FIELDS, 'newlyAddedField']
    const diff = fieldDiff(EXPECTED_STALE_NODE, drifted)
    expect(diff.extra).toEqual(['newlyAddedField'])
    expect(diff).not.toEqual(NO_DIFF)
  })

  it('the behavioural tie catches a stale field NO consumer handles', () => {
    // Simulate a registry field flagged 'stale' that the consumer ignores. The
    // loop in (3) does exactly this check; here we prove that check can fail: a
    // synthetic field absent from ANALYTICAL_NODE_DATA_FIELDS is NOT seen by
    // hasAnalyticalNodeChange, so it would trip the guard RED.
    const synthetic: AnalyticalFieldSpec = { field: 'ghostField', purposes: ['stale'], note: 'x' }
    expect(synthetic.purposes).toContain('stale')
    expect(hasAnalyticalNodeChange(nodeWith({}), { data: { ghostField: SENTINEL } })).toBe(false)
  })

  it('deriveFields partitions by purpose (sanity of the derivation itself)', () => {
    const reg: readonly AnalyticalFieldSpec[] = [
      { field: 'both', purposes: ['persist', 'stale'], note: 'n' },
      { field: 'p', purposes: ['persist'], note: 'n' },
      { field: 's', purposes: ['stale'], note: 'n' },
    ]
    expect(deriveFields(reg, 'persist')).toEqual(['both', 'p'])
    expect(deriveFields(reg, 'stale')).toEqual(['both', 's'])
  })
})

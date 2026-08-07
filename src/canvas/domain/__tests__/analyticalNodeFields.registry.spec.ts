/**
 * analyticalNodeFields — FAIL-LOUD DRIFT GUARD (trap-12 closure).
 *
 * Two hand-maintained field lists drifted apart and each shipped a data-loss bug
 * the same week: the autosave dirty-gate missed success_threshold/threshold_source
 * (#457, targets not persisted) and the staleness gate missed probability/impact
 * (#453, risk edits didn't stale the analysis). Both now derive from ONE registry
 * (analyticalNodeFields.ts).
 *
 * Codex P1-1 inverted the autosave dirty-gate from an ALLOWLIST (`persist`) to a
 * hash-by-default + EPHEMERAL DENYLIST. This guard is updated to the new shape and
 * proves:
 *
 *   1. The registry is well-formed (no dupes, every field noted + purposed, only
 *      the known purposes 'ephemeral'/'stale').
 *   2. The derived subsets equal the behavioural CONTRACT — reported as a
 *      NAMED-FIELD symmetric diff, never a bare boolean. Now includes the ephemeral
 *      denylist (deny direction).
 *   3. The two real consumers HONOUR the registry:
 *        • 'stale'     → hasAnalyticalNodeChange / hasAnalyticalEdgeChange flag every
 *                        stale field.
 *        • 'ephemeral' → computeGraphHash does NOT flip for any ephemeral field,
 *                        AND flips for a non-ephemeral field (hash-by-default).
 *      Plus the DENY-DIRECTION SAFETY assertion: no field a live editor writes as
 *      persistent state may appear on the ephemeral denylist (a wrongly-denylisted
 *      persistent field = silent reload loss — this fails the guard RED).
 *   4. POSITIVE CONTROLS: the diff + behavioural machinery goes RED on a synthetic
 *      drift, so the green in (2)/(3) is load-bearing, not vacuous (traps #11, #13).
 */
import { describe, it, expect } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import {
  NODE_FIELD_REGISTRY,
  EDGE_FIELD_REGISTRY,
  deriveFields,
  EPHEMERAL_NODE_FIELDS,
  STALE_NODE_FIELDS,
  EPHEMERAL_EDGE_FIELDS,
  STALE_EDGE_FIELDS,
  type AnalyticalFieldSpec,
} from '../analyticalNodeFields'
import { ANALYTICAL_NODE_DATA_FIELDS, ANALYTICAL_EDGE_FIELDS, hasAnalyticalNodeChange, hasAnalyticalEdgeChange } from '../analyticalChange'
import { computeGraphHash } from '../../hooks/useAutosave'
import { EDITOR_WRITTEN_FIELDS } from '../../ui/inspector-v2/useInspectorMutations'

// ---------------------------------------------------------------------------
// The behavioural CONTRACT — the field sets the two bugs (#453/#457), task #23,
// and Codex P1-1/P1-2 require. Kept as an EXACT bidirectional lock: a field added
// to or removed from the registry MUST be mirrored here deliberately, which is
// exactly the drift-detection this guard exists to force.
// ---------------------------------------------------------------------------

// EPHEMERAL = the autosave-hash DENYLIST. Everything else on node/edge data is
// persisted by default (hash-by-default), so this list is intentionally tiny.
const EXPECTED_EPHEMERAL_NODE = ['goalThreshold', 'goal_threshold', '_baseline_snapshot']
const EXPECTED_EPHEMERAL_EDGE: string[] = []

const EXPECTED_STALE_NODE = [
  'observedState', 'interventions', 'is_baseline', 'success_threshold',
  'goal_threshold_raw', 'goal_threshold_cap', 'prior', 'kind', 'goalThreshold',
  'goal_threshold', 'probability', 'impact',
]
const EXPECTED_STALE_EDGE = [
  'weight', 'direction', 'strengthStd', 'confidence', 'beliefExists',
  'beliefStrength', 'belief', 'exists_probability',
]

// Fields a LIVE user editor writes as persistent state. None may ever appear on the
// ephemeral denylist — a denylisted persistent field is silently dropped on reload
// (the exact #457 loss class). See "deny-direction safety" below.
//
// The inspector-hook portion is DERIVED from EDITOR_WRITTEN_FIELDS (declared beside
// the setters in useInspectorMutations.ts, behaviourally pinned by
// useInspectorMutations.writtenFields.spec.tsx) — NOT re-typed here. The old
// hand-list silently OMITTED edge `label`, so denylisting `label` left this guard
// green (Codex P2); deriving from the setters closes that.
//
// Fields written by editors OUTSIDE the inspector hook stay as a small residual
// list, each annotated with its write site. (Follow-up: centralise these editors
// behind the same manifest so this residual can go too.)
const NON_INSPECTOR_PERSIST_NODE_FIELDS = [
  'is_baseline',        // OutputsDock baseline toggle, useAddBaseline, applyDraftResult
  'success_threshold',  // store.ts setGoalThreshold action, model-tab GoalSection
  'threshold_source',   // store.ts setGoalThreshold action, model-tab GoalSection
]
const NON_INSPECTOR_PERSIST_EDGE_FIELDS = [
  'confidence',         // useModelActionApply (model-action apply path)
]
const KNOWN_EDITOR_PERSIST_NODE_FIELDS = [
  ...EDITOR_WRITTEN_FIELDS.node,
  ...NON_INSPECTOR_PERSIST_NODE_FIELDS,
]
const KNOWN_EDITOR_PERSIST_EDGE_FIELDS = [
  ...EDITOR_WRITTEN_FIELDS.edge,
  ...NON_INSPECTOR_PERSIST_EDGE_FIELDS,
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
      const known = new Set(['ephemeral', 'stale'])
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
  it('node ephemeral denylist', () => {
    expect(fieldDiff(EXPECTED_EPHEMERAL_NODE, EPHEMERAL_NODE_FIELDS)).toEqual(NO_DIFF)
  })
  it('node stale subset', () => {
    expect(fieldDiff(EXPECTED_STALE_NODE, STALE_NODE_FIELDS)).toEqual(NO_DIFF)
  })
  it('edge ephemeral denylist (empty today)', () => {
    expect(fieldDiff(EXPECTED_EPHEMERAL_EDGE, EPHEMERAL_EDGE_FIELDS)).toEqual(NO_DIFF)
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
  it('does NOT flag a cosmetic field for staleness (proves the probe discriminates — trap #13)', () => {
    // description/body are persisted (hash-by-default) but are NOT analysis-affecting,
    // so they must not stale. If they did, the loop above could pass vacuously.
    expect(hasAnalyticalNodeChange(nodeWith({}), { data: { description: 'new copy' } })).toBe(false)
    expect(hasAnalyticalNodeChange(nodeWith({}), { data: { body: 'x' } })).toBe(false)
  })
})

describe('analyticalNodeFields registry — autosave hash honours the ephemeral denylist (hash-by-default)', () => {
  it('computeGraphHash does NOT flip for a change to any ephemeral node field', () => {
    for (const field of EPHEMERAL_NODE_FIELDS) {
      const before = computeGraphHash([nodeWith({})], [])
      const after = computeGraphHash([nodeWith({ [field]: SENTINEL })], [])
      expect(after, `ephemeral node field '${field}' wrongly flips computeGraphHash`).toBe(before)
    }
  })
  it('computeGraphHash does NOT flip for a change to any ephemeral edge field', () => {
    for (const field of EPHEMERAL_EDGE_FIELDS) {
      const before = computeGraphHash([], [edgeWith({})])
      const after = computeGraphHash([], [edgeWith({ [field]: SENTINEL })])
      expect(after, `ephemeral edge field '${field}' wrongly flips computeGraphHash`).toBe(before)
    }
  })
  it('computeGraphHash FLIPS for a non-ephemeral node data field (hash-by-default)', () => {
    // description is NOT on the denylist → it is persisted, so it MUST flip the hash.
    // This is the exact behaviour the old persist-allowlist suppressed (the defect).
    const before = computeGraphHash([nodeWith({})], [])
    const after = computeGraphHash([nodeWith({ description: 'new copy' })], [])
    expect(after).not.toBe(before)
  })
  it('computeGraphHash FLIPS for every stale node field (they are all persisted too)', () => {
    for (const field of STALE_NODE_FIELDS) {
      if (EPHEMERAL_NODE_FIELDS.includes(field)) continue // stale+ephemeral derived caches
      const before = computeGraphHash([nodeWith({})], [])
      const after = computeGraphHash([nodeWith({ [field]: SENTINEL })], [])
      expect(after, `stale node field '${field}' does not flip computeGraphHash`).not.toBe(before)
    }
  })

  // DENY-DIRECTION SAFETY (Codex P1-1): a field a live editor writes as persistent
  // state must NEVER be on the ephemeral denylist. If it were, an edit touching only
  // that field would be silently lost on reload — the #457 class this fix removes.
  it('no live-editor persistent NODE field is denylisted', () => {
    const wronglyDenied = KNOWN_EDITOR_PERSIST_NODE_FIELDS.filter((f) => EPHEMERAL_NODE_FIELDS.includes(f))
    expect(wronglyDenied, `persistent editor field(s) wrongly on the ephemeral denylist: ${wronglyDenied.join(', ')}`).toEqual([])
  })
  it('no live-editor persistent EDGE field is denylisted', () => {
    const wronglyDenied = KNOWN_EDITOR_PERSIST_EDGE_FIELDS.filter((f) => EPHEMERAL_EDGE_FIELDS.includes(f))
    expect(wronglyDenied, `persistent editor field(s) wrongly on the ephemeral denylist: ${wronglyDenied.join(', ')}`).toEqual([])
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
    expect(diff).not.toEqual(NO_DIFF)
  })

  it('fieldDiff names a field ADDED to the ephemeral denylist but not to the contract', () => {
    const drifted = [...EPHEMERAL_NODE_FIELDS, 'newlyDeniedField']
    const diff = fieldDiff(EXPECTED_EPHEMERAL_NODE, drifted)
    expect(diff.extra).toEqual(['newlyDeniedField'])
    expect(diff).not.toEqual(NO_DIFF)
  })

  it('the deny-direction safety catches a persistent field wrongly denylisted', () => {
    // Simulate someone denylisting success_threshold (a user target — the #457 field).
    const drifted = [...EPHEMERAL_NODE_FIELDS, 'success_threshold']
    const wronglyDenied = KNOWN_EDITOR_PERSIST_NODE_FIELDS.filter((f) => drifted.includes(f))
    expect(wronglyDenied).toEqual(['success_threshold'])
    expect(wronglyDenied).not.toEqual([])
  })

  it('the deny-direction safety catches edge `label` wrongly denylisted (Codex P2 probe)', () => {
    // setLabel (useInspectorMutations) writes edge.data.label — a persistent editor
    // field. Denylisting it would silently drop relabels on reload. Pre-fix the edge
    // persist list omitted `label`, so this exact probe stayed GREEN; now that the
    // list DERIVES from EDITOR_WRITTEN_FIELDS.edge (which includes `label`), it bites.
    expect(KNOWN_EDITOR_PERSIST_EDGE_FIELDS).toContain('label')
    const drifted = [...EPHEMERAL_EDGE_FIELDS, 'label']
    const wronglyDenied = KNOWN_EDITOR_PERSIST_EDGE_FIELDS.filter((f) => drifted.includes(f))
    expect(wronglyDenied).toEqual(['label'])
    expect(wronglyDenied).not.toEqual([])
  })

  it('the hash behavioural tie catches an ephemeral field computeGraphHash still hashes', () => {
    // If a "denylisted" field were NOT actually excluded by serializableData, its
    // change would flip the hash. Proves the tie in (3) can fail: a NON-denylisted
    // field flips, so if an ephemeral field flipped it would trip the guard RED.
    const before = computeGraphHash([nodeWith({})], [])
    const after = computeGraphHash([nodeWith({ notDenylisted: SENTINEL })], [])
    expect(after).not.toBe(before)
  })

  it('deriveFields partitions by purpose (sanity of the derivation itself)', () => {
    const reg: readonly AnalyticalFieldSpec[] = [
      { field: 'both', purposes: ['ephemeral', 'stale'], note: 'n' },
      { field: 'e', purposes: ['ephemeral'], note: 'n' },
      { field: 's', purposes: ['stale'], note: 'n' },
    ]
    expect(deriveFields(reg, 'ephemeral')).toEqual(['both', 'e'])
    expect(deriveFields(reg, 'stale')).toEqual(['both', 's'])
  })
})

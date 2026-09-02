/**
 * `adaptStructuralAdd` — fail-closed at the wire boundary.
 *
 * ⚠ WHY THE RULES ARE RE-APPLIED HERE RATHER THAN TRUSTED FROM THE CALLER.
 * `StructuralAddEvent` is `.strict()` inside a `discriminatedUnion` on `kind`,
 * so a malformed field does not lose the FIELD — it fails the union and loses
 * the WHOLE TURN at CEE's ingress with a 422. A stand-down costs one gesture; a
 * 422 costs the user's message as well.
 *
 * ⭐ THE ID PREDICATE IS NARROWER HERE THAN ON ITS SIBLINGS, AND BOTH DIRECTIONS
 * OF THAT ASYMMETRY ARE WRONG TO COPY. `structural_add` MINTS an id and
 * validates it against `NodeV3Schema.shape.id` (`/^[a-z0-9_:-]+$/`, max 100),
 * because an id failing that pattern is one CEE cannot persist into GraphV3.
 * `structural_rename` addresses an EXISTING id and uses the OPEN
 * `CanonicalEdgeEndpointIdSchema`, because narrowing it "would refuse live
 * nodes". Narrow the rename and you refuse real nodes; widen the add and you
 * mint an id CEE cannot store. The two predicates are named apart on purpose.
 */

import { describe, it, expect } from 'vitest'
import { buildV5Payload } from '../buildPayload'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'
const HASH = 'f3d31f75957c5cb5'

function build(payload: Record<string, unknown>) {
  return buildV5Payload({
    turnId: TURN_ID,
    scenarioId: SCENARIO_ID,
    stage: 'analyse',
    turnClass: 'edit_graph',
    mode: 'system',
    systemEvent: { type: 'structural_add', payload },
  } as never)
}

const VALID = {
  node_id: 'fac_supplier_risk',
  node_kind: 'factor',
  label: 'Supplier concentration risk',
  base_graph_hash: HASH,
}

describe('adaptStructuralAdd — the accepted shape', () => {
  it('⭐ emits EXACTLY the contract member, and no fifth key', () => {
    const r = build(VALID)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.payload.kind).toBe('system_event')
    const event = (r.payload as { event: Record<string, unknown> }).event
    // ⚠ THE KEY SET, not spot checks. The member is `.strict()`, so an extra key
    // does not get dropped — it 422s the turn. And an extra VALUE key would be
    // the fabrication this whole lane exists to prevent.
    expect(Object.keys(event).sort()).toEqual([
      'base_graph_hash',
      'kind',
      'label',
      'node_id',
      'node_kind',
    ])
    expect(event).toEqual({ kind: 'structural_add', ...VALID })
  })

  it('accepts every kind CEE can persist, and refuses the one it cannot', () => {
    for (const kind of ['goal', 'factor', 'outcome', 'risk', 'action', 'decision', 'option']) {
      expect(build({ ...VALID, node_kind: kind }).ok, `kind "${kind}"`).toBe(true)
    }
    // `constraint` is a VALID wire value that clears CEE's ingress and dies at
    // its writer with a COMMITTED 200: a turn spent, a commit performed, no node
    // written. Refusing here costs nothing and says something true.
    expect(build({ ...VALID, node_kind: 'constraint' }).ok).toBe(false)
    // And a kind outside the enum entirely.
    expect(build({ ...VALID, node_kind: 'sandwich' }).ok).toBe(false)
  })
})

describe('adaptStructuralAdd — every refusal has its accepting twin', () => {
  it('TWIN — an absent/empty base hash refuses; a present one passes', () => {
    expect(build({ ...VALID, base_graph_hash: undefined }).ok).toBe(false)
    expect(build({ ...VALID, base_graph_hash: '' }).ok).toBe(false)
    expect(build({ ...VALID, base_graph_hash: null }).ok).toBe(false)
    expect(build(VALID).ok).toBe(true)
  })

  it('⭐ TWIN — a NON-MINTABLE id refuses; the ids the UI actually mints pass', () => {
    // Each of these 422s the WHOLE turn if it reaches the wire.
    for (const bad of ['Fac_Upper', 'fac.dotted', 'fac spaced', '', 'x'.repeat(101), 'a→b']) {
      expect(build({ ...VALID, node_id: bad }).ok, `id "${bad}" must refuse`).toBe(false)
    }
    // `createNodeId()` returns `String(nextNodeId)`.
    for (const good of ['7', 'fac_supplier_risk', 'opt:a-1', 'x'.repeat(100)]) {
      expect(build({ ...VALID, node_id: good }).ok, `id "${good}" must pass`).toBe(true)
    }
  })

  it('TWIN — a label outside `min(1).max(200)` refuses; one at the bound passes', () => {
    expect(build({ ...VALID, label: '' }).ok).toBe(false)
    expect(build({ ...VALID, label: 'x'.repeat(201) }).ok).toBe(false)
    // Exactly at the bound is INSIDE it — an off-by-one here silently refuses a
    // legal label and the user never learns why.
    expect(build({ ...VALID, label: 'x'.repeat(200) }).ok).toBe(true)
  })

  it('a refusal routes to `unsupported_system_event` — no turn at all, never a hollow one', () => {
    const r = build({ ...VALID, node_id: 'BAD' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    // An unsendable add must not become a turn that claims something happened.
    expect(r.reason).toBe('unsupported_system_event')
  })
})

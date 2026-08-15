/**
 * SELECTION RIDES THE WIRE — the click path, bound by identity.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * A user pointing at a node and asking "why does this matter?" got an answer
 * that never knew which node they meant. The selection lived in
 * `useCanvasStore.selection` and stopped there: `buildV5Payload` — the SOLE
 * live V5 outbound builder — read no selection of any name, and the only UI
 * code that ever emitted `selected_elements` was the V4 request builder, which
 * posts to the 410'd v1 route and is unreachable under the deployed
 * `VITE_ENABLE_V5_ORCHESTRATOR="true"` bake. Verified on the wire
 * (`olumi-docs/PHASE0-EVIDENCE-2026-07-28/selection-aware-ai-2026-08-14/`):
 * one node demonstrably selected at send time, 215-byte turn body, no
 * `selected_elements`.
 *
 * ── WHAT THIS FILE BINDS TO ───────────────────────────────────────────────
 * The tests drive the REAL store through React Flow's REAL selection callback
 * (`onSelectionChange`), not a hand-made selection object. That matters twice
 * over:
 *   · trap 3b — a test bound to a surface the deployed flags do not mount
 *     proves nothing; `onSelectionChange` is the path the mounted canvas uses;
 *   · trap 19 — every assertion binds to the node's EXACT ID, and the
 *     discriminating pair below proves the payload follows the selection
 *     rather than merely containing "some node".
 *
 * ── AND WHAT IT DELIBERATELY DOES NOT CLAIM ───────────────────────────────
 * This is a UNIT-seam witness: it proves the id leaves the builder on the wire
 * payload. It says nothing about CEE consuming it — at the pin in
 * package.json, CEE's ingress mirror still parses the V4-era
 * `{node_ids, edge_ids}` shape and drops an array-of-refs silently. That is
 * hop 3, a separate PR in a separate repo. Recorded here so a later reader
 * cannot mistake a green file for a live capability.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { Node } from '@xyflow/react'
import { MessageTurnPayloadSchema, OrchestratorTurnPayloadSchema } from '@talchain/schemas/boundary'

import { buildV5Payload, MAX_SELECTED_ELEMENTS } from '../buildPayload'
import { useCanvasStore } from '../../canvas/store'
import type { NodeData } from '../../canvas/domain/nodes'

const TURN_ID = '11111111-1111-4111-8111-111111111111'
const SCENARIO_ID = '22222222-2222-4222-8222-222222222222'

function node(id: string, type: string, label: string): Node<NodeData> {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { label, type } as unknown as NodeData,
  } as Node<NodeData>
}

const PRICE = node('factor_price', 'factor', 'Price sensitivity')
const CHURN = node('factor_churn', 'factor', 'Churn rate')
const BUILD_IT = node('option_build', 'option', 'Build in-house')

const GRAPH = [PRICE, CHURN, BUILD_IT]

/** The real React-Flow-driven selection path, exactly as the canvas uses it. */
function selectOnCanvas(nodes: readonly Node<NodeData>[]): void {
  useCanvasStore.getState().onSelectionChange({
    nodes: nodes as never,
    edges: [],
  } as never)
}

/**
 * PRECONDITION PIN (trap 13b). Every absence assertion below is vacuous if the
 * fixture silently failed to select anything, so the selection is asserted from
 * the store — the same state the builder reads — before the payload is built.
 */
function assertStoreSelection(expected: readonly string[]): void {
  const actual = [...useCanvasStore.getState().selection.nodeIds]
  expect(actual.sort()).toEqual([...expected].sort())
}

function messagePayload(message = 'Why does this one matter?') {
  const r = buildV5Payload({
    turnId: TURN_ID,
    scenarioId: SCENARIO_ID,
    stage: 'analyse',
    turnClass: 'clarify',
    mode: 'user',
    message,
  })
  if (!r.ok) throw new Error(`expected ok; got ${r.reason} ${r.detail ?? ''}`)
  return r.payload as Extract<typeof r.payload, { kind: 'message' }>
}

beforeEach(() => {
  useCanvasStore.setState({
    nodes: GRAPH as never,
    edges: [],
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
  })
})

describe('selection carriage — the selected node rides the turn payload', () => {
  it('click path: the exact selected node id reaches the wire payload', () => {
    selectOnCanvas([PRICE])
    assertStoreSelection(['factor_price'])

    const payload = messagePayload()

    expect(payload.selected_elements).toEqual([
      { id: 'factor_price', kind: 'factor', label: 'Price sensitivity' },
    ])
  })

  it('DISCRIMINATING PAIR: selecting a different node changes the id on the wire', () => {
    // Same graph, same message, same everything except which node is selected.
    // If the builder emitted "some node" rather than "the selected node", these
    // two would agree and both assertions would still pass individually.
    selectOnCanvas([PRICE])
    assertStoreSelection(['factor_price'])
    const first = messagePayload().selected_elements

    selectOnCanvas([BUILD_IT])
    assertStoreSelection(['option_build'])
    const second = messagePayload().selected_elements

    expect(first).toEqual([{ id: 'factor_price', kind: 'factor', label: 'Price sensitivity' }])
    expect(second).toEqual([{ id: 'option_build', kind: 'option', label: 'Build in-house' }])
    expect(first).not.toEqual(second)
  })

  it('multi-select carries every selected node, in stable graph order', () => {
    selectOnCanvas([BUILD_IT, PRICE])
    assertStoreSelection(['factor_price', 'option_build'])

    // Graph order (PRICE, CHURN, BUILD_IT) — NOT the order the caller listed
    // them in, so the payload is a pure function of the selection SET.
    expect(messagePayload().selected_elements?.map((e) => e.id)).toEqual([
      'factor_price',
      'option_build',
    ])
  })

  it('empty selection omits the field entirely — absence, never an empty array', () => {
    assertStoreSelection([])
    const payload = messagePayload()
    expect(payload.selected_elements).toBeUndefined()
    expect('selected_elements' in payload).toBe(false)
  })

  it('the built payload still satisfies the strict published contract', () => {
    selectOnCanvas([PRICE])
    assertStoreSelection(['factor_price'])
    const payload = messagePayload()
    // MessageTurnPayloadSchema is .strict(): a wrongly-shaped or wrongly-named
    // selection field fails HERE rather than as a 422 on a user's turn.
    expect(() => OrchestratorTurnPayloadSchema.parse(payload)).not.toThrow()
  })
})

describe('selection carriage — the refusals, each for a stated reason', () => {
  it('a selected id with no node in the graph is dropped, never fabricated', () => {
    // Stale selection (node deleted underneath it). There is no label and no
    // kind to state truthfully, and `kind` is REQUIRED by the contract, so the
    // only honest options are "omit" or "invent". Omit.
    useCanvasStore.setState({
      selection: {
        nodeIds: new Set(['ghost_node']),
        edgeIds: new Set<string>(),
        anchorPosition: null,
      },
    })
    assertStoreSelection(['ghost_node'])
    expect(messagePayload().selected_elements).toBeUndefined()
  })

  it('a selection larger than the contract cap omits the field rather than truncating', () => {
    // The contract caps `selected_elements` at 20. Sending 20 of 34 would be a
    // FALSE statement about what the user selected — CEE would ground an answer
    // in a selection that never existed. Absence says nothing; a truncation
    // says something wrong.
    const many = Array.from({ length: 34 }, (_, i) => node(`f_${i}`, 'factor', `Factor ${i}`))
    useCanvasStore.setState({ nodes: many as never })
    selectOnCanvas(many)
    expect(useCanvasStore.getState().selection.nodeIds.size).toBe(34)

    expect(messagePayload().selected_elements).toBeUndefined()
  })

  it('exactly the cap (20) is carried — the boundary is inclusive, as the contract declares', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => node(`f_${i}`, 'factor', `Factor ${i}`))
    useCanvasStore.setState({ nodes: twenty as never })
    selectOnCanvas(twenty)
    expect(useCanvasStore.getState().selection.nodeIds.size).toBe(20)

    const payload = messagePayload()
    expect(payload.selected_elements).toHaveLength(20)
    expect(() => OrchestratorTurnPayloadSchema.parse(payload)).not.toThrow()
  })

  it('a stale edge-only selection carries nothing — no live endpoints are invented', () => {
    // The fixture has no edges, so this UI-local id cannot resolve to a live
    // relationship. Absence is truthful; borrowing another edge is not.
    useCanvasStore.setState({
      selection: {
        nodeIds: new Set<string>(),
        edgeIds: new Set(['edge_a']),
        anchorPosition: null,
      },
    })
    expect(useCanvasStore.getState().selection.edgeIds.size).toBe(1)
    expect(messagePayload().selected_elements).toBeUndefined()
  })

  it('system-event turns never carry selection — the contract has no such field on them', () => {
    selectOnCanvas([PRICE])
    assertStoreSelection(['factor_price'])

    const r = buildV5Payload({
      turnId: TURN_ID,
      scenarioId: SCENARIO_ID,
      stage: 'analyse',
      turnClass: 'clarify',
      mode: 'system',
      systemEvent: { type: 'patch_accepted', payload: { patch_id: 'p1' } } as never,
    })
    if (!r.ok) throw new Error(`expected ok; got ${r.reason}`)
    expect(r.payload.kind).toBe('system_event')
    expect('selected_elements' in r.payload).toBe(false)
    expect(() => OrchestratorTurnPayloadSchema.parse(r.payload)).not.toThrow()
  })
})

/**
 * DERIVED CARRIAGE GUARD (trap 12), the sibling of
 * `factorValueEditWireCarriage.spec.ts`. The ref this builder emits is a
 * HAND-MAINTAINED MIRROR of `SelectedElementRefSchema`. That is exactly how
 * `applied_from` shipped dark: the contract grew a member, the mirror did not,
 * and nothing anywhere went red. So the expectation is read off the published
 * Zod schema at the pin, never from a list in this file.
 *
 * ⚠ A derived guard proves AGREEMENT, never COMPLETENESS (trap 12d). It cannot
 * notice that the CONTRACT lacks a field the product needs. The corpus that
 * covers the other face is the click-path suite above.
 */
describe('selection carriage — the ref shape is derived from the contract, not mirrored', () => {
  /**
   * Ref fields the builder is allowed NOT to carry.
   *
   * ⚠ A CONFESSION, NOT A CONVENIENCE. Every entry is a field the wire declares
   * and the client deliberately withholds, and each needs a reason a reviewer
   * can check. EMPTY today.
   */
  const DELIBERATELY_NOT_CARRIED: Readonly<Record<string, string>> = Object.freeze({})

  function contractRefKeys(): string[] {
    // `MessageTurnPayloadSchema` is the union member itself. Walking down from
    // `OrchestratorTurnPayloadSchema` is NOT an option here: the root is wrapped
    // in `.superRefine`, i.e. a ZodEffects, so `_def.options` is absent and the
    // walk reads `undefined` — which is precisely the shape a guard silently
    // measuring nothing takes. The union's acceptance of the built payload is
    // proved separately, by the strict round-trip cases above.
    const field = (
      MessageTurnPayloadSchema as never as { shape: Record<string, unknown> }
    ).shape['selected_elements'] as
      | { _def?: { innerType?: { _def?: { type?: { shape?: Record<string, unknown> } } } } }
      | undefined
    // optional( array( object ) ) — unwrap to the element object's shape.
    const element = field?._def?.innerType?._def?.type
    const shape = element?.shape
    if (shape === undefined) {
      throw new Error(
        'could not reach SelectedElementRefSchema through ' +
          'MessageTurnPayloadSchema.selected_elements — the contract shape changed and this ' +
          'guard is measuring nothing',
      )
    }
    return Object.keys(shape)
  }

  it('the guard can actually reach the contract (positive control)', () => {
    // Without this, every assertion below could pass on an empty key list.
    const keys = contractRefKeys()
    expect(keys.length).toBeGreaterThan(0)
    expect(keys).toContain('id')
  })

  it('every field the contract declares on a selected-element ref is carried', () => {
    selectOnCanvas([PRICE])
    assertStoreSelection(['factor_price'])
    const ref = messagePayload().selected_elements?.[0]
    expect(ref).toBeDefined()

    const missing = contractRefKeys().filter(
      (k) => !(k in (ref as Record<string, unknown>)) && !(k in DELIBERATELY_NOT_CARRIED),
    )
    expect(missing).toEqual([])
  })

  it("the builder's cap is the contract's cap — derived, not taken on trust", () => {
    // `MAX_SELECTED_ELEMENTS` is a literal in the send path (deliberately: the
    // alternative binds production sends to zod's private internals). This is
    // the guard that stops it drifting from the contract it mirrors.
    const field = (
      MessageTurnPayloadSchema as never as { shape: Record<string, unknown> }
    ).shape['selected_elements'] as
      | { _def?: { innerType?: { _def?: { maxLength?: { value?: number } } } } }
      | undefined
    const contractMax = field?._def?.innerType?._def?.maxLength?.value
    expect(typeof contractMax).toBe('number') // positive control: the walk landed
    expect(MAX_SELECTED_ELEMENTS).toBe(contractMax)
  })

  it('nothing beyond the contract is smuggled onto the ref', () => {
    selectOnCanvas([PRICE])
    const ref = messagePayload().selected_elements?.[0] as Record<string, unknown>
    // SelectedElementRefSchema is .strict(); an extra key 422s the whole turn.
    expect(Object.keys(ref).sort()).toEqual(contractRefKeys().sort())
  })
})

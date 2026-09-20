/**
 * useInspectorMutations — EDITOR_WRITTEN_FIELDS drift guard (Codex P2 root fix).
 *
 * The deny-direction guard in analyticalNodeFields.registry.spec.ts used to
 * hand-list "fields live editors write". That mirror drifted and OMITTED edge
 * `label` (setLabel writes edge.data.label), so `label` could be added to the
 * ephemeral denylist with the deny-direction guard staying GREEN — a silent
 * reload-loss class. The manifest now lives beside the setters
 * (NODE_SETTER_FIELDS / EDGE_SETTER_FIELDS → EDITOR_WRITTEN_FIELDS) and the guard
 * imports it. This spec is what makes the manifest UNABLE to drift from the code:
 *
 *   1. The setter names the hook returns EQUAL the manifest keys — a setter added
 *      or removed without updating the manifest fails RED.
 *   2. Each setter, when driven, writes EXACTLY the top-level `data` field(s) the
 *      manifest declares for it — a setter that starts writing a new/renamed field
 *      fails RED. This is a behavioural capture (the setters are executed), not a
 *      second hand-list.
 *   3. POSITIVE CONTROLS prove the capture can SEE a field (trap #13) and that
 *      edge `label` is genuinely captured (the omitted field).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  useNodeMutations,
  useEdgeMutations,
  NODE_SETTER_FIELDS,
  EDGE_SETTER_FIELDS,
  EDITOR_WRITTEN_FIELDS,
} from '../useInspectorMutations'
import { useCanvasStore } from '../../../store'

// Spies swapped into the real store so getNode/getEdge still resolve while we
// capture exactly what each setter writes.
const updateNode = vi.fn()
const updateEdge = vi.fn()

const NODE = { id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: {} }
const EDGE = { id: 'e1', source: 'a', target: 'b', data: {} }

beforeEach(() => {
  updateNode.mockClear()
  updateEdge.mockClear()
  useCanvasStore.setState(
    { nodes: [NODE], edges: [EDGE], updateNode, updateEdge } as never,
    false,
  )
})

/** Valid sample args for each node setter (enough to make the setter write). */
const NODE_SETTER_ARGS: Record<string, unknown[]> = {
  setLabel: ['A new label'],
  setDescription: ['A new description'],
  setThreshold: [42, 'percent'],
  setObservedValue: [1],
  setIntervention: ['factor-x', 1],
  removeIntervention: ['factor-x'],
  setPriorRange: [0, 1],
  setObservedRawValue: [1],
  setObservedUnit: ['kg'],
  setObservedCap: [1],
  setObservedBaseline: [1],
  setObservedStd: [1],
  setObservedSource: ['user'],
  setCategory: ['external'],
  setExtractionType: ['explicit'],
  setFactorType: ['lever'],
  setStateSpaceRange: [0, 1],
  setUncertaintyDrivers: [['driver-a']],
  setGoalCap: [1],
  setProbability: [0.5],
  setImpact: ['high'],
}

const EDGE_SETTER_ARGS: Record<string, unknown[]> = {
  // ⛔ THE SECOND ARGUMENT IS REQUIRED, AND THIS TABLE IS WHY IT NEEDS SAYING.
  // `setStrength` now demands a settlement handler so no carrier can swallow a
  // send (four did). This harness casts the setters to
  // `Record<string, (...a: unknown[]) => void>`, so TYPESCRIPT NEVER SEES THESE
  // CALLS — the cast is what makes the manifest guard generic, and it is also
  // what let a one-argument call through the typecheck and into a shard.
  // A no-op is correct HERE specifically: this test drives setters to observe
  // which `data` fields they write, and asserts nothing about settlement.
  setStrength: [0.5, { onSendSettled: () => {} }],
  setStd: [0.1],
  setExistsProbability: [0.8],
  setLabel: ['edge label'],
  setDirection: ['positive'],
}

/**
 * Members of `useEdgeMutations` that are NOT setters — they write no `data`
 * field at all.
 *
 * ⛔ THIS LIST IS NOT AN EXEMPTION, AND THE DIFFERENCE IS THE WHOLE POINT. A
 * name here is a CLAIM that the member writes nothing, and the test below
 * DRIVES it and proves that claim. An exemption would let a real setter hide by
 * being listed; a driven claim cannot. `EDGE_SETTER_FIELDS` deliberately has no
 * row for these: every name in that map must have a row in `@talchain/schemas`'
 * EDITABLE FIELD table (`editableFieldTable.pinAndParity.spec.ts`), and
 * confirming the server's own estimate edits no field.
 */
const EDGE_NON_WRITERS: Record<string, unknown[]> = {
  confirmCurrentStrength: [],
}

/** Drive one setter and return the top-level data keys it wrote. */
function keysWrittenBy(fn: (...a: unknown[]) => void, args: unknown[], spy: typeof updateNode): string[] {
  spy.mockClear()
  act(() => {
    fn(...args)
  })
  const written = new Set<string>()
  for (const call of spy.mock.calls) {
    const data = (call[1] as { data?: Record<string, unknown> })?.data
    if (data) for (const k of Object.keys(data)) written.add(k)
  }
  return [...written]
}

describe('useInspectorMutations — EDITOR_WRITTEN_FIELDS cannot drift from the setters', () => {
  it('NODE: the setter names the hook returns equal the manifest keys', () => {
    const { result } = renderHook(() => useNodeMutations('n1'))
    const returned = Object.keys(result.current).sort()
    const declared = Object.keys(NODE_SETTER_FIELDS).sort()
    expect(returned).toEqual(declared)
  })

  it('EDGE: the setter names the hook returns equal the manifest keys', () => {
    const { result } = renderHook(() => useEdgeMutations('e1'))
    const returned = Object.keys(result.current).sort()
    // Every returned member must be CLASSIFIED — a setter with declared fields,
    // or a proven non-writer. A new member can be neither, which is what keeps
    // this guard exhaustive over the surface rather than over one half of it.
    const declared = [
      ...Object.keys(EDGE_SETTER_FIELDS),
      ...Object.keys(EDGE_NON_WRITERS),
    ].sort()
    expect(returned).toEqual(declared)
  })

  it('NODE: each setter writes exactly the data field(s) the manifest declares', () => {
    const { result } = renderHook(() => useNodeMutations('n1'))
    const setters = result.current as unknown as Record<string, (...a: unknown[]) => void>
    for (const [name, expected] of Object.entries(NODE_SETTER_FIELDS)) {
      const written = keysWrittenBy(setters[name], NODE_SETTER_ARGS[name], updateNode).sort()
      expect(written, `setter '${name}' wrote unexpected data fields`).toEqual([...expected].sort())
    }
  })

  it('EDGE: each setter writes exactly the data field(s) the manifest declares', () => {
    const { result } = renderHook(() => useEdgeMutations('e1'))
    const setters = result.current as unknown as Record<string, (...a: unknown[]) => void>
    for (const [name, expected] of Object.entries(EDGE_SETTER_FIELDS)) {
      const written = keysWrittenBy(setters[name], EDGE_SETTER_ARGS[name], updateEdge).sort()
      expect(written, `setter '${name}' wrote unexpected data fields`).toEqual([...expected].sort())
    }
  })

  /**
   * ⛔⛔ `EDGE_NON_WRITERS` IS AN EXEMPTION, NOT MERELY A CLASSIFICATION, AND THAT
   * IS WHY IT NEEDS THREE GUARDS RATHER THAN ONE.
   *
   * `editableFieldTable.pinAndParity.spec.ts` asserts that every name in
   * `EDGE_SETTER_FIELDS` has a row in `@talchain/schemas`' EDITABLE FIELD table.
   * **Moving a member OUT of that map removes it from that assertion's domain.**
   * So a name listed below has been excused from an external authority, and the
   * only thing standing in its place is this file. The three guards are what
   * make that trade honest:
   *
   *   · DRIVEN — the claim is executed, not read (below). A list that is only
   *     read is a hand-maintained mirror agreeing with itself, which is exactly
   *     what the union assertion exists to prevent.
   *   · NON-VACUOUS — a quantified assertion over an empty list passes by
   *     testing nothing (CLAUDE.md trap 13).
   *   · DISJOINT — *"in at least one list"* and *"in exactly one list"* are
   *     DIFFERENT assertions. A member in BOTH would satisfy the exhaustiveness
   *     check WHILE ALSO taking the exemption. The keys test happens to catch
   *     that today, because a duplicate makes `declared` longer than `returned`
   *     — but that is emergent, and one `new Set(...)` tidy-up deletes it with
   *     no red anywhere. Stated explicitly here so it cannot be tidied away.
   *
   * Each of the three was mutant-checked when written: a real setter moved into
   * the list REDs the driven check; an emptied list REDs the precondition; a
   * name in both lists REDs the disjointness assertion.
   */
  it('PRECONDITION: the collections under test are non-empty', () => {
    // Without this, every quantified assertion below passes on an empty set.
    // Shape copied from `editableFieldTable.pinAndParity.spec.ts:74-79`, which
    // states the same discipline for the collections it quantifies over.
    expect(Object.keys(NODE_SETTER_FIELDS).length).toBeGreaterThan(0)
    expect(Object.keys(EDGE_SETTER_FIELDS).length).toBeGreaterThan(0)
    expect(Object.keys(EDGE_NON_WRITERS).length).toBeGreaterThan(0)
  })

  it('EDGE: the non-writer exemption is DISJOINT from the setters', () => {
    const setters = new Set(Object.keys(EDGE_SETTER_FIELDS))
    const both = Object.keys(EDGE_NON_WRITERS).filter((n) => setters.has(n)).sort()
    // Named, not counted: the next lane needs to know WHICH member is doubled.
    expect(both, 'member(s) declared BOTH a setter and a non-writer').toEqual([])
  })

  it('EDGE: every declared non-writer really writes NOTHING (the claim is driven, not trusted)', () => {
    const { result } = renderHook(() => useEdgeMutations('e1'))
    const members = result.current as unknown as Record<string, (...a: unknown[]) => void>
    for (const [name, args] of Object.entries(EDGE_NON_WRITERS)) {
      const written = keysWrittenBy(members[name], args, updateEdge)
      expect(written, `'${name}' is declared a non-writer but wrote data fields`).toEqual([])
    }
  })

  it('EDITOR_WRITTEN_FIELDS is the flattened union of the per-setter maps (incl. edge `label`)', () => {
    expect(EDITOR_WRITTEN_FIELDS.node).toEqual([...new Set(Object.values(NODE_SETTER_FIELDS).flat())])
    expect(EDITOR_WRITTEN_FIELDS.edge).toEqual([...new Set(Object.values(EDGE_SETTER_FIELDS).flat())])
    // The field the old hand-list omitted must be present now.
    expect(EDITOR_WRITTEN_FIELDS.edge).toContain('label')
  })

  it('POSITIVE CONTROL: the capture can SEE edge `label` when setLabel runs (not a vacuous pass)', () => {
    const { result } = renderHook(() => useEdgeMutations('e1'))
    const written = keysWrittenBy(result.current.setLabel as (...a: unknown[]) => void, ['proves visibility'], updateEdge)
    expect(written).toEqual(['label'])
  })
})

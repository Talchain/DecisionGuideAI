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
  setStrength: [0.5],
  setStd: [0.1],
  setExistsProbability: [0.8],
  setLabel: ['edge label'],
  setDirection: ['positive'],
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
    const declared = Object.keys(EDGE_SETTER_FIELDS).sort()
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

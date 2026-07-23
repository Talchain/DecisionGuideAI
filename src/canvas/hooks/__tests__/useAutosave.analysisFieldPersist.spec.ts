/**
 * Task #23 — analysis-affecting node edits must survive reload.
 *
 * The analyticalNodeFields registry (#461) flagged node `probability`, `impact`
 * and `prior` as `stale`-only (analysis-affecting) but NOT `persist`: an edit
 * touching ONLY one of those fields never flipped the autosave dirty hash
 * (computeGraphHash), so the 30s autosave skipped and localStorage kept the
 * pre-edit value — the exact class of the #457 lost-target bug. All three are
 * genuinely user-editable in isolation on the LIVE path:
 *
 *   • probability — RiskPanel → setProbability → updateNode(data.probability)
 *   • impact      — RiskPanel → setImpact      → updateNode(data.impact)
 *   • prior       — FactorExternalPanel → setPriorRange → updateNode(data.prior)
 *
 * Task #23 flips them INTO the persist subset. These are the RED-first round-trip
 * pins, one per field: edit ONLY that field through the real store edit seam
 * (updateNode, the chokepoint every panel setter routes through) →
 *   (1) computeGraphHash flips,
 *   (2) the next autosave interval FIRES saveAutosave (spy) and the serialized
 *       node carries the new value,
 *   (3) a real saveAutosave → loadAutosave round-trip hydrates it back.
 *
 * RED before the flip: PERSIST_NODE_FIELDS excludes these fields, so
 * computeGraphHash ignores them, the save is skipped, and (1)/(2) fail.
 *
 * Mutation-check: un-flip any one field in the registry (and its EXPECTED_PERSIST_NODE
 * mirror) → EXACTLY that field's pins here go RED; the #461 drift guard stays green
 * (its consumer-tie derives from the registry). See analyticalNodeFields.registry.spec.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { computeGraphHash, useAutosave } from '../useAutosave'
import { useCanvasStore } from '../../store'
import type { AutosaveData } from '../../store/scenarios'

// ---------------------------------------------------------------------------
// Mocks — intercept the localStorage persistence boundary only (same pattern as
// useAutosave.staleValueHash.spec.ts). The REAL save/load are pulled via
// importOriginal for the hydrate round-trip.
// ---------------------------------------------------------------------------

const mockSaveAutosave = vi.fn()
const mockLoadAutosave = vi.fn()

vi.mock('../../store/scenarios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/scenarios')>()
  return {
    ...actual,
    saveAutosave: (...args: unknown[]) => mockSaveAutosave(...args),
    loadAutosave: (...args: unknown[]) => mockLoadAutosave(...args),
  }
})

// The un-mocked persistence functions, for the real hydrate round-trip.
const realScenarios =
  await vi.importActual<typeof import('../../store/scenarios')>('../../store/scenarios')

const SCENARIO_ID = 'b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5'
const AUTOSAVE_INTERVAL_MS = 30 * 1000
const DEBOUNCE_MS = 500

const RISK_ID = 'risk-1'
const FACTOR_EXT_ID = 'factor-ext-1'

function seedCanvas() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      { id: 'goal-1', type: 'goal', position: { x: 400, y: 40 }, data: { kind: 'goal', label: 'Revenue' } },
      {
        id: RISK_ID,
        type: 'risk',
        position: { x: 40, y: 200 },
        // Risk node with a settled likelihood/impact — the RiskPanel edit target.
        data: { kind: 'risk', label: 'Supplier delay', probability: 0.3, impact: 'medium' },
      },
      {
        id: FACTOR_EXT_ID,
        type: 'factor',
        position: { x: 40, y: 400 },
        // External factor with a prior range — the FactorExternalPanel edit target.
        data: { kind: 'factor', label: 'Market rate', prior: { range_min: 0.4, range_max: 0.8 } },
      },
    ] as any,
    edges: [] as any,
  })
}

/** Run one full autosave cycle: interval tick + debounce flush. */
function advanceOneAutosaveCycle() {
  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS)
  })
  act(() => {
    vi.advanceTimersByTime(DEBOUNCE_MS)
  })
}

/** Edit ONLY the named field on a node via the real store chokepoint. */
function editOnlyField(nodeId: string, field: string, value: unknown) {
  act(() => {
    useCanvasStore.getState().updateNode(nodeId, { data: { [field]: value } } as any)
  })
}

interface FieldCase {
  field: string
  nodeId: string
  value: unknown
  editor: string
}

const CASES: FieldCase[] = [
  { field: 'probability', nodeId: RISK_ID, value: 0.42, editor: 'RiskPanel → setProbability' },
  { field: 'impact', nodeId: RISK_ID, value: 'high', editor: 'RiskPanel → setImpact' },
  {
    field: 'prior',
    nodeId: FACTOR_EXT_ID,
    value: { range_min: 0.2, range_max: 0.6 },
    editor: 'FactorExternalPanel → setPriorRange',
  },
]

beforeEach(() => {
  vi.useFakeTimers()
  mockSaveAutosave.mockReset()
  mockLoadAutosave.mockReset()
  // No competing tab — the multi-tab guard must not block the write.
  mockLoadAutosave.mockReturnValue(null)
  seedCanvas()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('task #23 — analysis-affecting node fields survive reload (persist round-trip)', () => {
  for (const c of CASES) {
    describe(`${c.field} (${c.editor})`, () => {
      it('computeGraphHash flips when ONLY this field changes', () => {
        const before = computeGraphHash(
          [{ id: 'n1', type: c.nodeId === RISK_ID ? 'risk' : 'factor', position: { x: 0, y: 0 }, data: {} }],
          [],
        )
        const after = computeGraphHash(
          [{ id: 'n1', type: c.nodeId === RISK_ID ? 'risk' : 'factor', position: { x: 0, y: 0 }, data: { [c.field]: c.value } }],
          [],
        )
        // RED before the flip: PERSIST_NODE_FIELDS excludes this field, so the
        // hash object omits it and the two hashes are identical.
        expect(after, `${c.field} does not flip computeGraphHash`).not.toBe(before)
      })

      it('the next autosave FIRES and the serialized node carries the new value', () => {
        renderHook(() => useAutosave())

        // Baseline save with the pre-edit value.
        advanceOneAutosaveCycle()
        expect(mockSaveAutosave).toHaveBeenCalledTimes(1)

        editOnlyField(c.nodeId, c.field, c.value)
        advanceOneAutosaveCycle()

        // RED before the flip: the hash ignores this field, the save is skipped,
        // and localStorage keeps the pre-edit value (the reload revert).
        expect(mockSaveAutosave, `${c.field}-only edit did not trigger a re-save`).toHaveBeenCalledTimes(2)

        const saved = mockSaveAutosave.mock.calls.at(-1)?.[0] as AutosaveData
        const savedNode = saved.nodes.find((n) => n.id === c.nodeId)
        expect((savedNode?.data as any)?.[c.field]).toEqual(c.value)
      })

      it('a real saveAutosave → loadAutosave round-trip hydrates the value back', () => {
        renderHook(() => useAutosave())
        advanceOneAutosaveCycle()
        editOnlyField(c.nodeId, c.field, c.value)
        advanceOneAutosaveCycle()

        // The exact payload the mocked spy captured is what the store would
        // persist. Push it through the REAL localStorage seam and read it back.
        const payload = mockSaveAutosave.mock.calls.at(-1)?.[0] as AutosaveData
        expect(payload, `${c.field}: no autosave payload was produced`).toBeDefined()

        realScenarios.clearAutosave()
        realScenarios.saveAutosave(payload)
        const hydrated = realScenarios.loadAutosave()

        const restored = hydrated?.nodes.find((n) => n.id === c.nodeId)
        expect((restored?.data as any)?.[c.field]).toEqual(c.value)
      })
    })
  }

  it('control: a cosmetic-only node edit still does NOT re-save (dirty-hash guard intact)', () => {
    renderHook(() => useAutosave())
    advanceOneAutosaveCycle()
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)

    // `description` is cosmetic — excluded from PERSIST_NODE_FIELDS. Proves the
    // pins above discriminate (they are not passing because ANY edit saves).
    editOnlyField(RISK_ID, 'description', 'new copy')
    advanceOneAutosaveCycle()
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)
  })
})

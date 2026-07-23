/**
 * Lane A (edit-journey display closure) — RED fixture for the reload
 * visual-revert bug.
 *
 * Diagnosis (1.16 run-3 + DB probe, WEEKEND-SPRINT-PLAN-2026-07-11 Lane A):
 * useAutosave's computeGraphHash covers only id/kind/label/x/y plus edge
 * endpoints/weight. A conversational value edit (V5 graph_patch
 * set_factor_value → updateNode merge into node.data.observedState, or an
 * adjust_edge_strength → updateEdgeData direction/weight write) changes NONE
 * of those fields, so the dirty hash never flips, the autosave skips, and
 * localStorage keeps the PRE-EDIT values. On reload, the recovery path
 * (ReactFlowGraph.tsx autosave-vs-scenario timestamp comparison) can hydrate
 * the stale localStorage graph while the server copy is correct — the user
 * SEES old values after an edit the assistant confirmed.
 *
 * These tests reproduce the stale-save path: after a value-bearing data
 * change, the next autosave interval MUST write the new values.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutosave } from '../useAutosave'
import { useCanvasStore } from '../../store'

// ---------------------------------------------------------------------------
// Mocks — intercept the localStorage persistence boundary only; everything
// else in store/scenarios stays real (the canvas store imports it too).
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

const AUTOSAVE_INTERVAL_MS = 30 * 1000
const DEBOUNCE_MS = 500

function seedCanvas() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      {
        id: 'goal-1',
        type: 'goal',
        position: { x: 400, y: 40 },
        data: { kind: 'goal', label: 'Revenue' },
      },
      {
        id: 'factor-1',
        type: 'factor',
        position: { x: 40, y: 200 },
        data: {
          kind: 'factor',
          label: 'Price',
          observedState: { value: 100, baseline: 100, unit: 'GBP' },
        },
      },
      {
        id: 'option-1',
        type: 'option',
        position: { x: 40, y: 400 },
        data: {
          kind: 'option',
          label: 'Raise price',
          interventions: { 'factor-1': 120 },
        },
      },
    ] as any,
    edges: [
      {
        id: 'e1',
        source: 'factor-1',
        target: 'goal-1',
        type: 'styled',
        data: { weight: 0.7, direction: 'positive', confidence: 0.8 },
      },
    ] as any,
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

beforeEach(() => {
  vi.useFakeTimers()
  mockSaveAutosave.mockReset()
  // No competing tab — the multi-tab guard must not block the write.
  mockLoadAutosave.mockReset()
  mockLoadAutosave.mockReturnValue(null)
  seedCanvas()
})

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAutosave — value-bearing data changes must flip the dirty hash', () => {
  it('saves again after a node observedState value change (graph_patch set_factor_value path)', () => {
    renderHook(() => useAutosave())

    // Baseline save with the pre-edit values.
    advanceOneAutosaveCycle()
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)

    // Conversational value edit — the exact write applyV5State performs for
    // graph_patch set_factor_value: merge into node.data.observedState.
    // Position, label, kind, and id all stay identical.
    act(() => {
      const s = useCanvasStore.getState()
      useCanvasStore.setState({
        nodes: s.nodes.map((n: any) =>
          n.id === 'factor-1'
            ? {
                ...n,
                data: {
                  ...n.data,
                  observedState: { ...(n.data?.observedState ?? {}), value: 250 },
                },
              }
            : n,
        ) as any,
      })
    })

    advanceOneAutosaveCycle()

    // RED today: the hash ignores observedState, the save is skipped, and
    // localStorage keeps value=100 — the reload visual revert.
    expect(mockSaveAutosave).toHaveBeenCalledTimes(2)
    const lastCall = mockSaveAutosave.mock.calls.at(-1)?.[0] as {
      nodes: Array<{ id: string; data?: { observedState?: { value?: number } } }>
    }
    const savedFactor = lastCall.nodes.find((n) => n.id === 'factor-1')
    expect(savedFactor?.data?.observedState?.value).toBe(250)
  })

  it('saves again after an option interventions change', () => {
    renderHook(() => useAutosave())

    advanceOneAutosaveCycle()
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)

    // Intervention backfill / edit writes node.data.interventions only.
    act(() => {
      const s = useCanvasStore.getState()
      useCanvasStore.setState({
        nodes: s.nodes.map((n: any) =>
          n.id === 'option-1'
            ? { ...n, data: { ...n.data, interventions: { 'factor-1': 300 } } }
            : n,
        ) as any,
      })
    })

    advanceOneAutosaveCycle()

    expect(mockSaveAutosave).toHaveBeenCalledTimes(2)
    const lastCall = mockSaveAutosave.mock.calls.at(-1)?.[0] as {
      nodes: Array<{ id: string; data?: { interventions?: Record<string, number> } }>
    }
    const savedOption = lastCall.nodes.find((n) => n.id === 'option-1')
    expect(savedOption?.data?.interventions?.['factor-1']).toBe(300)
  })

  it('saves again after an edge direction flip (graph_patch adjust_edge_strength path)', () => {
    renderHook(() => useAutosave())

    advanceOneAutosaveCycle()
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)

    // adjust_edge_strength writes weight/direction into edge.data via
    // updateEdgeData; endpoints stay identical. A direction flip with the
    // same magnitude is invisible to the legacy hash (confidence ?? weight).
    act(() => {
      const s = useCanvasStore.getState()
      useCanvasStore.setState({
        edges: s.edges.map((e: any) =>
          e.id === 'e1' ? { ...e, data: { ...e.data, direction: 'negative' } } : e,
        ) as any,
      })
    })

    advanceOneAutosaveCycle()

    expect(mockSaveAutosave).toHaveBeenCalledTimes(2)
    const lastCall = mockSaveAutosave.mock.calls.at(-1)?.[0] as {
      edges: Array<{ id: string; data?: { direction?: string } }>
    }
    const savedEdge = lastCall.edges.find((e) => e.id === 'e1')
    expect(savedEdge?.data?.direction).toBe('negative')
  })

  it('saves again after a success-target set (setGoalThresholdAndUpdateNode path)', () => {
    renderHook(() => useAutosave())

    // Baseline save with no target.
    advanceOneAutosaveCycle()
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)

    // The exact node write GoalThresholdEditor → setGoalThresholdAndUpdateNode
    // performs when the user sets a success target (no unit): success_threshold +
    // threshold_source='user' on the goal node. Position, label, kind, id and
    // goal_threshold_unit all stay identical — none of the fields the legacy hash
    // covered.
    act(() => {
      const s = useCanvasStore.getState()
      useCanvasStore.setState({
        nodes: s.nodes.map((n: any) =>
          n.id === 'goal-1'
            ? {
                ...n,
                data: {
                  ...n.data,
                  success_threshold: 20,
                  threshold_source: 'user',
                  threshold_confirmed: false,
                },
              }
            : n,
        ) as any,
      })
    })

    advanceOneAutosaveCycle()

    // RED before the fix: the hash ignored success_threshold/threshold_source, the
    // save was skipped, and localStorage never received the target — on reload the
    // goal node carries no threshold (live defect, 2026-07-23).
    expect(mockSaveAutosave).toHaveBeenCalledTimes(2)
    const lastCall = mockSaveAutosave.mock.calls.at(-1)?.[0] as {
      nodes: Array<{ id: string; data?: { success_threshold?: number; threshold_source?: string } }>
    }
    const savedGoal = lastCall.nodes.find((n) => n.id === 'goal-1')
    expect(savedGoal?.data?.success_threshold).toBe(20)
    expect(savedGoal?.data?.threshold_source).toBe('user')
  })

  it('does NOT re-save when nothing changed (dirty-hash guard intact)', () => {
    renderHook(() => useAutosave())

    advanceOneAutosaveCycle()
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)

    // Two more full cycles with no state change — no further writes.
    advanceOneAutosaveCycle()
    advanceOneAutosaveCycle()
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)
  })
})

/**
 * F2 — A SERVER DELETE MUST DROP AN AUTOSAVE THAT BELONGS TO THE DELETED RECORD,
 * EVEN WHEN THE POINTER HAS ALREADY MOVED ON.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT
 * ═══════════════════════════════════════════════════════════════════════════
 * `canvas/store/scenarios.ts` (LOCAL delete) asks two INDEPENDENT questions:
 *
 *     if (getCurrentScenarioId() === id)      -> clear the pointer
 *     if (loadAutosave()?.scenarioId === id)  -> clear the autosave
 *
 * `useScenario.deleteScenario` (SERVER delete) nested the second inside the
 * first, so the autosave was only ever dropped when the POINTER happened to
 * name the deleted record:
 *
 *     if (useCanvasStore.getState().currentScenarioId === id) {
 *       ...
 *       scenarios.clearAutosave()          // <- keyed on the POINTER, not the record
 *     }
 *
 * Two delete paths asking one question, answering it differently — and the
 * shipped comment in `scenarios.ts` asserted the opposite ("Two delete paths
 * asking one question must not answer it differently"). That comment was the
 * only statement of the invariant, and it was false.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY IT IS REACHABLE — the pointer and the record are different objects
 * ═══════════════════════════════════════════════════════════════════════════
 * `useAutosave.ts:320-321` documents concurrent-tab writes as a real condition.
 * Tab 1 holds A, Tab 2 holds B, the shared autosave carries A. Deleting A from
 * Tab 2 leaves `currentScenarioId === B`, so the guard is false and the autosave
 * keeps a UUID the server no longer has. On the next boot
 * `bindRestoredScenarioId` resolves that id, `setCurrentScenarioId` RE-PERSISTS
 * it, and `useServerGraphHydration` fires on a deleted scenario — the
 * resurrection becomes durable. A single-tab variant exists via the ~500 ms
 * `DEBOUNCE_MS` projection lag after a switch.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THESE ASSERTIONS BIND TO
 * ═══════════════════════════════════════════════════════════════════════════
 * The autosave is read back through the SHIPPED `loadAutosave` against REAL
 * `localStorage` — a canonical read of the record, never a callback, a receipt
 * or a returned flag. Each case binds by IDENTITY (the autosave's own
 * `scenarioId`), not by a value predicate another record could satisfy.
 *
 * Case 2 is the discriminating twin: deleting an UNRELATED decision must LEAVE
 * the autosave alone. Without it, the fix could be bought by clearing
 * unconditionally, which would destroy the open decision's unsaved work — a
 * worse defect than the one being fixed. Case 1 alone cannot see that; the pair
 * can.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const mockAuthValue = { user: { id: REAL_USER_ID }, authenticated: true }
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuthValue }))

const mockDeleteScenario = vi.fn()
vi.mock('../../services/scenarioService', () => ({
  createScenario: vi.fn(),
  loadScenario: vi.fn(),
  deleteScenario: (...args: unknown[]) => mockDeleteScenario(...args),
  saveGraphViaGatedPath: vi.fn(),
  saveFraming: vi.fn(),
  storeAnalysis: vi.fn(),
  storeAnalysisFailure: vi.fn(),
  storeBrief: vi.fn(),
  setStage: vi.fn(),
  createSharedBrief: vi.fn(),
  resetAnalysisStatus: vi.fn(),
  setAnalysisRunning: vi.fn(),
  saveTitle: vi.fn(),
}))

let storeState: Record<string, unknown> = {}
vi.mock('../../canvas/store', () => ({
  useCanvasStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector(storeState),
    {
      getState: () => ({ markClean: vi.fn(), hydrateGraphSlice: vi.fn(), ...storeState }),
      setState: (partial: Record<string, unknown>) => {
        storeState = { ...storeState, ...partial }
      },
      subscribe: () => () => {},
    },
  ),
}))

vi.mock('../../canvas/domain/edges', () => ({
  DEFAULT_EDGE_DATA: { weight: 0.5, style: 'solid', curvature: 0.15 },
}))

import { useScenario } from '../useScenario'
// REAL module, REAL localStorage — the record under test is the persisted one.
import { saveAutosave, loadAutosave } from '../../canvas/store/scenarios'

/** The decision the user deletes. */
const DELETED = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'
/** The decision still open in this tab — what the POINTER names. */
const STILL_OPEN = 'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb'
/** A third decision, deleted in case 2 — neither the pointer nor the record. */
const UNRELATED = 'cccccccc-3333-4ccc-8ccc-cccccccccccc'

function seedAutosaveFor(scenarioId: string): void {
  saveAutosave({
    timestamp: Date.now(),
    scenarioId,
    nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} } as never],
    edges: [],
  })
  // The fixture must have LANDED, or every assertion below is vacuous.
  expect(loadAutosave()?.scenarioId, 'autosave fixture did not persist').toBe(scenarioId)
}

describe('useScenario.deleteScenario — an orphaned autosave is dropped with its record', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockDeleteScenario.mockResolvedValue(undefined)
    storeState = {}
  })

  it('CASE 1 (the defect): clears an autosave carrying the DELETED id while the pointer names another decision', async () => {
    storeState = { currentScenarioId: STILL_OPEN }
    seedAutosaveFor(DELETED)
    // Precondition pinned in-test: the pointer and the record genuinely DISAGREE.
    // Without this the case could pass on a payload where they happen to match,
    // which is the branch that already worked.
    expect(storeState.currentScenarioId).not.toBe(loadAutosave()?.scenarioId)

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(DELETED)
    })

    expect(mockDeleteScenario).toHaveBeenCalledWith(DELETED)
    expect(
      loadAutosave(),
      'the autosave still carries a decision the server has deleted — it will be resurrected and re-persisted on the next boot',
    ).toBeNull()
  })

  it('CASE 2 (discriminating twin): LEAVES an autosave belonging to a decision that was not deleted', async () => {
    storeState = { currentScenarioId: STILL_OPEN }
    seedAutosaveFor(DELETED)

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(UNRELATED)
    })

    expect(mockDeleteScenario).toHaveBeenCalledWith(UNRELATED)
    expect(
      loadAutosave()?.scenarioId,
      'deleting an unrelated decision destroyed unsaved work belonging to another one',
    ).toBe(DELETED)
  })

  it('CASE 3 (regression guard): the pointer-matches path still clears both', async () => {
    storeState = { currentScenarioId: DELETED }
    seedAutosaveFor(DELETED)

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(DELETED)
    })

    expect(loadAutosave()).toBeNull()
    expect(storeState.currentScenarioId).toBeNull()
  })

  it('CASE 4: a FAILED server delete touches nothing — no local state is wiped for a decision the server still holds', async () => {
    storeState = { currentScenarioId: STILL_OPEN }
    seedAutosaveFor(DELETED)
    mockDeleteScenario.mockRejectedValue(new Error('server said no'))

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await expect(result.current.deleteScenario(DELETED)).rejects.toThrow('server said no')
    })

    expect(
      loadAutosave()?.scenarioId,
      'a failed delete wiped local state, stranding a decision the user can still reach',
    ).toBe(DELETED)
  })
})

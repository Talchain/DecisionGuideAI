/**
 * DELETING A DECISION MUST NOT LEAVE IT ABLE TO COME BACK ON RELOAD.
 *
 * The defect. `useScenario.deleteScenario` cleared exactly one thing after a
 * successful server delete — the in-MEMORY `currentScenarioId`. It never
 * touched the two localStorage keys that survive a reload:
 *
 *   olumi-canvas-current-scenario-id   → the store boots from it (`store.ts`
 *                                        seeds `currentScenarioId` from it)
 *   olumi-canvas-autosave              → `ReactFlowGraph`'s init effect prefers
 *                                        it whenever it is newer than the saved
 *                                        record, and restores the graph from it
 *
 * So: delete the decision you are looking at, reload, and the deleted
 * decision's graph is back on the canvas — restored on a UUID-FORMAT check with
 * no existence test. CEE #1192 stopped the SERVER resurrecting a deleted
 * scenario; this is the client half of the same harm, and the server fix does
 * not reach it.
 *
 * The localStorage-only sibling (`canvas/store/scenarios.deleteScenario`)
 * already clears the current-scenario key on exactly this condition. This
 * brings the Supabase path into line, and also clears the AUTOSAVE slot — which
 * the sibling does NOT do, and which is the key that actually carries the graph
 * back. (Deriving that at the bytes rather than inheriting "mirror the sibling"
 * is the difference between fixing the pointer and fixing the resurrection.)
 *
 * ── BINDING ─────────────────────────────────────────────────────────────────
 * Every assertion binds by SCENARIO IDENTITY. Deleting some other decision must
 * leave the active one's pointers alone — a fix that simply always cleared
 * would pass the leak tests and log the user out of their open work.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockDeleteScenario = vi.fn()

vi.mock('../../services/scenarioService', async (importOriginal) => ({
  // `importOriginal`-spread, not a hand-listed factory: `useScenario` uses many
  // exports of this module and a bare factory would be a hand-maintained mirror
  // of its export list (CLAUDE.md trap 12).
  ...(await importOriginal<typeof import('../../services/scenarioService')>()),
  deleteScenario: (...args: unknown[]) => mockDeleteScenario(...args),
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: REAL_USER_ID }, authenticated: true }),
}))

import { useScenario } from '../useScenario'
import { useCanvasStore } from '../../canvas/store'

const CURRENT_KEY = 'olumi-canvas-current-scenario-id'
const AUTOSAVE_KEY = 'olumi-canvas-autosave'

const ACTIVE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa'
const OTHER_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb'

/** Put `id` on screen and in the two durable pointers, as a real session does. */
function seedActiveScenario(id: string): void {
  localStorage.setItem(CURRENT_KEY, id)
  localStorage.setItem(
    AUTOSAVE_KEY,
    JSON.stringify({
      scenarioId: id,
      timestamp: Date.now(),
      nodes: [{ id: `node-of-${id}`, type: 'factor', position: { x: 0, y: 0 }, data: {} }],
      edges: [],
    }),
  )
  useCanvasStore.setState({ currentScenarioId: id })
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.removeItem(CURRENT_KEY)
  localStorage.removeItem(AUTOSAVE_KEY)
  useCanvasStore.getState().reset()
  mockDeleteScenario.mockResolvedValue(undefined)
})

describe('deleting the ACTIVE decision clears the pointers that survive a reload', () => {
  it('clears the persisted current-scenario id', async () => {
    seedActiveScenario(ACTIVE_ID)
    // Precondition — the pointer really is there, so the clear below cannot
    // pass against a key that was never written.
    expect(localStorage.getItem(CURRENT_KEY)).toBe(ACTIVE_ID)

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(ACTIVE_ID)
    })

    expect(mockDeleteScenario).toHaveBeenCalledWith(ACTIVE_ID)
    expect(localStorage.getItem(CURRENT_KEY)).toBeNull()
  })

  it('clears the autosave slot that carries the deleted graph back', async () => {
    seedActiveScenario(ACTIVE_ID)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toContain(ACTIVE_ID)

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(ACTIVE_ID)
    })

    // THE RESURRECTION: ReactFlowGraph's init effect prefers this record when
    // it is newer than the saved one, and restores its graph with no existence
    // check on the scenario it names.
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
  })

  it('clears the in-memory store reference', async () => {
    seedActiveScenario(ACTIVE_ID)

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(ACTIVE_ID)
    })

    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
  })
})

describe('deleting a DIFFERENT decision leaves the open one alone', () => {
  it('does not clear the active scenario’s pointers', async () => {
    // The discriminating half. A fix that always cleared would pass every test
    // above while throwing the user out of the decision they still have open.
    seedActiveScenario(ACTIVE_ID)

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(OTHER_ID)
    })

    expect(mockDeleteScenario).toHaveBeenCalledWith(OTHER_ID)
    // Bound by IDENTITY to the still-open scenario.
    expect(localStorage.getItem(CURRENT_KEY)).toBe(ACTIVE_ID)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toContain(ACTIVE_ID)
    expect(useCanvasStore.getState().currentScenarioId).toBe(ACTIVE_ID)
  })
})

describe('a delete that did NOT happen clears nothing', () => {
  it('leaves every pointer in place when the service rejects', async () => {
    // The interaction with the affected-row assertion added to
    // `scenarioService.deleteScenario`: a zero-row delete now THROWS rather
    // than reporting success. Local state must not be wiped for a decision the
    // server still holds — that would turn a failed delete into a decision the
    // user can no longer reach.
    seedActiveScenario(ACTIVE_ID)
    mockDeleteScenario.mockRejectedValue(
      Object.assign(new Error('no rows were deleted'), { code: 'DELETE_FAILED' }),
    )

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await expect(result.current.deleteScenario(ACTIVE_ID)).rejects.toThrow()
    })

    expect(localStorage.getItem(CURRENT_KEY)).toBe(ACTIVE_ID)
    expect(localStorage.getItem(AUTOSAVE_KEY)).toContain(ACTIVE_ID)
    expect(useCanvasStore.getState().currentScenarioId).toBe(ACTIVE_ID)
  })
})

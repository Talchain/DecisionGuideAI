/**
 * P0 — A CREATED SCENARIO MUST OWN ITS OWN ID BEFORE ANYTHING CAN DISPATCH.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, MEASURED (not inferred)
 * ═══════════════════════════════════════════════════════════════════════════
 * E5 trace, GitHub run 33214479408, staging build `e8252496`:
 *
 *   ~14.98 s  route becomes `#/scenario/46609760-7dfe-4ab1-960e-1176ab4ca7a6`
 *    15.16 s  Send → store field still null → `useConversation.ts:4562-4571`
 *             mints `7957639a-9230-401d-9d86-5878b212ffd8` and dispatches on it
 *    37.67 s  scenario_response_fence.discarded {graph_ready_preview, carriedGraph: true}
 *    78.16 s  scenario_response_fence.discarded {terminal_response,  carriedGraph: true}
 *             → "Olumi did not return a model for this decision."
 *
 * `createScenario` had `row.id` in hand at ~14.9 s and threw it away, leaving the
 * canvas to learn its own identity from a ~283 ms Supabase round-trip.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ WHY THE RACE IS FORCED HERE AND NEVER SAMPLED
 * ═══════════════════════════════════════════════════════════════════════════
 * The diagnosing lane got 0 failures in 4 authenticated drafts because its
 * Supabase latency resolved the race the other way. A PASSING RUN AGAINST REAL
 * TIMING PROVES NOTHING. So `loadScenario`'s read is held open by a deferred
 * promise this spec controls: the dispatch-instant assertion below executes at a
 * point where the hydration is GUARANTEED unresolved, not merely likely to be.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ WHAT THESE ASSERTIONS BIND TO
 * ═══════════════════════════════════════════════════════════════════════════
 * `isUUID` and `responseBelongsToDispatchingScenario` are imported from the
 * SHIPPED modules, not restated. The mint branch itself (`useConversation.ts`)
 * cannot be imported without dragging the whole turn path in, so it is not
 * called — instead the store value is asserted to be a value for which that
 * branch is PROVABLY not taken: `!id || !isUUID(id)` is false for any UUID, so a
 * store holding the created row's UUID cannot mint. That is a derivation from the
 * real predicate, not a re-implementation of it.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const mockAuthValue = { user: { id: REAL_USER_ID }, authenticated: true }

/** The id Supabase assigns the new row — the one the route will carry. */
const ROUTE_ID = '46609760-7dfe-4ab1-960e-1176ab4ca7a6'

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => mockAuthValue }))

/**
 * `navigate` records the store AS IT WAS at the instant of the route change.
 * That instant is the guarantee under test: the route change is what mounts
 * CanvasMVP and starts the hydration, so an id seeded after it would not have
 * closed the window.
 */
const scenarioIdAtNavigate: Array<string | null> = []
const mockNavigate = vi.fn((..._a: unknown[]) => {
  scenarioIdAtNavigate.push(useCanvasStore.getState().currentScenarioId ?? null)
})
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }))

const mockCreateScenario = vi.fn()
const mockLoadScenario = vi.fn()
vi.mock('../../services/scenarioService', () => ({
  createScenario: (...a: unknown[]) => mockCreateScenario(...a),
  loadScenario: (...a: unknown[]) => mockLoadScenario(...a),
  saveGraph: vi.fn(),
  saveFraming: vi.fn(),
  storeAnalysis: vi.fn(),
  resetAnalysisStatus: vi.fn(),
  setAnalysisRunning: vi.fn(),
  createSharedBrief: vi.fn(),
  updateStage: vi.fn(),
  setStage: vi.fn(),
  storeBrief: vi.fn(),
}))

import { useScenario } from '../useScenario'
import { useCanvasStore } from '../../canvas/store'
import { isUUID } from '../../services/turn-request-builder'
import { responseBelongsToDispatchingScenario } from '../../canvas/conversation/scenarioResponseFence'

function scenarioRow(id: string) {
  return {
    id,
    title: null,
    graph: { nodes: [], edges: [] },
    framing: null,
    stage: 'frame',
    analysis_status: 'none',
    updated_at: new Date().toISOString(),
  }
}

beforeEach(() => {
  mockCreateScenario.mockReset()
  mockLoadScenario.mockReset()
  mockNavigate.mockClear()
  scenarioIdAtNavigate.length = 0
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: null })
})

describe('P0: a created scenario owns its id before anything can dispatch', () => {
  it('seeds the store with the created id BEFORE navigating to it', async () => {
    mockCreateScenario.mockResolvedValue(scenarioRow(ROUTE_ID))
    const { result } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.createScenario('a new decision')
    })

    expect(
      mockNavigate,
      '[P0] createScenario did not navigate at all — the fixture is wrong, not the product',
    ).toHaveBeenCalledTimes(1)

    // IDENTITY, not a value predicate: the store must hold THIS row's id, the one
    // the route is about to carry — not merely "some UUID", which a mint would
    // also satisfy.
    expect(
      scenarioIdAtNavigate[0],
      '[P0] at the instant of the route change the canvas did not yet know its own ' +
      'scenario id, so a Send before the Supabase read resolves will mint a competing ' +
      'id and both scenario fences will discard the model that comes back.',
    ).toBe(ROUTE_ID)
  })

  it('a dispatch racing an UNRESOLVED hydration still names the created scenario, so the fence admits the response', async () => {
    mockCreateScenario.mockResolvedValue(scenarioRow(ROUTE_ID))

    // Hold the Supabase read OPEN. Everything between here and `releaseRead` runs
    // at a moment when the hydration is guaranteed not to have landed.
    let releaseRead!: (row: unknown) => void
    mockLoadScenario.mockImplementation(
      () => new Promise((resolve) => { releaseRead = resolve }),
    )

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.createScenario('a new decision')
    })

    // CanvasMVP's auth-only effect fires on the route change. Started, not awaited.
    let loadPromise!: Promise<void>
    act(() => { loadPromise = result.current.loadScenario(ROUTE_ID) })

    // ── THE DISPATCH INSTANT ────────────────────────────────────────────────
    const atDispatch = useCanvasStore.getState().currentScenarioId
    expect(
      mockLoadScenario,
      '[P0] the hydration was never started, so this test is not observing the race it claims to',
    ).toHaveBeenCalledWith(ROUTE_ID)
    expect(
      atDispatch !== null && isUUID(atDispatch),
      `[P0] at dispatch the store held ${JSON.stringify(atDispatch)}. useConversation's ` +
      `lazy-UUID branch (\`!id || !isUUID(id)\`) is therefore TAKEN, and the turn goes ` +
      `out under a freshly minted id that nothing else in the client will ever hold.`,
    ).toBe(true)
    expect(
      atDispatch,
      '[P0] the dispatching id is not the created scenario — the turn will be fenced off ' +
      'from its own answer',
    ).toBe(ROUTE_ID)

    // ── now let the hydration land, and ask the REAL fence ──────────────────
    releaseRead(scenarioRow(ROUTE_ID))
    await act(async () => { await loadPromise })
    await waitFor(() => {
      expect(useCanvasStore.getState().currentScenarioId).toBe(ROUTE_ID)
    })

    const live = useCanvasStore.getState().currentScenarioId
    expect(
      responseBelongsToDispatchingScenario(live, atDispatch),
      `[P0] the shipped fence predicate rejects this turn's own response: live=${live} ` +
      `dispatch=${atDispatch}. This is the exact comparison that discarded a complete ` +
      `15-node model twice in run 33214479408.`,
    ).toBe(true)
  })
})

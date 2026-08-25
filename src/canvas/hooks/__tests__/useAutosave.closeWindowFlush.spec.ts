/**
 * The autosave's TWO store-scoped write paths must both ask the same question:
 * "are this scenario's draft values settled right now?"
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS SPEC EXISTS — a guard that was only ever wired on ONE side
 * ─────────────────────────────────────────────────────────────────────────────
 * `applyDraftResult` skips its immediate localStorage write for a streamed
 * GRAPH_READY preview (`opts.skipAutosave`, applyDraftResult.ts:318, passed at
 * useConversation.ts:729-731). Its own comment states the resulting guarantee:
 *
 *   "before then there is deliberately nothing on disk to restore, which is the
 *    honest state"
 *
 * That sentence was FALSE, in the one direction nobody checked. The skip covers
 * only the payload-scoped write. `useAutosave`'s periodic timer is a SECOND,
 * store-scoped writer to the very same slot, it re-reads the store at fire time,
 * and it had ZERO phase awareness — so a 30 s tick landing inside the settling
 * window persisted the preview anyway. On reload `draftStreamPhase` is in-memory
 * and therefore gone, so the preview came back UNMARKED with the run gate OPEN:
 * exactly the fabrication state the skip exists to prevent, reached through the
 * other door. The server-row path was already guarded at its own choke point
 * (`persistGraphNow` → `shouldPersistGraphForScenario`, useScenario.ts:219); the
 * localStorage path never was.
 *
 * And the mirror-image hole on the same seam: nothing flushed the graph to
 * localStorage when the page went away. `flushWorkToAutosave` exists and is
 * synchronous, but its only importer was `ErrorBoundary.tsx:4` — a React CRASH,
 * not a close. The two `beforeunload` handlers in the tree are a navigation
 * WARNING (useScenario.ts:653 — `preventDefault` only, it writes nothing) and
 * the chat transcript (useThreadPersistence.ts:342). So once a draft settled,
 * every subsequent edit lived only in memory for up to
 * AUTOSAVE_INTERVAL_MS + DEBOUNCE_MS, and a close inside that window lost it
 * silently.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BOTH DIRECTIONS, OR THE GUARD IS ONE-SIDED
 * ─────────────────────────────────────────────────────────────────────────────
 * A fix that just wrote on close would pass direction A while re-opening the
 * preview hole; a fix that just blocked writes would pass direction B by
 * persisting nothing at all. Every case below is paired:
 *
 *   A. SETTLED work reaches localStorage on close, WITHOUT the timer advancing.
 *      The timing property is the point — a test that advances 30 s and finds
 *      the data proves nothing about the window this closes, so these cases
 *      assert the write has ALREADY landed with the fake clock untouched.
 *   B. An UNSETTLED preview still reaches localStorage from NEITHER path — not
 *      the close flush, not the periodic tick.
 *
 * B3 is the discrimination control: an unsettled draft owned by a DIFFERENT
 * scenario must NOT block this one. Without it, every direction-B case would
 * also pass under a blanket "never write" mutant.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutosave } from '../useAutosave'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'

// ---------------------------------------------------------------------------
// Mocks — intercept the localStorage persistence boundary only, the same
// `importOriginal`-spread pattern as useAutosave.analysisFieldPersist.spec.ts
// (a bare factory would REPLACE the module and silently drop every other
// export — CLAUDE.md trap 12).
//
// `saveAutosave` is the single write primitive BOTH paths under test reach:
// the periodic timer calls it directly, and `flushWorkToAutosave`
// (persist/crashFlush.ts) imports it from this same module specifier, so one
// spy observes both.
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

const SCENARIO_ID = 'd4d4d4d4-e5e5-4f6f-8a7a-b8b8b8b8b8b8'
const OTHER_SCENARIO_ID = 'e9e9e9e9-f0f0-4a1a-8b2b-c3c3c3c3c3c3'
const TURN_ID = 'turn-close-window-1'

const AUTOSAVE_INTERVAL_MS = 30 * 1000
const DEBOUNCE_MS = 500

const GOAL_ID = 'goal-1'
const OPTION_ID = 'option-1'

/**
 * A settled, plausible graph. Node shape matters: `flushWorkToAutosave` drops
 * anything without a string `id` and finite `position.x/y` (its crash-time
 * plausibility gates), so a sloppy fixture would make direction A pass or fail
 * for a reason that has nothing to do with the guard.
 */
function seedCanvas() {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [
      {
        id: GOAL_ID,
        type: 'goal',
        position: { x: 400, y: 40 },
        data: { kind: 'goal', label: 'Grow recurring revenue' },
      },
      {
        id: OPTION_ID,
        type: 'option',
        position: { x: 120, y: 260 },
        data: { kind: 'option', label: 'Enter the German market' },
      },
    ] as never,
    edges: [
      {
        id: 'edge-1',
        source: OPTION_ID,
        target: GOAL_ID,
        data: { confidence: 0.7 },
      },
    ] as never,
  })
}

/** The user closes the tab / navigates away. */
function fireCloseEvent(type: 'pagehide' | 'beforeunload') {
  act(() => {
    window.dispatchEvent(new Event(type))
  })
}

/** One full periodic autosave cycle: interval tick, then the debounce flush. */
function advanceOneAutosaveCycle() {
  act(() => {
    vi.advanceTimersByTime(AUTOSAVE_INTERVAL_MS)
  })
  act(() => {
    vi.advanceTimersByTime(DEBOUNCE_MS)
  })
}

/** The node ids in whatever payload `saveAutosave` was last handed. */
function persistedNodeIds(): string[] {
  const last = mockSaveAutosave.mock.calls.at(-1)?.[0] as
    | { nodes?: Array<{ id?: string }> }
    | undefined
  return (last?.nodes ?? []).map((n) => String(n?.id))
}

beforeEach(() => {
  vi.useFakeTimers()
  mockSaveAutosave.mockReset()
  mockLoadAutosave.mockReset()
  // No competing tab — the multi-tab staleness guard must not be what decides
  // any of these outcomes.
  mockLoadAutosave.mockReturnValue(null)
  useDraftStore.getState().resetDraft()
  seedCanvas()
})

afterEach(() => {
  vi.useRealTimers()
  useDraftStore.getState().resetDraft()
})

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTION A — settled work survives a close, with the clock UNTOUCHED
// ═══════════════════════════════════════════════════════════════════════════

describe('A. the close window — settled work is flushed before the page goes away', () => {
  it('A1: `pagehide` persists the settled graph WITHOUT any timer advancing', () => {
    renderHook(() => useAutosave())

    // The premise of the whole defect: nothing is on disk yet. If this fires,
    // the case below would be measuring a timer write, not a close flush.
    expect(mockSaveAutosave).not.toHaveBeenCalled()

    fireCloseEvent('pagehide')

    // No vi.advanceTimersByTime anywhere above. THIS is the timing property —
    // the graph is persisted at the moment of close, not 30 s later.
    expect(mockSaveAutosave).toHaveBeenCalled()
    expect(persistedNodeIds()).toEqual(expect.arrayContaining([GOAL_ID, OPTION_ID]))
  })

  it('A2: `beforeunload` persists the settled graph, and the write is SYNCHRONOUS', () => {
    renderHook(() => useAutosave())
    expect(mockSaveAutosave).not.toHaveBeenCalled()

    fireCloseEvent('beforeunload')

    // `beforeunload` offers no async guarantee, so the write must have landed by
    // the time dispatchEvent returns — no timers, no awaited microtask, nothing
    // that a real unload would never wait for. localStorage.setItem is
    // synchronous, which is exactly why this path can be trusted at all.
    expect(mockSaveAutosave).toHaveBeenCalled()
    expect(persistedNodeIds()).toEqual(expect.arrayContaining([GOAL_ID, OPTION_ID]))
  })

  it('A3: an edit made after settle is in the flushed payload (the lost-edit window)', () => {
    renderHook(() => useAutosave())

    act(() => {
      useCanvasStore.getState().updateNode(OPTION_ID, {
        data: { label: 'Enter the German market (phased)' },
      } as never)
    })

    fireCloseEvent('pagehide')

    const last = mockSaveAutosave.mock.calls.at(-1)?.[0] as
      | { nodes?: Array<{ id?: string; data?: { label?: string } }> }
      | undefined
    const option = (last?.nodes ?? []).find((n) => n?.id === OPTION_ID)
    expect(option?.data?.label).toBe('Enter the German market (phased)')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTION B — the deliberate preview skip still holds, on BOTH paths
// ═══════════════════════════════════════════════════════════════════════════

describe('B. the preview skip — an unsettled draft reaches localStorage from neither path', () => {
  it('B1: `settling` — the close flush declines', () => {
    renderHook(() => useAutosave())
    act(() => {
      useDraftStore.getState().setDraftStreamPhase('settling', TURN_ID, SCENARIO_ID)
    })

    fireCloseEvent('pagehide')

    // Persisting here would restore an unmarked preview with an OPEN run gate,
    // because the phase that marks it does not survive a reload.
    expect(mockSaveAutosave).not.toHaveBeenCalled()
  })

  it('B2: `settling` — the PERIODIC timer declines (the hole the skip never covered)', () => {
    renderHook(() => useAutosave())
    act(() => {
      useDraftStore.getState().setDraftStreamPhase('settling', TURN_ID, SCENARIO_ID)
    })

    advanceOneAutosaveCycle()

    expect(mockSaveAutosave).not.toHaveBeenCalled()
  })

  it('B3: an unsettled draft on ANOTHER scenario does NOT block this one (discrimination control)', () => {
    // Without this, every case in this block would also pass under a blanket
    // "never write" mutant — and under the F2 defect the ownership boundary was
    // introduced to fix, where one scenario's phase froze every other one.
    renderHook(() => useAutosave())
    act(() => {
      useDraftStore.getState().setDraftStreamPhase('settling', TURN_ID, OTHER_SCENARIO_ID)
    })

    fireCloseEvent('pagehide')

    expect(mockSaveAutosave).toHaveBeenCalled()
    expect(persistedNodeIds()).toEqual(expect.arrayContaining([GOAL_ID, OPTION_ID]))
  })

  it('B4: `unsettled` — neither path writes', () => {
    renderHook(() => useAutosave())
    act(() => {
      useDraftStore.getState().setDraftStreamPhase('unsettled', TURN_ID, SCENARIO_ID)
    })

    advanceOneAutosaveCycle()
    fireCloseEvent('pagehide')

    expect(mockSaveAutosave).not.toHaveBeenCalled()
  })

  it('B5: `drafting` is NOT unsettled — nothing is on the canvas yet to be wrong about', () => {
    // Pins the classification this guard inherits from `draftValuesAreUnsettled`
    // rather than re-deriving it here: before GRAPH_READY there is no preview to
    // misrepresent, so persistence must continue normally.
    renderHook(() => useAutosave())
    act(() => {
      useDraftStore.getState().setDraftStreamPhase('drafting', TURN_ID, SCENARIO_ID)
    })

    fireCloseEvent('pagehide')

    expect(mockSaveAutosave).toHaveBeenCalled()
  })

  it('B6: once the draft settles to `idle`, the periodic timer writes again', () => {
    // The regression twin for B2: the guard must gate on the phase, not disable
    // the timer. A settled graph still autosaves on its normal cycle.
    renderHook(() => useAutosave())
    act(() => {
      useDraftStore.getState().setDraftStreamPhase('settling', TURN_ID, SCENARIO_ID)
    })
    advanceOneAutosaveCycle()
    expect(mockSaveAutosave).not.toHaveBeenCalled()

    act(() => {
      useDraftStore.getState().setDraftStreamPhase('idle', null, null)
    })
    advanceOneAutosaveCycle()

    expect(mockSaveAutosave).toHaveBeenCalled()
    expect(persistedNodeIds()).toEqual(expect.arrayContaining([GOAL_ID, OPTION_ID]))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Listener hygiene — a close flush that outlives its canvas is a stray writer
// ═══════════════════════════════════════════════════════════════════════════

describe('C. teardown', () => {
  it('C1: the close listeners are removed on unmount', () => {
    const { unmount } = renderHook(() => useAutosave())
    unmount()

    fireCloseEvent('pagehide')
    fireCloseEvent('beforeunload')

    expect(mockSaveAutosave).not.toHaveBeenCalled()
  })
})

/**
 * THE RENAME'S LIFECYCLE — attempt and completion authority that OUTLIVES the
 * React instance that started it. The review P1, driven rather than read.
 *
 * ⭐⭐ THE DEFECT, AND IT IS NOT HYPOTHETICAL — it is a defect class this repo
 * has already measured once, on the neighbouring optimistic writer, and
 * deliberately did not widen to this one.
 *
 * `useConversation`'s catch block gates the whole optimistic resolution on
 * `!isAbort`. Its own header records what that cost on staging `9308a30c`: a
 * preempting turn cancelled a `factor_value_edit`, "so NEITHER arm ran: no
 * revert, no confirm, no sentence", and the analysis went on to name a factor at
 * 92% confidence over a number the user had replaced. The fix added an ABORT ARM
 * — and scoped it, in terms: "Its twin `structural_delete` is deliberately NOT
 * handled here … Naming it rather than silently widening the fix."
 *
 * `structural_rename` is in exactly that unhandled position, and every V5
 * dispatch runs `abortRef.current?.abort()` unconditionally before installing
 * its own controller. So: rename a node, then ask Olumi anything before the
 * rename's turn returns, and the rename turn is cancelled — no revert, no
 * confirmation, and no record anywhere that an attempt was ever made. The
 * optimistic label stands on the canvas as though it had been saved.
 *
 * ⭐ THE THREE OUTCOMES MUST STAY RESOLVABLE, AND `unconfirmed` IS ONE OF THEM.
 * It is a legitimate terminal state — "we sent it and never heard" — and
 * collapsing it into success is precisely the confident wrongness this closes.
 * So the lifecycle record lives in the STORE (which survives a remount, a panel
 * close and a route change) rather than in a closure owned by the component that
 * happened to be mounted when the user typed.
 *
 * ⚠ THE SETTLE IS DERIVED, NOT ENUMERATED. The drain settles anything still
 * `in_flight` once its own await returns — so it covers the abort arm, a
 * superseded-turn discard (`activeV5TurnIdRef` fence), and any exit a future
 * change adds, without a hand-maintained list of `useConversation`'s branches to
 * drift against (trap 12).
 *
 * STATE CLASS: post-rename, in-flight, and REMOUNTED where named.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Node } from '@xyflow/react'

import { useCanvasStore } from '../../store'
import { useStructuralRenameEvents } from '../useStructuralRenameEvents'
import {
  STRUCTURAL_RENAME_UNCONFIRMED_TOAST,
  type StructuralRenameIntent,
} from '../../mutations/structuralRename'
import type { WireSystemEvent } from '../types'

vi.mock('../../../flags', async (importOriginal) => {
  // `importOriginal`-spread, never a hand-listed factory: a `vi.mock` factory
  // REPLACES the module, so every flag not listed would silently vanish.
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isOrchestratorV2Enabled: () => true }
})

const SCENARIO_ID = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const NODE_ID = 'fac_price'
const PREVIOUS = 'Price'
const NEW = 'List price'
const HASH = 'cfded3af0aa14ebd'

function intent(id = 'sr-1'): StructuralRenameIntent {
  return {
    id,
    nodeId: NODE_ID,
    label: NEW,
    expectedLabel: PREVIOUS,
    baseGraphHash: HASH,
    restore: { label: PREVIOUS, provenanceWasPresent: false },
  }
}

/** The canvas as it stands AFTER the optimistic local write — the real pre-state. */
function seedQueued(queued: StructuralRenameIntent[]) {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    lastServerGraphHash: HASH,
    pendingStructuralRenames: queued,
    structuralRenameLifecycle: [],
    _externalMutationActive: 0,
    nodes: [
      { id: NODE_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: NEW, kind: 'factor' } },
    ] as unknown as Node[],
    edges: [],
  } as never)
}

const lifecycle = () => useCanvasStore.getState().structuralRenameLifecycle
const statusOf = (id: string) => lifecycle().find((r) => r.intent.id === id)?.status

let toasts: string[] = []
const onToast = (event: Event) => {
  toasts.push((event as CustomEvent<{ message?: string }>).detail?.message ?? '')
}

beforeEach(() => {
  toasts = []
  window.addEventListener('topbar:show-toast', onToast)
})
afterEach(() => {
  window.removeEventListener('topbar:show-toast', onToast)
  vi.clearAllMocks()
})

// ═══════════════════════════════════════════════════════════════════════════
// 1. THE RECORD EXISTS, IN THE STORE, WHILE THE REQUEST IS STILL IN FLIGHT
// ═══════════════════════════════════════════════════════════════════════════

describe('the attempt is recorded where it can survive the component', () => {
  it('an intent moves pending → in_flight ATOMICALLY, so it is never in neither', async () => {
    seedQueued([intent()])
    let release!: () => void
    const sender = vi.fn(
      () => new Promise<unknown>((resolve) => { release = () => resolve({}) }),
    )

    renderHook(() => useStructuralRenameEvents(sender))

    await waitFor(() => expect(sender).toHaveBeenCalledTimes(1))
    // ⭐ THE CLAIM: mid-flight, the gesture is neither lost nor duplicated —
    // it is OUT of the pending queue and IN the lifecycle as `in_flight`.
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
    expect(statusOf('sr-1')).toBe('in_flight')
    // Scenario-bound: a late settle against a different decision must stand down.
    expect(lifecycle()[0]!.scenarioId).toBe(SCENARIO_ID)

    await act(async () => { release() })
  })

  it('UNMOUNTING mid-flight does not destroy the record — this is the whole point of it being store state', async () => {
    seedQueued([intent()])
    let release!: () => void
    const sender = vi.fn(
      () => new Promise<unknown>((resolve) => { release = () => resolve({}) }),
    )

    const { unmount } = renderHook(() => useStructuralRenameEvents(sender))
    await waitFor(() => expect(sender).toHaveBeenCalledTimes(1))

    unmount()

    expect(statusOf('sr-1')).toBe('in_flight')
    await act(async () => { release() })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. `unconfirmed` IS A REAL TERMINAL STATE, SHOWN HONESTLY
// ═══════════════════════════════════════════════════════════════════════════

describe('the deferral and the lifecycle are the same gesture, seen twice', () => {
  it('a DEFERRED intent (captured with a null base) gets a record once the drain resolves it', async () => {
    // The sibling lane's P0 fix queues a rename made on a restored graph with
    // `baseGraphHash: null` and holds it until a turn stamps one. That intent is
    // exactly the one that sits longest in memory, so it is the one that most
    // needs an attempt record — a deferral that is then interrupted would
    // otherwise be doubly silent.
    seedQueued([{ ...intent(), baseGraphHash: null }])
    let release!: () => void
    // Captured through a local rather than off `mock.calls`: `vi.fn()` with no
    // implementation signature infers an EMPTY argument tuple, so indexing it is
    // a type error rather than a lax read.
    let sentEvent: WireSystemEvent | null = null
    const sender = vi.fn((event: WireSystemEvent) => {
      sentEvent = event
      return new Promise<unknown>((resolve) => { release = () => resolve({}) })
    })

    renderHook(() => useStructuralRenameEvents(sender))

    await waitFor(() => expect(sender).toHaveBeenCalledTimes(1))
    expect(statusOf('sr-1')).toBe('in_flight')
    // The record holds the intent AS CAPTURED; the RESOLVED copy is what went on
    // the wire — so this is the one assertion binding the two lanes' halves
    // together: a deferred capture, stamped at drain time, recorded as one
    // attempt.
    expect(sentEvent).toMatchObject({ payload: { base_graph_hash: HASH } })

    await act(async () => { release() })
  })
})

describe('MUST FIRE — an interrupted send settles `unconfirmed` rather than going silent', () => {
  it('an ABORTED turn leaves a record and tells the user, instead of nothing at all', async () => {
    seedQueued([intent()])
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const sender = vi.fn(async () => { throw abortErr })

    renderHook(() => useStructuralRenameEvents(sender))

    await waitFor(() => expect(statusOf('sr-1')).toBe('unconfirmed'))
    // ⚠ THE NAME IS NOT REVERTED, deliberately. The cancel was CLIENT-side; CEE
    // may well have taken the rename and there are no committed bytes either
    // way. Discarding the user's typing on that guess is the data-loss
    // direction of the same harm.
    const label = (useCanvasStore.getState().nodes[0]!.data as { label?: string }).label
    expect(label).toBe(NEW)
    expect(toasts).toContain(STRUCTURAL_RENAME_UNCONFIRMED_TOAST)
  })

  it('a send that RESOLVES without any resolver having settled the record still settles it', async () => {
    // The superseded-turn fence (`activeV5TurnIdRef.current === turnClientId`)
    // discards a preempted turn's resolution silently. The drain's settle is
    // DERIVED from "still in_flight when my await returned", so it covers that
    // arm without naming it — and will cover the next one too.
    seedQueued([intent()])
    const sender = vi.fn(async () => ({ /* a reply nobody resolved against */ }))

    renderHook(() => useStructuralRenameEvents(sender))

    await waitFor(() => expect(statusOf('sr-1')).toBe('unconfirmed'))
    expect(toasts).toContain(STRUCTURAL_RENAME_UNCONFIRMED_TOAST)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. THE OPPOSITE-DIRECTION TWINS — a settled outcome must NOT be overwritten
// ═══════════════════════════════════════════════════════════════════════════

describe('MUST NOT FIRE — an outcome the server DID give is never downgraded', () => {
  it('TWIN — a record already settled `committed` is left alone, and no toast fires', async () => {
    seedQueued([intent()])
    const sender = vi.fn(async () => {
      // Stand in for `resolveStructuralRename` running synchronously inside
      // `sendTurn`, which is where the real settle happens.
      useCanvasStore.getState().settleStructuralRename('sr-1', 'committed')
      return {}
    })

    renderHook(() => useStructuralRenameEvents(sender))

    await waitFor(() => expect(sender).toHaveBeenCalledTimes(1))
    await act(async () => { await Promise.resolve() })
    expect(statusOf('sr-1')).toBe('committed')
    expect(toasts).toEqual([])
  })

  it('TWIN — a record already settled `refused` is left alone, and no toast fires', async () => {
    seedQueued([intent()])
    const sender = vi.fn(async () => {
      useCanvasStore.getState().settleStructuralRename('sr-1', 'refused')
      return {}
    })

    renderHook(() => useStructuralRenameEvents(sender))

    await waitFor(() => expect(sender).toHaveBeenCalledTimes(1))
    await act(async () => { await Promise.resolve() })
    expect(statusOf('sr-1')).toBe('refused')
    expect(toasts).toEqual([])
  })

  it('TWIN — `settleStructuralRename` is IDEMPOTENT: a late arm cannot rewrite a terminal verdict', async () => {
    seedQueued([intent()])
    const sender = vi.fn(async () => {
      useCanvasStore.getState().settleStructuralRename('sr-1', 'committed')
      return {}
    })
    renderHook(() => useStructuralRenameEvents(sender))
    await waitFor(() => expect(statusOf('sr-1')).toBe('committed'))

    useCanvasStore.getState().settleStructuralRename('sr-1', 'unconfirmed')

    // A committed rename that later reads `unconfirmed` would tell the user
    // their saved name might not be saved — a lie in the other direction.
    expect(statusOf('sr-1')).toBe('committed')
  })

  it('TWIN — a DECISION-CONTEXT change drops the record; a verdict about another decision is not ours to keep', async () => {
    seedQueued([intent()])
    const sender = vi.fn(async () => {
      useCanvasStore.getState().settleStructuralRename('sr-1', 'committed')
      return {}
    })
    renderHook(() => useStructuralRenameEvents(sender))
    await waitFor(() => expect(statusOf('sr-1')).toBe('committed'))

    useCanvasStore.getState().hydrateGraphSlice({
      nodes: [
        { id: 'other', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Other' } },
      ] as unknown as Node[],
      edges: [],
      currentScenarioId: 'another-scenario',
    } as never)

    expect(lifecycle()).toEqual([])
  })
})

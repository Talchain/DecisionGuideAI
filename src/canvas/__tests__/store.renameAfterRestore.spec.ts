/**
 * THE RESTORE PATH ITSELF — driven, not seeded.
 *
 * ⭐⭐ WHAT THIS ADDS OVER `store.restoredGraphRename.spec.ts`, which pins the
 * same deferral: that spec seeds the post-restore STATE with
 * `useCanvasStore.setState({ lastServerGraphHash: null, … })`. This one drives
 * `hydrateGraphSlice` — the production scenario-load path
 * (`useScenario.loadScenario` → here) and the boot autosave restore — and lets
 * the store arrive at that state on its own.
 *
 * The difference is not stylistic. A hand-seeded fixture encodes the AUTHOR's
 * model of the restore path; if `DECISION_CONTEXT_CLEAR` ever stopped nulling
 * `lastServerGraphHash`, or a restore began seeding one, the seeded spec would
 * keep passing while describing a state no user can reach — and the deferral
 * would be dead code under a green suite. So the first assertion here is the
 * PRECONDITION: a restore really does clear the base hash. Everything after it
 * is conditional on that remaining true.
 *
 * ⚠ AND THE HARM IS ONLY REAL BECAUSE THE SERVER WINS ON LABELS.
 * `mergeServerGraphOnHydrate` does `{...existing.data, ...mapped.data}` — "CEE's
 * `label` wins on every" field both sides carry — so a rename that never
 * reaches the wire is not a local display name, it is a name with a scheduled
 * deletion. That is why the deferral (queue it, tell the user, send it on the
 * next turn) is the right answer and a silent local-only apply was not.
 *
 * STATE CLASS: RESTORED throughout, via the real restore action.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { Node } from '@xyflow/react'

import { useCanvasStore } from '../store'
import {
  STRUCTURAL_RENAME_DEFERRED_NOTICE,
  resolveStructuralRenameBase,
  buildStructuralRenameWirePayload,
} from '../mutations/structuralRename'

const NODE_ID = 'fac_price'
const PREVIOUS = 'Price'
const NEW = 'List price'
const HASH = 'cfded3af0aa14ebd'

function restoredNodes(): Node[] {
  return [
    {
      id: NODE_ID,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: PREVIOUS, kind: 'factor' },
    },
  ] as unknown as Node[]
}

/**
 * Drive the REAL restore. Nothing here reaches past `hydrateGraphSlice` into the
 * post-restore state, which is what makes this a witness rather than a
 * restatement of what the author believes the restore does.
 */
function restoreScenario(scenarioId: string | null): void {
  useCanvasStore.setState({
    // Deliberately NON-null going in: the point is to watch the restore clear it.
    lastServerGraphHash: HASH,
    pendingStructuralRenames: [],
    _externalMutationActive: 0,
    // Set explicitly rather than left over: `hydrateGraphSlice` writes
    // `currentScenarioId` only when the key is PRESENT, so a bare restore would
    // silently inherit the previous test's id.
    currentScenarioId: null,
  } as never)
  useCanvasStore.getState().hydrateGraphSlice({
    nodes: restoredNodes(),
    edges: [],
    ...(scenarioId !== null ? { currentScenarioId: scenarioId } : {}),
  } as never)
}

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
})

const labelOf = (id: string) =>
  (useCanvasStore.getState().nodes.find((n) => n.id === id)?.data as
    | { label?: string }
    | undefined)?.label

describe('the precondition — a restore is what puts a user on the deferred branch', () => {
  it('`hydrateGraphSlice` CLEARS the base hash, so the very first rename has no base', () => {
    restoreScenario('s1')
    // If this ever stops being true the deferral below is unreachable and every
    // spec that seeds `lastServerGraphHash: null` is describing a dead state.
    expect(useCanvasStore.getState().lastServerGraphHash).toBeNull()
  })

  it('and a restore seeds `lastAuthoritativeGraph`, so the scenario counts as server-owned', () => {
    restoreScenario('s1')
    expect(useCanvasStore.getState().lastAuthoritativeGraph).not.toBeNull()
  })
})

describe('MUST FIRE — the first rename after a real restore is deferred, never dropped', () => {
  beforeEach(() => restoreScenario('s1'))

  it('queues a durable intent with a NULL base, keeps the name on screen, and discloses the gap', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    const queued = useCanvasStore.getState().pendingStructuralRenames
    expect(queued).toHaveLength(1)
    expect(queued[0]!.baseGraphHash).toBeNull()
    expect(queued[0]!.expectedLabel).toBe(PREVIOUS)
    // The pre-0.50.0 capability is intact — the user's typing stays on screen.
    expect(labelOf(NODE_ID)).toBe(NEW)
    // ⚠ AND THE GAP IS DISCLOSED. A queued-but-unsent rename genuinely does not
    // survive a reload (the queue is memory-only), so silence here would be the
    // durability claim the product has not earned.
    expect(toasts).toContain(STRUCTURAL_RENAME_DEFERRED_NOTICE)
  })

  it('once a turn stamps a hash the SAME intent resolves against it, keeping the ORIGINAL expected_label', () => {
    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)
    // The remedy the copy names, exercised: `applyV5State` reaches this setter
    // with the top-level `graph_hash` off every response.
    useCanvasStore.getState().setLastServerGraphHash(HASH)

    const intent = useCanvasStore.getState().pendingStructuralRenames[0]!
    const resolved = resolveStructuralRenameBase(
      intent,
      useCanvasStore.getState().lastServerGraphHash,
    )!
    expect(buildStructuralRenameWirePayload(resolved)).toEqual({
      node_id: NODE_ID,
      label: NEW,
      // ⭐ The assertion is about the graph the user was LOOKING AT, not the one
      // the hash arrived from. A resolver that also refreshed `expected_label`
      // would compare our own write against itself and pass every time.
      expected_label: PREVIOUS,
      base_graph_hash: HASH,
    })
  })
})

describe('MUST NOT FIRE — the opposite-direction twins, all from a real restore', () => {
  it('TWIN 1 — a genuinely LOCAL scratch graph gets NO notice: there is no saved model to fall behind', () => {
    restoreScenario(null)
    useCanvasStore.setState({ lastAuthoritativeGraph: null } as never)

    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    expect(labelOf(NODE_ID)).toBe(NEW)
    expect(toasts).toEqual([])
  })

  it('TWIN 2 — with a hash already in hand there is nothing to disclose, so no notice fires', () => {
    restoreScenario('s1')
    useCanvasStore.getState().setLastServerGraphHash(HASH)

    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    expect(useCanvasStore.getState().pendingStructuralRenames[0]!.baseGraphHash).toBe(HASH)
    expect(toasts).toEqual([])
  })

  it('TWIN 3 — a PRODUCER write on a restored scenario queues nothing and says nothing', () => {
    restoreScenario('s1')
    useCanvasStore.setState({ _externalMutationActive: 1 } as never)

    useCanvasStore.getState().updateNodeLabel(NODE_ID, NEW)

    // CEE's own rename coming back must land on the canvas. Blocking it would
    // stop the canvas reflecting the server — a far worse defect than a missing
    // turn, and the exact direction a one-sided corpus would miss.
    expect(labelOf(NODE_ID)).toBe(NEW)
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
    expect(toasts).toEqual([])
  })

  it('TWIN 4 — a NO-OP rename on a restored scenario queues nothing and says nothing', () => {
    restoreScenario('s1')

    useCanvasStore.getState().updateNodeLabel(NODE_ID, PREVIOUS)

    // Nothing changed and nothing was lost, so there is nothing to tell the
    // user. A notice here would train them to ignore the one that matters.
    expect(labelOf(NODE_ID)).toBe(PREVIOUS)
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)
    expect(toasts).toEqual([])
  })
})

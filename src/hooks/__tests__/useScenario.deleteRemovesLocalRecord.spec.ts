/**
 * F2, REMAINING HALF — A SERVER DELETE MUST REMOVE THE LOCAL SCENARIO RECORD,
 * NOT ONLY THE POINTER AND THE AUTOSAVE.
 *
 * Named by Codex's source-grounded CHANGES_REQUIRED at exact head `a1932f83`
 * (comment `5483021253`):
 *
 *   "persisted pointer and local saved-record deletion still diverge between
 *    server/local paths."
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT — THREE OBJECTS, AND THE SERVER PATH ONLY EVER HANDLED TWO
 * ═══════════════════════════════════════════════════════════════════════════
 * `canvas/store/scenarios.ts` (LOCAL delete) disposes of THREE things:
 *
 *     saveScenarios(loadScenarios().filter(s => s.id !== id))  // 1. the RECORD
 *     if (getCurrentScenarioId() === id)     -> remove the key  // 2. the POINTER
 *     if (loadAutosave()?.scenarioId === id) -> clearAutosave() // 3. the AUTOSAVE
 *
 * `useScenario.deleteScenario` (SERVER delete) handles 2 and 3 — the previous
 * commit on this branch fixed 3, keying it on the autosave's own `scenarioId`
 * exactly as the local path does — and has never handled 1. The saved record
 * therefore SURVIVES a server delete.
 *
 * So the two paths still answer one question differently, which is the very
 * shape this PR's own comment claims to have closed. Half a trap-21 repair is
 * not a repair: it leaves the invariant stated and false, which is worse than
 * leaving it unstated, because the next lane reads the comment instead of the
 * code.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY IT IS REACHABLE — the ids genuinely collide
 * ═══════════════════════════════════════════════════════════════════════════
 * A local record and a Supabase row can carry the SAME id. `canvas/store.ts`'s
 * `saveCurrentScenario` calls
 *
 *     scenarios.createScenario({ ..., id: currentScenarioId ?? undefined, ... })
 *
 * whose own comment says it ADOPTS "an already-allocated conversation UUID …
 * so the saved record reuses the same ID rather than minting a replacement".
 * `store.ts`'s post-run hook then keeps that record warm through
 * `scenarios.updateScenario(currentScenarioId, …)`.
 *
 * Once the record survives a delete it is not inert. `getScenario(id)` resolves
 * it (`loadScenarios().find(s => s.id === id)`), so a decision the server no
 * longer has still answers to its own id on the client.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THESE ASSERTIONS BIND TO — a COLD READ, never a receipt
 * ═══════════════════════════════════════════════════════════════════════════
 * Every case reads the record back through the SHIPPED `loadScenarios` against
 * REAL `localStorage` AFTER the action, and binds by IDENTITY (the record's own
 * `id`), never by a count or a value predicate another record could satisfy.
 *
 * ⚠ THIS IS DELIBERATE AND IT IS THE POINT. `provenance: "user_set"` is NOT in
 * the `observed_state.source` union — it lives on `NodeV3.provenance`, whose own
 * schema says "RESPONSE-ONLY, recomputed on every response". A witness that sees
 * it has established NOTHING about persistence. The canonical evidence for a
 * persistence claim is a cold read of the persisted store, so that is what every
 * assertion here does.
 *
 * CASE 2 is the discriminating twin, and it is what stops the fix being bought
 * by deleting unconditionally — which would destroy records the user never
 * asked to lose. CASE 5 is the strongest form: it drives BOTH delete paths over
 * byte-identical seeded state and asserts they leave byte-identical stores, so
 * the invariant is DERIVED from the two implementations rather than restated by
 * hand in a comment that can go false again.
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

// `importOriginal` spread, NOT a hand-listed export set: a `vi.mock` factory
// REPLACES the module, so listing only `DEFAULT_EDGE_DATA` drops every other
// export and collection dies the moment anything on the import graph needs one
// (it did — `canvas/domain/migrations.ts` needs `EdgeDataSchema`). CLAUDE.md
// trap 12: derive, never mirror.
vi.mock('../../canvas/domain/edges', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../canvas/domain/edges')>()),
  DEFAULT_EDGE_DATA: { weight: 0.5, style: 'solid', curvature: 0.15 },
}))

import { useScenario } from '../useScenario'
// REAL module, REAL localStorage — the records under test are the persisted ones.
import {
  createScenario as createLocalRecord,
  deleteScenario as deleteLocalRecord,
  loadScenarios,
  saveAutosave,
  setCurrentScenarioId,
} from '../../canvas/store/scenarios'

/** The decision the user deletes. */
const DELETED = 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa'
/** The decision still open in this tab — what the POINTER names. */
const STILL_OPEN = 'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb'
/** A third decision, deleted in case 2 — neither the pointer nor the record. */
const UNRELATED = 'cccccccc-3333-4ccc-8ccc-cccccccccccc'

const SCENARIOS_KEY = 'olumi-canvas-scenarios'

/** A COLD READ of the persisted store — the canonical evidence for a persistence claim. */
function persistedIds(): string[] {
  return loadScenarios().map(s => s.id)
}

/** Seed a REAL record through the shipped writer, and assert the fixture LANDED. */
function seedRecord(id: string, name: string): void {
  createLocalRecord({
    name,
    id,
    nodes: [{ id: `n-${id}`, position: { x: 0, y: 0 }, data: {} } as never],
    edges: [],
  })
  expect(persistedIds(), `record fixture for ${name} did not persist`).toContain(id)
}

describe('useScenario.deleteScenario — the local saved RECORD goes with the server delete', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockDeleteScenario.mockResolvedValue(undefined)
    storeState = {}
  })

  it('CASE 1 (the defect): removes the local record for the deleted decision', async () => {
    seedRecord(DELETED, 'Deleted decision')
    seedRecord(STILL_OPEN, 'Still open')
    storeState = { currentScenarioId: STILL_OPEN }

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(DELETED)
    })

    expect(mockDeleteScenario).toHaveBeenCalledWith(DELETED)
    expect(
      persistedIds(),
      'the local saved record outlived the server delete — getScenario() still resolves a ' +
        'decision the server no longer has',
    ).not.toContain(DELETED)
    // Bound by identity, not by a count: the OTHER record must be untouched.
    expect(persistedIds()).toContain(STILL_OPEN)
  })

  it('CASE 2 (discriminating twin): LEAVES the record of a decision that was not deleted', async () => {
    seedRecord(DELETED, 'Deleted decision')
    seedRecord(STILL_OPEN, 'Still open')
    storeState = { currentScenarioId: STILL_OPEN }

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(UNRELATED)
    })

    expect(mockDeleteScenario).toHaveBeenCalledWith(UNRELATED)
    expect(
      persistedIds().sort(),
      'deleting an unrelated decision removed records the user never asked to lose',
    ).toEqual([DELETED, STILL_OPEN].sort())
  })

  it('CASE 3: the record goes even when the POINTER has already moved on', async () => {
    seedRecord(DELETED, 'Deleted decision')
    seedRecord(STILL_OPEN, 'Still open')
    storeState = { currentScenarioId: STILL_OPEN }
    // Precondition pinned in-test: pointer and deleted record genuinely DISAGREE,
    // so this cannot pass on the branch that already worked.
    expect(storeState.currentScenarioId).not.toBe(DELETED)

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(DELETED)
    })

    expect(persistedIds()).not.toContain(DELETED)
    expect(persistedIds()).toContain(STILL_OPEN)
  })

  it('CASE 4: a FAILED server delete leaves the record alone', async () => {
    seedRecord(DELETED, 'Deleted decision')
    storeState = { currentScenarioId: DELETED }
    mockDeleteScenario.mockRejectedValue(new Error('server said no'))

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await expect(result.current.deleteScenario(DELETED)).rejects.toThrow('server said no')
    })

    expect(
      persistedIds(),
      'a failed delete removed the local record, stranding a decision the server still holds',
    ).toContain(DELETED)
  })

  it('CASE 5 (⭐ the invariant itself, DERIVED): both delete paths leave byte-identical persisted state', async () => {
    // ── Arm A: the LOCAL delete path ────────────────────────────────────────
    localStorage.clear()
    seedRecord(DELETED, 'Deleted decision')
    seedRecord(STILL_OPEN, 'Still open')
    setCurrentScenarioId(DELETED)
    saveAutosave({
      timestamp: 1_700_000_000_000,
      scenarioId: DELETED,
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} } as never],
      edges: [],
    })
    deleteLocalRecord(DELETED)
    const localArm = {
      recordIds: persistedIds().sort(),
      pointer: localStorage.getItem('olumi-canvas-current-scenario-id'),
      autosave: localStorage.getItem('olumi-canvas-autosave'),
    }

    // ── Arm B: the SERVER delete path, over IDENTICAL seeded state ──────────
    localStorage.clear()
    seedRecord(DELETED, 'Deleted decision')
    seedRecord(STILL_OPEN, 'Still open')
    setCurrentScenarioId(DELETED)
    saveAutosave({
      timestamp: 1_700_000_000_000,
      scenarioId: DELETED,
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} } as never],
      edges: [],
    })
    storeState = { currentScenarioId: DELETED }
    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(DELETED)
    })
    const serverArm = {
      recordIds: persistedIds().sort(),
      pointer: localStorage.getItem('olumi-canvas-current-scenario-id'),
      autosave: localStorage.getItem('olumi-canvas-autosave'),
    }

    // The instrument must be able to SEE a difference, or this comparison is
    // vacuous (trap 13 — an absence probe needs a positive control). The
    // surviving record proves both arms actually wrote something.
    expect(localArm.recordIds, 'positive control: the local arm kept the untouched record').toEqual([
      STILL_OPEN,
    ])

    expect(
      serverArm,
      'two delete paths asking ONE question must not answer it differently — this is the ' +
        'invariant the shipped comment asserts, derived from the two implementations rather ' +
        'than restated by hand',
    ).toEqual(localArm)
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ACCEPTANCE CASE 2, SERVER ARM — a deliberately deleted decision is not
 * resurrected on the next boot.
 * ═══════════════════════════════════════════════════════════════════════════
 * `reactFlowGraph.restoreScenarioBinding.spec.ts` already pins this for the
 * LOCAL delete. Its server twin could not be written before this commit: the
 * record survived, so `getScenario(id)` kept resolving the deleted decision and
 * the boot arbiter could still choose it as a load source. It is written here
 * because the harm is the deleted decision COMING BACK, which is a property of
 * the delete, not of the binding.
 *
 * ⚠ `rebootAndBind` is a REPRODUCTION of `ReactFlowGraph`'s init effect, not the
 * effect itself — the effect is gated on `import.meta.env.PROD` and cannot run
 * under vitest. It is the same reproduction, in the same order, that the restore
 * spec uses, and it carries the same limitation: it proves the state a delete
 * LEAVES BEHIND cannot feed the fallback. It does NOT prove the deployed effect
 * reads that state the same way; only a live capture can.
 */
import * as scenariosModule from '../../canvas/store/scenarios'
import { bindRestoredScenarioId } from '../../canvas/ReactFlowGraph'

function rebootAndBind(): string | null {
  const currentId = scenariosModule.getCurrentScenarioId()
  const autosave = scenariosModule.loadAutosave()
  const scenario = currentId ? scenariosModule.getScenario(currentId) : null

  let loadSource: 'autosave' | 'scenario' | 'none' = 'none'
  if (autosave && scenario) {
    loadSource = autosave.timestamp > scenario.updatedAt ? 'autosave' : 'scenario'
  } else if (autosave) {
    loadSource = 'autosave'
  } else if (scenario) {
    loadSource = 'scenario'
  }

  if (loadSource === 'autosave' && autosave) return bindRestoredScenarioId(currentId, autosave)
  return null
}

describe('a SERVER-deleted decision does not come back on the next boot', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mockDeleteScenario.mockResolvedValue(undefined)
    storeState = {}
  })

  it('⭐ server delete → reboot: the deleted id is not rebound, re-persisted, or restored', async () => {
    seedRecord(DELETED, 'A decision the user deletes')
    setCurrentScenarioId(DELETED)
    saveAutosave({
      timestamp: Date.now() + 1000,
      scenarioId: DELETED,
      nodes: [{ id: 'n1', position: { x: 0, y: 0 }, data: {} } as never],
      edges: [],
    })
    // PRECONDITIONS, pinned — this is only a test about a delete if all three hold.
    expect(scenariosModule.getCurrentScenarioId()).toBe(DELETED)
    expect(scenariosModule.getScenario(DELETED)).toBeDefined()
    expect(scenariosModule.loadAutosave()?.scenarioId).toBe(DELETED)

    storeState = { currentScenarioId: DELETED }
    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.deleteScenario(DELETED)
    })

    // All three durable objects are gone — the RECORD is the one this commit adds.
    expect(
      scenariosModule.getScenario(DELETED),
      'the record survived, so the boot arbiter can still choose the deleted decision as a load source',
    ).toBeUndefined()
    expect(scenariosModule.getCurrentScenarioId()).toBeNull()
    expect(scenariosModule.loadAutosave()?.scenarioId).not.toBe(DELETED)

    // Reboot. Nothing may rebind the deleted decision, in memory or on disk.
    expect(rebootAndBind()).not.toBe(DELETED)
    // `useCanvasStore` is mocked in this file, so the in-memory pointer is read
    // back off the mock's own state rather than pretending it is the real store.
    expect(storeState.currentScenarioId).not.toBe(DELETED)
    expect(scenariosModule.getCurrentScenarioId()).not.toBe(DELETED)
  })
})

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠⚠ ACCEPTANCE CASE 5 — NOT A PASS. THIS IS A PINNED KNOWN GAP.
 * ═══════════════════════════════════════════════════════════════════════════
 * The acceptance condition is "displayed graph identity == outbound first-edit
 * identity". IT DOES NOT HOLD on this branch, and this test says so out loud
 * rather than leaving the gap invisible (the honest way to ship a known gap: an
 * explicit pin that REDs if the set grows OR shrinks).
 *
 * THE COMPOSITION, both halves derived at the bytes:
 *
 *   LOAD SOURCE (`ReactFlowGraph` init effect): when an autosave and the
 *   pointer's record both exist, the NEWER one wins. An autosave newer than the
 *   record means the graph put on screen is the AUTOSAVE'S — and an autosave
 *   carries its OWN `scenarioId`.
 *
 *   BINDING (`resolveRestoredScenarioId`): when the pointer and the record's own
 *   id are both well-formed and DIFFER, the POINTER wins. That precedence is
 *   deliberate and separately pinned by the restore spec.
 *
 * Each half is defensible alone. Composed, they can display decision A's graph
 * while binding identity B — so the first edit after that restore is addressed
 * to a decision the user is not looking at. This is the classic trap-21 shape:
 * two authorities answering DIFFERENT questions ("which graph do we show?" vs
 * "which decision are we in?"), correct individually, contradictory together.
 *
 * ⚠ SCOPE, STATED EXACTLY (trap 20). This test drives the BINDING seam only. It
 * does NOT prove what the deployed build renders: the load-source branch is
 * gated on `import.meta.env.PROD` and cannot execute under vitest, so the
 * load-source half below is a REPRODUCTION of that rule, not the rule itself.
 * What is proven here is narrow and real: given a state the load-source rule
 * resolves to 'autosave', the identity bound is NOT the identity of the graph
 * that source carries.
 *
 * Fixing it means changing a precedence this PR deliberately chose, which is a
 * different change from the delete-divergence repair and is NOT attempted here.
 */
describe('KNOWN GAP — displayed-graph identity and bound identity can disagree', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    storeState = {}
  })

  it('pins the divergence: the autosave supplies the graph, the pointer supplies the identity', () => {
    // The pointer names STILL_OPEN and has a record; the autosave carries DELETED
    // and is NEWER, so the load-source rule selects the autosave's graph.
    const pointerRecord = scenariosModule.createScenario({
      id: STILL_OPEN,
      name: 'The decision the pointer names',
      nodes: [],
      edges: [],
    })
    setCurrentScenarioId(STILL_OPEN)
    saveAutosave({
      timestamp: pointerRecord.updatedAt + 1000,
      scenarioId: DELETED,
      nodes: [{ id: 'n-from-deleted', position: { x: 0, y: 0 }, data: {} } as never],
      edges: [],
    })

    const currentId = scenariosModule.getCurrentScenarioId()
    const autosave = scenariosModule.loadAutosave()!
    const record = scenariosModule.getScenario(currentId!)!
    // Precondition pinned in-test: the load-source rule genuinely selects the
    // AUTOSAVE here, or this test is about a state that never arises.
    expect(autosave.timestamp > record.updatedAt, 'fixture does not reach the autosave branch').toBe(true)
    expect(autosave.scenarioId, 'fixture does not create a disagreement').not.toBe(currentId)

    const bound = bindRestoredScenarioId(currentId, autosave)

    // THE GAP, asserted exactly as it currently behaves.
    expect(
      bound,
      'if this flipped to the autosave id, the gap has been CLOSED — delete this pin and ' +
        'promote the case to a real acceptance assertion',
    ).toBe(STILL_OPEN)
    expect(
      autosave.scenarioId,
      'the graph on screen belongs to this decision, while the identity above belongs to another',
    ).toBe(DELETED)
  })
})

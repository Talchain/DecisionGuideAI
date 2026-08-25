/**
 * The CRASH flush must not persist an unsettled streamed draft.
 *
 * ⚠ THE THIRD DOOR INTO THE SAME FABRICATION. `applyDraftResult` skips its own
 * payload-scoped write during a streamed GRAPH_READY preview (`opts.skipAutosave`,
 * applyDraftResult.ts:319) and #835 closed the two STORE-scoped writers in
 * `useAutosave`. Neither touched `flushWorkToAutosave`, whose OTHER importer is
 * `ErrorBoundary.tsx:114` — so a React crash inside the ~25 s settling window
 * still wrote the unsettled preview to `olumi-canvas-autosave`.
 *
 * WHY THAT IS A FABRICATION AND NOT MERELY A STALE SAVE. `draftStreamPhase`
 * lives in memory. It does not survive the reload the boundary is about to
 * offer. So the preview comes back UNMARKED, with the run gate OPEN, and the
 * user analyses in-progress numbers believing they are the model's. The autosave
 * payload is unversioned, so there is no honest way to mark the row as
 * provisional on the way out (a durable unsettled marker was designed and
 * DECLINED — the only versioning mechanism in the tree is dead code that fails
 * open).
 *
 * WHY DECLINING IS NOT DATA LOSS — the tension this lane had to resolve.
 * Declining looks like it trades a fabrication for losing the user's draft. It
 * does not, because the draft is not only in the browser:
 *   · CEE lets the turn finish when the client hangs up and commits the drafted
 *     graph server-side (`draftRecovery.ts` header, 2.1257);
 *   · the scenario id survives in its OWN ungated key,
 *     `olumi-canvas-current-scenario-id` (scenarios.ts:62) — nothing in this
 *     guard touches it;
 *   · boot hydration is wired unconditionally at `CanvasMVP.tsx:89`
 *     (`useServerGraphHydration` → `hydrateCanvasFromServer`), so the reload the
 *     boundary offers reads the server's committed graph back for that scenario.
 * The lost quantity is therefore local NODE POSITIONS for one in-flight draft —
 * which the terminal apply re-lays-out anyway — not the user's work.
 *
 * AND THE ASYMMETRY THAT SETTLES IT. A declined flush is HONEST BY
 * CONSTRUCTION: `flushWorkToAutosave` returns false, `componentDidCatch` stores
 * that as `workFlushed` (ErrorBoundary.tsx:154) and the "your work is
 * auto-saved" promise is gated on it (:450). So declining downgrades a promise;
 * writing tells a lie the user cannot detect. Pinned as case D3.
 *
 * WHERE THE GUARD LIVES, AND WHY NOT AT THE CALL SITE. #835 guarded its OWN
 * call site (useAutosave.ts:384). Guarding `ErrorBoundary` the same way would
 * make a two-entry list of call sites to keep in step — the shape
 * `shouldPersistGraphForScenario`'s own header exists to refuse ("a single
 * derived choke point, not a list of call sites"), and the next importer would
 * inherit the defect silently. The gate belongs INSIDE the primitive, where the
 * scenario id the write is actually scoped to has just been resolved. That
 * matters concretely: the write is scoped to
 * `snapshot.scenarioId ?? getCurrentScenarioId()`, while a call-site guard tests
 * whatever id the CALLER happens to hold. Case C2 pins the difference.
 *
 * ONE AUTHORITY. Every expectation below is derived from
 * `shouldPersistGraphForScenario` / `draftValuesAreUnsettled`, never from a
 * hand-written list of "phases that should block" — a second spelling of the
 * rule is the two-`generateGraphHash`-twins defect (trap 12).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { flushWorkToAutosave } from '../crashFlush'
import { useCanvasStore } from '../../store'
import {
  useDraftStore,
  shouldPersistGraphForScenario,
  draftValuesAreUnsettled,
  type DraftStreamPhase,
} from '../../stores/draftStore'

// ---------------------------------------------------------------------------
// Mock the localStorage persistence boundary ONLY. `importOriginal`-spread, not
// a bare factory: a factory REPLACES the module and would silently drop
// `getCurrentScenarioId`, which case C2 depends on being the REAL one (trap 12).
//
// ⚠ THE SPY DELEGATES TO THE REAL WRITER rather than swallowing the call. A
// spy that only counts would make case A3 VACUOUS — with `saveAutosave`
// stubbed out, "the previous autosave survived" is true even with the guard
// deleted, because nothing could have overwritten it either way. Delegating
// means the spy answers "was it called" AND localStorage answers "what is
// actually on disk", and A3's mutant genuinely bites.
// ---------------------------------------------------------------------------
const mockSaveAutosave = vi.fn()

vi.mock('../../store/scenarios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/scenarios')>()
  return {
    ...actual,
    saveAutosave: (...args: unknown[]) => mockSaveAutosave(...args),
  }
})

/** The unmocked module, for seeding and reading real persisted state. */
async function realScenarios() {
  return vi.importActual<typeof import('../../store/scenarios')>('../../store/scenarios')
}

const SCENARIO_ID = 'c1c1c1c1-a2a2-4b3b-8c4c-d5d5d5d5d5d5'
const OTHER_SCENARIO_ID = 'f6f6f6f6-b7b7-4c8c-8d9d-e0e0e0e0e0e0'
const TURN_ID = 'turn-crash-flush-1'
const CURRENT_SCENARIO_KEY = 'olumi-canvas-current-scenario-id'

const ALL_PHASES: readonly DraftStreamPhase[] = ['idle', 'drafting', 'settling', 'unsettled']

/**
 * A plausible graph. Node shape matters: `flushWorkToAutosave`'s crash-time
 * plausibility gates DROP anything without a string `id` and finite
 * `position.x/y`, and a graph that filters to empty returns false WITHOUT
 * writing — which would make every case below pass for a reason that has
 * nothing to do with the draft phase. `seedPrecondition` asserts against that.
 */
function seedCanvas(scenarioId: string | null): void {
  useCanvasStore.setState({
    currentScenarioId: scenarioId,
    nodes: [
      {
        id: 'goal-1',
        type: 'goal',
        position: { x: 400, y: 40 },
        data: { kind: 'goal', label: 'Grow recurring revenue' },
      },
      {
        id: 'option-1',
        type: 'option',
        position: { x: 120, y: 260 },
        data: { kind: 'option', label: 'Enter the German market' },
      },
    ] as never,
    edges: [
      { id: 'edge-1', source: 'option-1', target: 'goal-1', data: { confidence: 0.7 } },
    ] as never,
  })
}

/**
 * PIN THE PRECONDITION IN-TEST (trap 13b). Every "it declined" assertion below
 * is only evidence if the flush WOULD otherwise have written. Proven here by
 * running the flush against a pristine draft store and requiring a real write —
 * so a fixture that silently stopped being flushable (a plausibility-gate
 * change, an empty graph, an unregistered provider) REDs as a precondition
 * failure instead of masquerading as a passing guard.
 */
function assertFixtureWouldOtherwiseFlush(): void {
  useDraftStore.getState().resetDraft()
  mockSaveAutosave.mockClear()
  expect(flushWorkToAutosave()).toBe(true)
  expect(mockSaveAutosave).toHaveBeenCalledTimes(1)
  mockSaveAutosave.mockClear()
}

beforeEach(async () => {
  const actual = await realScenarios()
  mockSaveAutosave.mockReset()
  // Delegate, do not swallow — see the mock's header.
  mockSaveAutosave.mockImplementation((data: unknown) =>
    actual.saveAutosave(data as Parameters<typeof actual.saveAutosave>[0]),
  )
  localStorage.clear()
  useDraftStore.getState().resetDraft()
  seedCanvas(SCENARIO_ID)
})

afterEach(() => {
  useDraftStore.getState().resetDraft()
  localStorage.clear()
})

// ═══════════════════════════════════════════════════════════════════════════
// A. THE FABRICATION — a crash inside the settling window must write NOTHING
// ═══════════════════════════════════════════════════════════════════════════

describe('A. the crash flush declines while the streamed draft is unsettled', () => {
  it('A1: `settling` — the ~25 s preview window is not persisted', () => {
    assertFixtureWouldOtherwiseFlush()
    useDraftStore.getState().setDraftStreamPhase('settling', TURN_ID, SCENARIO_ID)

    expect(flushWorkToAutosave()).toBe(false)
    expect(mockSaveAutosave).not.toHaveBeenCalled()
  })

  it('A2: `unsettled` — a stream that died leaves nothing on disk either', () => {
    // The terminal state a stop or a stream loss PRODUCES. It persists
    // indefinitely until recovery or a new draft releases it, so an unguarded
    // flush here is the longest-lived version of the fabrication.
    assertFixtureWouldOtherwiseFlush()
    useDraftStore.getState().setDraftStreamPhase('unsettled', TURN_ID, SCENARIO_ID)

    expect(flushWorkToAutosave()).toBe(false)
    expect(mockSaveAutosave).not.toHaveBeenCalled()
  })

  it('A3: the last good PRE-DRAFT autosave survives the crash intact', () => {
    // ⭐ THE CASE THAT SETTLES "fabrication vs data loss", and the reason
    // declining is not a trade at all. `saveAutosave` is a whole-object
    // REPLACE, not a merge (autosaveProjectionParity's header). During
    // `settling` the store holds the streamed PREVIEW, which has already
    // replaced what was on the canvas — so the unguarded flush was not merely
    // persisting something unsettled, it was DESTROYING the last good
    // pre-draft snapshot to do it. Declining preserves the user's real work;
    // writing loses it AND lies about it.
    //
    // Non-vacuous because the spy delegates to the real writer: with the guard
    // removed, this row is genuinely overwritten on disk.
    const preDraft = {
      nodes: [
        {
          id: 'user-authored-1',
          type: 'goal',
          position: { x: 10, y: 20 },
          data: { kind: 'goal', label: 'The work the user typed themselves' },
        },
      ],
      edges: [],
      scenarioId: SCENARIO_ID,
      timestamp: Date.now(),
    }
    localStorage.setItem('olumi-canvas-autosave', JSON.stringify(preDraft))

    useDraftStore.getState().setDraftStreamPhase('settling', TURN_ID, SCENARIO_ID)
    expect(flushWorkToAutosave()).toBe(false)

    const onDisk = JSON.parse(localStorage.getItem('olumi-canvas-autosave') ?? 'null')
    expect(onDisk?.nodes?.map((n: { id: string }) => n.id)).toEqual(['user-authored-1'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// B. THE OTHER DIRECTION — the flush must still do its job
// ═══════════════════════════════════════════════════════════════════════════
// A one-sided guard is the defect one level up, and that exact shape was found
// in this file's neighbour (`useAutosave`'s preview skip, #835 section B). These
// cases pass at pristine and MUST stay passing: they are what stops the fix
// being "never flush".

describe('B. the crash flush still saves the work it exists to save', () => {
  it('B1: `idle` — an ordinary crash persists the graph, as before', () => {
    expect(flushWorkToAutosave()).toBe(true)
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)
  })

  it('B2: `drafting` — nothing is on the canvas yet to be wrong about', () => {
    // The distinction that keeps this from being a blanket "any streamed turn
    // blocks everything": before GRAPH_READY there is no preview to
    // misrepresent, so the pre-draft graph is still the user's real work.
    // Derived, not asserted: `drafting` is classified NOT-unsettled by the
    // authority's compiler-checked switch.
    expect(draftValuesAreUnsettled('drafting')).toBe(false)
    useDraftStore.getState().setDraftStreamPhase('drafting', TURN_ID, SCENARIO_ID)

    expect(flushWorkToAutosave()).toBe(true)
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)
  })

  it('B3: a draft unsettled on ANOTHER scenario does not block this one', () => {
    // Otherwise one dead stream freezes crash recovery for the whole app —
    // review F2's defect wearing a crash-flush hat.
    useDraftStore.getState().setDraftStreamPhase('unsettled', TURN_ID, OTHER_SCENARIO_ID)

    expect(flushWorkToAutosave()).toBe(true)
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)
  })

  it('B4: release re-opens the flush — not a one-way door', () => {
    useDraftStore.getState().setDraftStreamPhase('settling', TURN_ID, SCENARIO_ID)
    expect(flushWorkToAutosave()).toBe(false)

    useDraftStore.getState().setDraftStreamPhase('idle', null, null)
    expect(flushWorkToAutosave()).toBe(true)
    expect(mockSaveAutosave).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// C. THE AUTHORITY, AND THE ID THE GUARD MUST TEST
// ═══════════════════════════════════════════════════════════════════════════

describe('C. the guard consumes the one authority, on the right scenario id', () => {
  it('C1: for EVERY phase, the flush agrees with shouldPersistGraphForScenario', () => {
    // Exhaustive over the union and derived from the predicate, so a fifth phase
    // cannot be classified one way for the writer and another for the run gate,
    // and so this expectation cannot drift into a hand-listed mirror.
    for (const phase of ALL_PHASES) {
      useDraftStore.getState().setDraftStreamPhase(phase, TURN_ID, SCENARIO_ID)
      mockSaveAutosave.mockClear()

      const permitted = shouldPersistGraphForScenario(SCENARIO_ID)
      expect(flushWorkToAutosave()).toBe(permitted)
      expect(mockSaveAutosave).toHaveBeenCalledTimes(permitted ? 1 : 0)
    }
  })

  it('C2: gates on the id the WRITE is scoped to, not the one a caller holds', () => {
    // `flushWorkToAutosave` resolves its scenario as
    // `snapshot.scenarioId ?? getCurrentScenarioId()`. With the store's id null,
    // the localStorage fallback supplies it — and THAT is the row the write
    // lands on, so THAT is the id the phase must be tested against.
    //
    // This is the case a call-site guard cannot get right without re-deriving
    // the same fallback, i.e. without becoming a second spelling of it.
    localStorage.setItem(CURRENT_SCENARIO_KEY, SCENARIO_ID)
    seedCanvas(null)
    useDraftStore.getState().setDraftStreamPhase('settling', TURN_ID, SCENARIO_ID)

    expect(flushWorkToAutosave()).toBe(false)
    expect(mockSaveAutosave).not.toHaveBeenCalled()

    // Discriminator: the SAME null-store shape flushes when the fallback id's
    // draft is settled — so C2's decline is the phase's doing, not the null.
    useDraftStore.getState().setDraftStreamPhase('idle', null, null)
    expect(flushWorkToAutosave()).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// D. THE HONESTY CONSEQUENCE
// ═══════════════════════════════════════════════════════════════════════════

describe('D. a declined flush reports itself, so no promise is made over it', () => {
  it('D3: returns false rather than throwing or reporting a phantom write', () => {
    // `ErrorBoundary.componentDidCatch` stores this exact boolean as
    // `workFlushed` (:154) and gates the "your work is auto-saved" line on it
    // (:450). A guard that returned true, or threw into the boundary's own
    // catch, would leave the panel promising a snapshot that does not exist —
    // trading the fabrication for a different one.
    useDraftStore.getState().setDraftStreamPhase('settling', TURN_ID, SCENARIO_ID)

    let returned: boolean | undefined
    expect(() => {
      returned = flushWorkToAutosave()
    }).not.toThrow()
    expect(returned).toBe(false)
  })
})

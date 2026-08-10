/**
 * Draft Store — session-level draft generation state extracted from useCanvasStore.
 *
 * Owns:
 * - Model selection: selectedGenerationModel, selectedRepairModel, selectedEnrichmentModel
 * - Draft status: isGenerating, lastDraftDescription, lastDraftError
 * - Full-draft applied timestamp: fullDraftAppliedAt
 *
 * NOT owned (remains in useCanvasStore):
 * - draftChatPreDraftSnapshot: written atomically alongside nodes/edges in
 *   undoDraft. Splitting it out would break atomicity during the graph restore.
 * - currentBriefText, draftComposerText: multiple components write these via
 *   direct useCanvasStore.setState() calls and readinessStore.ts reads them.
 *   Moving them requires migrating 3+ direct-setState call sites plus a
 *   cross-store read from readinessStore. Deferred.
 *
 * Cross-store direction: canvas-store -> draft-store only. This file does NOT
 * import useCanvasStore (circular-dep hard fail rule).
 */
import { create } from 'zustand'

export interface DraftErrorState {
  message: string
  status?: number
  correlationId?: string
  timestamp: number
  /** Whether the error is retryable. false = deterministic validation failure. */
  retryable?: boolean
  /** CEE-side error code used to filter redundant blockers. */
  code?: string
}

/**
 * Where a STREAMED draft turn currently is (ROADMAP 2.122 / 1.204 M1).
 *
 * Only ever non-`idle` on the streamed path — the buffered turn has no phase
 * to report, which is the whole reason 2.122 exists.
 *
 *   `drafting`  — the turn is open, DRAFTING acknowledged, no graph yet. The
 *                 client holds one frame and elapsed time (PROGRESS frames are
 *                 measured-ABSENT on the wire), so narration stays
 *                 elapsed-time-only here.
 *   `settling`  — GRAPH_READY has landed and the structure is on the canvas,
 *                 but the frame is `status: in_progress`: its NUMBERS are not
 *                 final and coaching has not arrived. Every claim-bearing
 *                 affordance must stay shut in this phase — see
 *                 `canRunAnalysis`'s `draftValuesSettling` rung.
 *   `unsettled` — terminal, and the honest failure state. Drafting ended after
 *                 GRAPH_READY without a terminal ingest — the stream died and
 *                 the buffered fallback found the turn already committed, or the
 *                 user pressed Stop, or the 130 s client timeout fired. The
 *                 structure on screen is real, its numbers are the in-progress
 *                 ones, and this session will not receive the settled set.
 *                 Narrating anything else would be a fabrication.
 *
 * ⚠ THE PHASE IS SCOPED TO THE SCENARIO THAT OWNS IT (adversarial review F2).
 * It used to be global and, because `unsettled` is deliberately terminal, it was
 * never cleared — so an unsettled draft on scenario A blocked Run on EVERY other
 * scenario, with the false reason "your model is still being drafted" about a
 * model that was never streamed. Recovery was a page reload.
 *
 * The fix is a DERIVATION, not a clear-on-boundary list: `draftStreamScenarioId`
 * records the owner and `draftStreamPhaseFor` reports `idle` for anybody else. A
 * list of boundaries to clear at would be a hand-maintained mirror of the set of
 * ways a scenario can change (trap 12) — and the review found the existing
 * `resetDraft` was exactly that mirror, with a doc comment claiming a caller it
 * does not have.
 */
export type DraftStreamPhase = 'idle' | 'drafting' | 'settling' | 'unsettled'

export interface DraftState {
  /** Null = use default model. Session-only, not persisted. */
  selectedGenerationModel: string | null
  selectedRepairModel: string | null
  selectedEnrichmentModel: string | null
  /** True while a conversation turn is in flight (for stage pill overlay). */
  isGenerating: boolean
  /** Persisted draft description text. */
  lastDraftDescription: string
  /** Last draft error (not cleared in canvas reset — survives retry cycles). */
  lastDraftError: DraftErrorState | null
  /** Task 2: Signal for AI panel auto-collapse. Set when a full_draft auto_apply patch is applied. */
  fullDraftAppliedAt: number | null
  /** ROADMAP 2.122 — the streamed draft turn's phase. See DraftStreamPhase. */
  draftStreamPhase: DraftStreamPhase
  /**
   * The `client_turn_id` that owns `draftStreamPhase`. Load-bearing: a stale
   * turn's frames must never move a newer turn's phase, and the COMPLETE ingest
   * uses this to recognise ITS OWN GRAPH_READY preview on the canvas (see
   * `useConversation`'s two-phase apply).
   */
  draftStreamTurnId: string | null
  /**
   * The scenario the phase belongs to (review F2). Never read directly by a
   * consumer — read through `draftStreamPhaseFor`, which is the one place that
   * decides whether a phase is any of the current scenario's business.
   */
  draftStreamScenarioId: string | null
  /**
   * True once the owning turn's COACHING_READY frame has landed (F1 — honest
   * staged progress). Licenses the settling narration to stop claiming
   * coaching is outstanding. Meaningful only while `draftStreamPhase` is
   * `settling` and only for the owning scenario — consumers read it beside
   * `draftStreamPhaseFor`, and it resets whenever ownership does (phase
   * `idle`) or a new turn starts (phase `drafting`).
   */
  draftStreamCoachingLanded: boolean
}

export interface DraftActions {
  setSelectedGenerationModel: (modelId: string | null) => void
  setSelectedRepairModel: (modelId: string | null) => void
  setSelectedEnrichmentModel: (modelId: string | null) => void
  /** Reset a specific model to default (used for error recovery). */
  resetModelToDefault: (operation: 'generation' | 'repair' | 'enrichment') => void
  /** Reset all three model selections. Used by canvas-store resetCanvas. */
  resetAllModels: () => void
  setIsGenerating: (v: boolean) => void
  setLastDraftDescription: (description: string) => void
  setLastDraftError: (error: DraftErrorState | null) => void
  setFullDraftAppliedAt: (ts: number) => void
  /**
   * Move the streamed draft's phase. `turnId` is the owning `client_turn_id` and
   * `scenarioId` the owning scenario; pass `null` for both alongside `'idle'` to
   * release ownership.
   */
  setDraftStreamPhase: (
    phase: DraftStreamPhase,
    turnId: string | null,
    scenarioId: string | null,
  ) => void
  /**
   * Record that the owning turn's COACHING_READY frame landed. Guarded by
   * identity: a frame from a turn that no longer owns the phase (stale stream,
   * preempted turn) must not move a newer turn's narration.
   */
  markDraftStreamCoachingLanded: (turnId: string) => void
  /**
   * Reset every field to initial values.
   *
   * ⚠ THE DOC COMMENT HERE USED TO CLAIM "Called from canvas-store resetCanvas".
   * It is not, and never was — this function has ZERO production callers
   * (established by the adversarial review's complete call-site manifest). That
   * false claim is trap 14 on precisely the surface trap 14 is about: an honest
   * label ("unused") overwritten by a reassuring one, which then taught readers —
   * including me — that the scenario boundary was already handled. It is not
   * handled by a reset at all; ownership is DERIVED, see `draftStreamPhaseFor`.
   * Kept because the tests use it, and named honestly.
   */
  resetDraft: () => void
}

const initialDraftState: DraftState = {
  selectedGenerationModel: null,
  selectedRepairModel: null,
  selectedEnrichmentModel: null,
  isGenerating: false,
  lastDraftDescription: '',
  lastDraftError: null,
  fullDraftAppliedAt: null,
  draftStreamPhase: 'idle',
  draftStreamTurnId: null,
  draftStreamScenarioId: null,
  draftStreamCoachingLanded: false,
}

export const useDraftStore = create<DraftState & DraftActions>((set) => ({
  ...initialDraftState,

  setSelectedGenerationModel: (modelId) => {
    set({ selectedGenerationModel: modelId })
  },

  setSelectedRepairModel: (modelId) => {
    set({ selectedRepairModel: modelId })
  },

  setSelectedEnrichmentModel: (modelId) => {
    set({ selectedEnrichmentModel: modelId })
  },

  resetModelToDefault: (operation) => {
    const resetMap = {
      generation: { selectedGenerationModel: null },
      repair: { selectedRepairModel: null },
      enrichment: { selectedEnrichmentModel: null },
    } as const
    set(resetMap[operation])
  },

  resetAllModels: () => {
    set({
      selectedGenerationModel: null,
      selectedRepairModel: null,
      selectedEnrichmentModel: null,
    })
  },

  setIsGenerating: (v) => {
    set({ isGenerating: v })
  },

  setLastDraftDescription: (description) => {
    set({ lastDraftDescription: description })
    // Note: the old useCanvasStore implementation called
    //   saveUIPreference('lastDraftDescription', description)
    // but 'lastDraftDescription' is not a key in the UIPreferences type or
    // the STORAGE_KEYS switch, so storageKey resolved to undefined and the
    // underlying localStorage.setItem was effectively unread. No consumer
    // reads from that localStorage location. The persistence call is dropped
    // here — the field lives in memory for the session, matching actual
    // observed behaviour rather than the broken side effect.
  },

  setLastDraftError: (error) => {
    set({ lastDraftError: error })
  },

  setFullDraftAppliedAt: (ts) => {
    set({ fullDraftAppliedAt: ts })
  },

  setDraftStreamPhase: (phase, turnId, scenarioId) => {
    set((state) => ({
      draftStreamPhase: phase,
      draftStreamTurnId: phase === 'idle' ? null : turnId,
      draftStreamScenarioId: phase === 'idle' ? null : scenarioId,
      // The coaching flag belongs to one turn's stream. It resets when
      // ownership is released (`idle`) or a new turn starts (`drafting`), and
      // survives the drafting→settling→unsettled transitions of the turn that
      // set it. Derived here rather than at call sites so no caller can strand
      // a stale flag onto the next draft's narration (trap 12).
      draftStreamCoachingLanded:
        phase === 'idle' || phase === 'drafting' ? false : state.draftStreamCoachingLanded,
    }))
  },

  markDraftStreamCoachingLanded: (turnId) => {
    set((state) =>
      state.draftStreamTurnId === turnId ? { draftStreamCoachingLanded: true } : {},
    )
  },

  resetDraft: () => {
    set(initialDraftState)
  },
}))

// ---------------------------------------------------------------------------
// ROADMAP 2.122 round 2 — the two derived reads (adversarial review F1, F2)
// ---------------------------------------------------------------------------

/**
 * The streamed draft phase, **but only when it belongs to `currentScenarioId`**.
 *
 * This is the single place that decides whether a phase is any of a scenario's
 * business, and every consumer goes through it — the run gate (both surfaces) and
 * the graph-persistence choke point. Review F2 found the ungated read blocking
 * every other scenario with a false claim; the earlier M15/M16 survivors found
 * that re-deriving a rule at each call site is how a clause gets silently
 * dropped. One function, exhaustively tested, no mirror.
 *
 * An `unsettled` phase with no owning scenario recorded (only reachable from a
 * hand-constructed store state) reports `idle`: fail-OPEN is correct here because
 * the alternative is blocking every scenario forever on unattributable state,
 * which is the exact defect F2 named.
 */
export function draftStreamPhaseFor(
  state: Pick<DraftState, 'draftStreamPhase' | 'draftStreamScenarioId'>,
  currentScenarioId: string | null,
): DraftStreamPhase {
  if (state.draftStreamScenarioId === null) return 'idle'
  return state.draftStreamScenarioId === currentScenarioId ? state.draftStreamPhase : 'idle'
}

/**
 * The phases in which a streamed draft's numbers are NOT settled, so nothing may
 * treat the graph as final. Derived from the union rather than restated, so a new
 * phase has to be classified here rather than defaulting to "settled".
 */
export function draftValuesAreUnsettled(phase: DraftStreamPhase): boolean {
  switch (phase) {
    case 'settling':
    case 'unsettled':
      return true
    case 'idle':
    case 'drafting':
      return false
  }
}

/**
 * The phases in which a streamed draft turn is STILL RUNNING — so the user can
 * still stop it, and a Stop affordance is honest (ROADMAP 2.134).
 *
 * Note this is NOT the complement of `draftValuesAreUnsettled`, and the overlap
 * is the whole point: `settling` is both *unsettled* (its numbers are the
 * frame's `in_progress` ones, so the run gate stays shut) and *in flight* (the
 * turn runs on to ~61 s, so Stop still means something). `unsettled` is the
 * terminal state a stop PRODUCES — a Stop control offered over it would be a
 * control that stops nothing.
 *
 * Exhaustive over the union rather than expressed as a two-clause boolean at the
 * call site, for the reason the M15 survivor taught: a derivation that lives in
 * a component is a derivation no test can see, and a mutant that drops a clause
 * from it survives. A fifth phase is a compile error here.
 */
export function draftStreamInFlight(phase: DraftStreamPhase): boolean {
  switch (phase) {
    case 'drafting':
    case 'settling':
      return true
    case 'idle':
    case 'unsettled':
      return false
  }
}

/**
 * May the UI persist `scenarios.graph` for this scenario right now?
 *
 * **NO while its streamed draft's values are in progress** (review F1).
 *
 * The review VOIDED rowed item 9's premise for the abort path: with no terminal
 * ingest the unsettled values persist indefinitely, and the next canvas edit's
 * debounced echo save — which re-reads the store at fire time — writes the
 * unsettled graph back OVER CEE's settled commit.
 *
 * This answers the "never a stranded unsettled row" requirement more strongly
 * than the bound the row claimed, and more safely than reverting the canvas
 * would: **the UI simply never writes a graph whose values it knows are
 * in-progress**, so there is no unsettled row to strand and no window in which a
 * later echo save can carry one. Reverting instead would risk writing an EMPTY
 * graph over CEE's committed one (the 130 s timeout case writes after the ~61 s
 * commit) — trading a fabrication for data loss.
 *
 * Consumed at `hooks/useScenario.ts`'s `persistGraphNow`, which its own header
 * declares is the ONE write code path shared by the debounced autosave, its retry
 * and the flush barrier — so this is a single derived choke point, not a list of
 * call sites to keep in step.
 *
 * Layout is not lost by this: the terminal apply fires a normal save with the
 * settled graph. In the `unsettled` case the DB keeps CEE's own committed graph,
 * which is the same position-free shape every AI edit already reloads from.
 */
export function shouldPersistGraphForScenario(currentScenarioId: string | null): boolean {
  const phase = draftStreamPhaseFor(useDraftStore.getState(), currentScenarioId)
  return !draftValuesAreUnsettled(phase)
}

/**
 * Is a streamed GRAPH_READY preview from THIS turn currently standing on THIS
 * scenario's canvas? (review F1, adjacent finding.)
 *
 * Consumed by the 130 s timeout handler, which must not tell the user "your
 * message has not gone through" when it demonstrably did: the server produced and
 * validated a graph, the client rendered it, and per #751 the turn continues and
 * commits. The generic timeout copy, the `deliveryState: 'failed'` marker and the
 * timeout send-failure are all false in that state, and would contradict the
 * honest notice the abort path is about to add.
 *
 * Extracted rather than inlined so the decision is testable at all — the timeout
 * itself is a 130 s wall-clock branch, which is exactly the kind of code that
 * ships untested and rots.
 */
export function streamedPreviewStandingFor(
  state: Pick<DraftState, 'draftStreamPhase' | 'draftStreamScenarioId' | 'draftStreamTurnId'>,
  turnClientId: string,
  currentScenarioId: string | null,
): boolean {
  if (state.draftStreamTurnId !== turnClientId) return false
  return draftStreamPhaseFor(state, currentScenarioId) === 'settling'
}

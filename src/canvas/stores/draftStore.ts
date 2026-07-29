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
 *   `unsettled` — terminal, and the honest failure state. The stream died after
 *                 GRAPH_READY and the buffered fallback found the turn already
 *                 committed, so CEE declined to re-draft: the structure on
 *                 screen is real, its numbers are the in-progress ones, and
 *                 this session will not receive the settled set. Narrating
 *                 anything else would be a fabrication.
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
   * Move the streamed draft's phase. `turnId` is the owning `client_turn_id`;
   * pass `null` alongside `'idle'` to release ownership.
   */
  setDraftStreamPhase: (phase: DraftStreamPhase, turnId: string | null) => void
  /** Reset every field to initial values. Called from canvas-store resetCanvas. */
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

  setDraftStreamPhase: (phase, turnId) => {
    set({ draftStreamPhase: phase, draftStreamTurnId: phase === 'idle' ? null : turnId })
  },

  resetDraft: () => {
    set(initialDraftState)
  },
}))

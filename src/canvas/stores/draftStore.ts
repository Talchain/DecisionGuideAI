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

  resetDraft: () => {
    set(initialDraftState)
  },
}))

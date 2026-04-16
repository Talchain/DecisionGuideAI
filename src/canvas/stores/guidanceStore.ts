/**
 * Guidance Store — cross-surface focus state for GuidanceItems
 *
 * Holds the latest guidance_items from the OrchestratorResponseEnvelopeV2
 * and tracks the currently focused item across the strip, inspector, and canvas.
 */
import { create } from 'zustand'

// ---------------------------------------------------------------------------
// § 1 — CEE contract types
// ---------------------------------------------------------------------------

export type GuidanceCategory = 'must_fix' | 'should_fix' | 'could_fix' | 'technique'
export type GuidanceSource = 'analysis' | 'structural' | 'prompt'
export type EvidenceStrength = 'strong' | 'medium' | 'weak' | 'mixed'

export interface GuidanceTargetObject {
  type: 'node' | 'edge' | 'option' | 'graph' | 'framing'
  id?: string
  label?: string
}

export type GuidanceAction =
  | { type: 'approve_patch'; operations: Record<string, unknown>[] }
  | { type: 'open_inspector'; node_id: string; field?: string }
  | { type: 'discuss'; prompt: string }
  | { type: 'run_exercise'; exercise: 'pre_mortem' | 'devil_advocate' | 'disconfirmation' }
  | { type: 'navigate'; target: string }

export interface GuidanceItem {
  item_id: string
  signal_code: string
  category: GuidanceCategory
  source: GuidanceSource
  title: string
  detail?: string
  primary_action: GuidanceAction
  target_object?: GuidanceTargetObject
  /**
   * Optional additional elements this item is relevant to (e.g. a
   * WEAKLY_CONNECTED_NODE signal referencing both the weakly-connected node
   * and its isolated neighbours). Inspectors match `id` against the currently
   * selected element in addition to `target_object.id`.
   */
  related_elements?: Array<{ id?: string; type?: string; label?: string }>
  valid_while?: { analysis_hash?: string; graph_hash?: string }
  fact_ids?: string[]
  citations?: string[]
  /** 0–100, higher = more urgent */
  priority: number
  dsk_claim_id?: string
  evidence_strength?: EvidenceStrength
}

// ---------------------------------------------------------------------------
// § 2 — Store state and actions
// ---------------------------------------------------------------------------

export interface GuidanceState {
  guidanceItems: GuidanceItem[]
  activeGuidanceItemId: string | null
  /** Task 3: Deep-link field target for inspector scroll-to-field */
  inspectorDeepLinkField: string | null
  /** Registered by ConversationPanel so inspector actions can send messages */
  _sendMessage: ((text: string) => void) | null
  /** Registered by ConversationPanel so cross-surface Analyse CTAs can trigger the hidden run path */
  _runAnalysis: (() => void) | null
  /** Registered by ConversationPanel so evidence blocks can send chip-style turns (display/submitted separation) */
  _sendChip: ((label: string, message: string) => void) | null
  /** Registered by ConversationPanel so inspector actions can scroll to a patch block */
  _scrollToPatch: ((patchId: string) => void) | null
  /** Registered by ConversationPanel so inspector "Ask about this" can pre-fill chat input */
  _prefillChat: ((text: string) => void) | null
  /** Registered by ConversationPanel — unified action dispatch with chip_metadata */
  _dispatchAction: ((opts: { action_type?: string; parameters?: Record<string, unknown>; label: string; message: string; hidden?: boolean; source: string }) => void) | null
}

export interface GuidanceActions {
  /** Replace array with items from a new envelope. Clears stale activeGuidanceItemId. */
  setGuidanceItems: (items: GuidanceItem[]) => void
  /** Clear all guidance (on local graph edits). */
  clearGuidanceItems: () => void
  /** Set the focused item. Pass null to clear. */
  setActiveGuidanceItem: (itemId: string | null) => void
  /** Register conversation callbacks (called from ConversationPanel on mount). */
  registerConversationCallbacks: (
    sendMessage: (text: string) => void,
    scrollToPatch: (patchId: string) => void,
    sendChip?: (label: string, message: string) => void,
    runAnalysis?: () => void,
    prefillChat?: (text: string) => void,
    dispatchAction?: (opts: { action_type?: string; parameters?: Record<string, unknown>; label: string; message: string; hidden?: boolean; source: string }) => void,
  ) => void
  /**
   * Evict items whose valid_while hashes no longer match the current state.
   *
   * Rules:
   * - Items with no valid_while are always kept.
   * - Items with valid_while.analysis_hash set: cleared if currentAnalysisHash
   *   differs OR if currentAnalysisHash is null/undefined (can't verify).
   * - Items with valid_while.graph_hash set: cleared when any structural graph
   *   change occurs (caller passes graphChanged=true). If graphChanged is false,
   *   only analysis_hash is checked.
   */
  evictStaleItems: (opts: {
    currentAnalysisHash: string | null | undefined
    graphChanged?: boolean
  }) => void
  /**
   * Remove guidance items whose target_object matches any of the provided IDs.
   * Only clears items where target_object.type is 'node' or 'edge'.
   * Items without target_object or with other target types are never cleared.
   */
  clearItemsByTargetIds: (ids: string[]) => void
  /** Remove a single guidance item by item_id (e.g. after user acts on a chip). */
  dismissItem: (itemId: string) => void
}

const initialGuidanceState: GuidanceState = {
  guidanceItems: [],
  activeGuidanceItemId: null,
  inspectorDeepLinkField: null,
  _sendMessage: null,
  _runAnalysis: null,
  _sendChip: null,
  _scrollToPatch: null,
  _dispatchAction: null,
  _prefillChat: null,
}

export const useGuidanceStore = create<GuidanceState & GuidanceActions>((set, get) => ({
  ...initialGuidanceState,

  setGuidanceItems: (items) => {
    const { activeGuidanceItemId } = get()
    const newIds = new Set(items.map((i) => i.item_id))
    set({
      guidanceItems: items,
      // Clear stale active ID if it no longer exists in the new array
      activeGuidanceItemId: activeGuidanceItemId && newIds.has(activeGuidanceItemId)
        ? activeGuidanceItemId
        : null,
    })
  },

  clearGuidanceItems: () => {
    set({ guidanceItems: [], activeGuidanceItemId: null })
  },

  setActiveGuidanceItem: (itemId) => {
    set({ activeGuidanceItemId: itemId })
  },

  registerConversationCallbacks: (sendMessage, scrollToPatch, sendChip, runAnalysis, prefillChat, dispatchAction) => {
    set({
      _sendMessage: sendMessage,
      _runAnalysis: runAnalysis ?? null,
      _scrollToPatch: scrollToPatch,
      _sendChip: sendChip ?? null,
      _prefillChat: prefillChat ?? null,
      _dispatchAction: dispatchAction ?? null,
    })
  },

  evictStaleItems: ({ currentAnalysisHash, graphChanged = false }) => {
    const { guidanceItems, activeGuidanceItemId } = get()
    if (guidanceItems.length === 0) return

    const surviving = guidanceItems.filter((item) => {
      const vw = item.valid_while
      if (!vw) return true // no constraint → always valid

      // Check graph_hash: if set, evict on any graph change or when unknown
      if (vw.graph_hash !== undefined) {
        if (graphChanged) return false
        // If we have a graph_hash but no current graph hash to compare against,
        // treat as stale (can't verify)
        // Note: we only clear on graphChanged here; stale-at-unknown is handled
        // by the fact that graphChanged=true is always passed on model edits.
      }

      // Check analysis_hash: evict when currentAnalysisHash differs or is unknown
      if (vw.analysis_hash !== undefined) {
        if (currentAnalysisHash == null) return false // can't verify → stale
        if (currentAnalysisHash !== vw.analysis_hash) return false
      }

      return true
    })

    if (surviving.length === guidanceItems.length) return // nothing to evict

    const survivingIds = new Set(surviving.map((i) => i.item_id))
    set({
      guidanceItems: surviving,
      activeGuidanceItemId: activeGuidanceItemId && survivingIds.has(activeGuidanceItemId)
        ? activeGuidanceItemId
        : null,
    })
  },

  dismissItem: (itemId) => {
    const { guidanceItems, activeGuidanceItemId } = get()
    const surviving = guidanceItems.filter((item) => item.item_id !== itemId)
    if (surviving.length === guidanceItems.length) return
    set({
      guidanceItems: surviving,
      activeGuidanceItemId: activeGuidanceItemId === itemId ? null : activeGuidanceItemId,
    })
  },

  clearItemsByTargetIds: (ids) => {
    if (ids.length === 0) return
    const { guidanceItems, activeGuidanceItemId } = get()
    if (guidanceItems.length === 0) return

    const idSet = new Set(ids)
    const CLEARABLE_TYPES = new Set(['node', 'edge'])

    const surviving = guidanceItems.filter((item) => {
      const target = item.target_object
      if (!target) return true // no target → never cleared by this mechanism
      if (!CLEARABLE_TYPES.has(target.type)) return true // only clear node/edge targets
      // Clear if target_object.id matches. Items with clearable type but no
      // target.id are preserved (orphaned/graph-level items should not be
      // cleared by element-specific edits).
      if (target.id && idSet.has(target.id)) return false
      // Also clear if any related_elements[].id matches — prevents stale
      // coaching when a related node/edge is edited (e.g. WEAKLY_CONNECTED_NODE
      // referencing isolated neighbours).
      if (item.related_elements?.some(r => r.id && idSet.has(r.id))) return false
      return true
    })

    if (surviving.length === guidanceItems.length) return // nothing to clear

    const survivingIds = new Set(surviving.map((i) => i.item_id))
    set({
      guidanceItems: surviving,
      activeGuidanceItemId: activeGuidanceItemId && survivingIds.has(activeGuidanceItemId)
        ? activeGuidanceItemId
        : null,
    })
  },
}))

// ---------------------------------------------------------------------------
// § 3 — Selectors
// ---------------------------------------------------------------------------

export const selectGuidanceItems = (state: GuidanceState) => state.guidanceItems

export const selectActiveGuidanceItemId = (state: GuidanceState) => state.activeGuidanceItemId

/** Returns the full GuidanceItem for the active ID, or null. */
export function selectActiveItem(state: GuidanceState): GuidanceItem | null {
  if (!state.activeGuidanceItemId) return null
  return state.guidanceItems.find((i) => i.item_id === state.activeGuidanceItemId) ?? null
}

/** Returns items where target_object.id matches the given targetId. */
export function selectItemsForTarget(state: GuidanceState, targetId: string): GuidanceItem[] {
  return state.guidanceItems.filter((i) => i.target_object?.id === targetId)
}

/** Returns the single highest-priority item (or null if empty). */
export function selectTopItem(state: GuidanceState): GuidanceItem | null {
  if (state.guidanceItems.length === 0) return null
  return state.guidanceItems.reduce((best, item) =>
    item.priority > best.priority ? item : best,
  )
}

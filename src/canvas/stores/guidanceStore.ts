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
  | { type: 'open_inspector'; node_id: string }
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
  /** Registered by ConversationPanel so inspector actions can send messages */
  _sendMessage: ((text: string) => void) | null
  /** Registered by ConversationPanel so inspector actions can scroll to a patch block */
  _scrollToPatch: ((patchId: string) => void) | null
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
  ) => void
}

const initialGuidanceState: GuidanceState = {
  guidanceItems: [],
  activeGuidanceItemId: null,
  _sendMessage: null,
  _scrollToPatch: null,
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

  registerConversationCallbacks: (sendMessage, scrollToPatch) => {
    set({ _sendMessage: sendMessage, _scrollToPatch: scrollToPatch })
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

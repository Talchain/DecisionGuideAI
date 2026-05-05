/**
 * Conversation status selector — single source of truth for ActionStrip state
 *
 * Derives the conversation status from existing stores. Both ActionStrip and
 * any future component use this selector — no independent store scanning.
 */

import type { GuidanceItem } from '../stores/guidanceStore'
import { selectTopItem } from '../stores/guidanceStore'
import type { GuidanceState } from '../stores/guidanceStore'
import type { ConversationMessage, GraphPatchBlock } from './types'
import type { PatchBlockState } from './useConversation'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ConversationStatus =
  | 'empty'
  | 'framing'
  | 'graph_ready'
  | 'patch_pending'
  | 'analysis_running'
  | 'analysis_ready'
  | 'analysis_stale'
  | 'brief_ready'

export type CtaKind =
  | 'view_issues'
  | 'review_patch'
  | 'view_results'
  | 'view_brief'
  | null

export interface ConversationStatusResult {
  status: ConversationStatus
  topGuidanceItem: GuidanceItem | null
  guidanceCount: number
  ctaKind: CtaKind
}

// ---------------------------------------------------------------------------
// Input bag — avoids coupling to Zustand hook signatures
// ---------------------------------------------------------------------------

export interface ConversationStatusInput {
  /** Number of nodes in the canvas graph */
  nodeCount: number
  /** Current results status */
  resultsStatus: 'idle' | 'preparing' | 'connecting' | 'streaming' | 'complete' | 'error' | 'cancelled'
  /** Whether analysis has completed at least once this session */
  hasCompletedFirstRun: boolean
  /** Whether the graph has been structurally edited since the last completed analysis */
  graphEditedSinceLastRun: boolean
  /**
   * P0 V5 golden-path repair (Wave 3 wiring): authoritative wire-side
   * freshness verdict from the most recent CEE turn response. When
   * present and informative ('fresh' | 'stale'), takes precedence over
   * `graphEditedSinceLastRun` — the wire is computed against the
   * canonical graph hash at the time analysis ran, so it's the
   * authoritative answer when both signals disagree. `null` /
   * undefined / 'unknown' / 'none' fall back to the local signal.
   */
  wireFreshness?: 'fresh' | 'stale' | 'unknown' | 'none' | null
  /** Guidance store state snapshot */
  guidance: GuidanceState
  /** Conversation messages */
  messages: ConversationMessage[]
  /** Patch block states map */
  patchBlockStates: Map<string, PatchBlockState>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function resolvePatchBlockState(
  block: GraphPatchBlock,
  patchBlockStates: Map<string, PatchBlockState> | undefined,
  stateKey: string,
): PatchBlockState {
  if (block.auto_apply === true) return 'accepted'

  const localState = patchBlockStates?.get(stateKey)
  if (localState && localState !== 'proposed') return localState

  const backendStatus = typeof block.status === 'string' ? block.status.toLowerCase() : null
  if (backendStatus === 'accepted' || backendStatus === 'applied') return 'accepted'
  if (backendStatus === 'rejected') return 'rejected'
  if (backendStatus === 'dismissed') return 'dismissed'
  if (import.meta.env.DEV && backendStatus !== null && backendStatus !== 'proposed') {
    console.warn('[resolvePatchBlockState] Unrecognized backend patch status "%s" for %s', backendStatus, stateKey)
  }

  return localState ?? 'proposed'
}

function hasPendingPatch(
  messages: ConversationMessage[],
  patchBlockStates: Map<string, PatchBlockState>,
): boolean {
  for (const msg of messages) {
    if (!msg.blocks) continue
    for (const block of msg.blocks) {
      if (block.type !== 'graph_patch') continue
      const patchBlock = block as GraphPatchBlock
      // Composite key matches InlineBlocks: turnId:patchId (or bare patchId if no turnId)
      const stateKey = msg.id ? `${msg.id}:${patchBlock.patch_id}` : patchBlock.patch_id
      const state = resolvePatchBlockState(patchBlock, patchBlockStates, stateKey)
      if (state === 'proposed') return true
    }
  }
  return false
}

function hasBriefBlock(messages: ConversationMessage[]): boolean {
  for (const msg of messages) {
    if (!msg.blocks) continue
    for (const block of msg.blocks) {
      if (block.type === 'brief') return true
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

export function selectConversationStatus(input: ConversationStatusInput): ConversationStatusResult {
  const {
    nodeCount,
    resultsStatus,
    hasCompletedFirstRun,
    graphEditedSinceLastRun,
    wireFreshness,
    guidance,
    messages,
    patchBlockStates,
  } = input

  // P0 V5 golden-path repair (Wave 3 wiring): authoritative staleness
  // signal. Wire freshness wins when present and informative; local
  // edit signal is fallback. Eliminates the disagreement between
  // surfaces that pre-Wave-3 derived staleness independently.
  const isStale =
    wireFreshness === 'fresh'
      ? false
      : wireFreshness === 'stale'
        ? true
        : graphEditedSinceLastRun

  const topGuidanceItem = selectTopItem(guidance)
  const guidanceCount = guidance.guidanceItems.length

  // Determine status (order matters — more specific states first)

  // Analysis actively running
  const isRunning = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'
  if (isRunning) {
    return { status: 'analysis_running', topGuidanceItem, guidanceCount, ctaKind: null }
  }

  // Pending patch takes priority over other states
  if (hasPendingPatch(messages, patchBlockStates)) {
    return { status: 'patch_pending', topGuidanceItem, guidanceCount, ctaKind: 'review_patch' }
  }

  // Brief ready
  if (hasBriefBlock(messages)) {
    return { status: 'brief_ready', topGuidanceItem, guidanceCount, ctaKind: 'view_brief' }
  }

  // Analysis completed — check staleness via the unified isStale signal
  // above (wire freshness wins, local edit signal is fallback).
  if (hasCompletedFirstRun && resultsStatus === 'complete') {
    if (isStale) {
      return { status: 'analysis_stale', topGuidanceItem, guidanceCount, ctaKind: 'view_results' }
    }
    return { status: 'analysis_ready', topGuidanceItem, guidanceCount, ctaKind: 'view_results' }
  }

  // Graph exists but no analysis yet
  if (nodeCount > 0) {
    return {
      status: 'graph_ready',
      topGuidanceItem,
      guidanceCount,
      ctaKind: guidanceCount > 0 ? 'view_issues' : null,
    }
  }

  // Framing or empty
  if (messages.length > 0) {
    return { status: 'framing', topGuidanceItem, guidanceCount, ctaKind: null }
  }

  return { status: 'empty', topGuidanceItem, guidanceCount, ctaKind: null }
}

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
import type { FreshnessDisplaySemantic } from '../store/analysisFreshness'

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
  /**
   * The composed trust semantic (`useAnalysisTrust().semantic`) — the single
   * source the visible "Results outdated" status derives from (=== 'changed').
   * The caller supplies it from the composed hook so this surface can never
   * drift from the freshness strip: it never independently derives stale from
   * the local edit flag, and a CEE-unknown verdict never fabricates 'outdated'.
   */
  trustSemantic: FreshnessDisplaySemantic
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

/**
 * SETTLEMENT KEY FOR A HELD PROPOSAL — bound by PROPOSAL IDENTITY.
 *
 * ── The defect this closes (SENDABLE failure 5, witnessed 2026-08-22) ───────
 * `V5HeldProposalBlock` owned its settled/unsettled state in a component-local
 * `useState`. Two surfaces are mounted at once on the canvas (the dock's
 * `OlumiTabBody` and `FloatingOlumiPanel`, both reading the SAME singleton
 * `useConversationContext()` message list), so ONE proposal renders as TWO OR
 * MORE React instances. Local state cannot cross an instance boundary, so
 * confirming in one surface left every other copy with live controls, an
 * unchanged "Waiting for your go-ahead" heading, and a confirm button that
 * re-fired into a refusal. The card was answering "did the user click THIS
 * React node?" while the user, the server and every other copy were asking
 * "has this PROPOSAL been settled?" — two authorities, similar names.
 *
 * There is exactly ONE settlement authority in this conversation:
 * `useConversation`'s `patchBlockStates` map (`PatchBlockState`), written via
 * `setPatchBlockState` and read by `resolvePatchBlockState` above. Held
 * proposals converge onto it rather than minting a second registry.
 *
 * ⚠ WHY THE KEY IS NOT `turnId:proposal_id`, unlike the graph-patch key.
 * A graph patch is identified by its position in a turn. A held proposal is a
 * CEE-minted hold HANDLE (`gmh_…`) whose lifecycle is owned SERVER-side, per
 * handle, across turns: confirming it retires the hold itself, not one turn's
 * view of it. Keying by turn would let the same handle read `proposed` in one
 * turn and `accepted` in another — precisely the split this closes. So the key
 * is the handle, and only the handle.
 *
 * The `held:` prefix keeps the two key spaces disjoint inside the one map, so
 * a `patch_id` can never collide with a `proposal_id`.
 */
export const HELD_PROPOSAL_STATE_KEY_PREFIX = 'held:'

export function heldProposalStateKey(proposalId: string): string {
  return `${HELD_PROPOSAL_STATE_KEY_PREFIX}${proposalId}`
}

/**
 * Resolve a held proposal's settlement from the shared registry.
 *
 * Unlike `resolvePatchBlockState` there is no producer-supplied `status` to
 * consult: `HeldProposalBlockSchema` carries no status field, so the block
 * itself never asserts settlement and the local registry is the only reader.
 * Absent ⇒ `'proposed'`, i.e. exactly today's behaviour for a fresh proposal.
 */
export function resolveHeldProposalState(
  proposalId: string,
  patchBlockStates: Map<string, PatchBlockState> | undefined,
): PatchBlockState {
  return patchBlockStates?.get(heldProposalStateKey(proposalId)) ?? 'proposed'
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
    trustSemantic,
    guidance,
    messages,
    patchBlockStates,
  } = input

  // Single source of truth: the composed trust semantic. 'changed' (CEE
  // 'stale' OR a retained-fresh-now-dirtied) is the only state that renders
  // "Results outdated"; 'cannot_confirm' (CEE-unknown / orphan fold) and
  // 'current'/'none' do not — so this surface never fabricates stale, and
  // never independently derives it from `graphEditedSinceLastRun`.
  const isStale = trustSemantic === 'changed'

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

  // Analysis completed — check staleness via the composed isStale signal
  // above (trustSemantic === 'changed'; no local-flag fallback).
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

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
 * ═══ HELD-PROPOSAL SETTLEMENT: TWO QUESTIONS, NAMED APART ═══════════════════
 *
 * ── The defect this closes (SENDABLE failure 5, witnessed 2026-08-22) ───────
 * `V5HeldProposalBlock` owned its settled/unsettled state in a component-local
 * `useState`. Two surfaces are mounted at once on the canvas (the dock's
 * `OlumiTabBody` and `FloatingOlumiPanel`, both reading the SAME singleton
 * `useConversationContext()` message list), so ONE proposal renders as TWO OR
 * MORE React instances. Local state cannot cross an instance boundary, so
 * confirming in one surface left every other copy with live controls, an
 * unchanged "Waiting for your go-ahead" heading, and a confirm button that
 * re-fired into a refusal.
 *
 * There is exactly ONE settlement authority in this conversation:
 * `useConversation`'s `patchBlockStates` map (`PatchBlockState`), written via
 * `setPatchBlockState` and read by `resolvePatchBlockState` above. Held
 * proposals converge onto it rather than minting a second registry.
 *
 * ── ⚠ AND THE DEFECT THAT KEYING ON THE BARE HANDLE INTRODUCED ─────────────
 * The first cut of this fix keyed settlement on the proposal handle ALONE,
 * deliberately turn-independent. That merges two DIFFERENT questions (trap 21),
 * and the merge is unsound because THE HANDLE IS NOT UNIQUE PER OFFER.
 *
 * Derived at the CEE bytes (`olumi-assistants-service` @ `d1da6706`,
 * `src/orchestrator-v5/handlers/edit-graph-referee-gate.ts:696-702`):
 *
 *     gmHeldProposalRef(scenarioId, targetKey)
 *       = `gmh_` + sha256(`${scenarioId}:${targetKey}`).slice(0, 12)
 *
 * No nonce, no turn, no timestamp — and its own comment says why: "A NEWER
 * held offer for the SAME target gets the SAME handle, so the commit
 * carry-forward's same-key supersession rule retires the older one." The target
 * key collapses harder still: `mutationTargetKey`
 * (`graph-management/pending-projection.ts:98-121`) returns `node:<id>` for
 * FIVE ops alike: `add_node`, `rename_node`, `update_node_field`,
 * `remove_node` AND `add_option` (`pending-projection.ts:106-107`).
 *
 * ⚠ This enumeration is a HAND-MAINTAINED MIRROR of a CEE switch — the exact
 * defect class trap 12 names — and it drifted within one PR: an independent
 * review found it stating four while the producer collapsed five. It is kept
 * because the collapse is the whole reason the handle names a SLOT, and a
 * reader who believes it is four will mis-reason about `add_option`. Re-derive
 * at `mutationTargetKey` before relying on the count; do not trust this line.
 *
 * So the handle names a SLOT — "the current hold against this target" — not an
 * OFFER INSTANCE. Re-issuance IS the supersession mechanism, not an accident,
 * which is why the honest fix is here and not a nonce in CEE: a nonce would
 * break the §6.7 same-key supersession contract the handle exists to serve.
 *
 * Keyed on the bare handle, a settlement therefore leaks forward in time onto a
 * genuinely NEW offer: dismiss "remove the Pricing node", and CEE's later
 * "rename the Pricing node" mounts already settled — no confirm, no dismiss,
 * heading "No longer waiting for your go-ahead". The chip row cannot rescue it
 * either, because `buildSuggestedActionChips` suppresses a held_proposal's
 * confirm/decline ids on any turn carrying such a block, settled or not. ZERO
 * affordance for a proposal CEE has freshly issued.
 *
 * ── THE TWO QUESTIONS ──────────────────────────────────────────────────────
 * · MOUNT — "should THIS card instance render as settled?" Per turn, per
 *   proposal. Answered by {@link heldProposalMountKey} /
 *   {@link resolveHeldProposalState}. This is the same scoping the graph-patch
 *   consent card has always used (`GraphPatchBlockRenderer`: `${turnId}:${patch_id}`),
 *   and message ids are stable for the life of a message (`updateMessage`
 *   patches by id and never rewrites it), so the scope is durable.
 *
 * · RETIREMENT — "which mounted copies does settling this proposal retire?"
 *   Answered by {@link heldProposalRetirementKeys}, ONCE, at settle time.
 *   Every copy of the handle AT OR BEFORE the acting turn — both surfaces, and
 *   every earlier turn that re-issued it — retires together. Copies on LATER
 *   turns keep their own offer, whether that turn was already on screen or
 *   arrives afterwards.
 *
 *   ⚠ This sentence used to read "Turns that arrive AFTERWARDS have no entry",
 *   which described the snapshot and not the sweep: the sweep walked EVERY
 *   message and compared nothing against the acting turn, so a later turn
 *   already in the transcript was retired with the earlier one. The comment
 *   asserted the invariant the code did not implement — worth naming, because
 *   a doc comment that states the intended predicate is exactly where a reader
 *   stops checking (CLAUDE.md trap 12: the hand-maintained mirror).
 *
 * The invariant the pair implements, and the only one worth reading:
 *
 *     A held proposal offers an affordance IF AND ONLY IF it is unresolved
 *     ON THE TURN IT IS MOUNTED.
 *
 * Both directions are load-bearing and they are opposite harms: a resolved
 * proposal still offering an action is a lie that ends in a refusal; an
 * unresolved proposal offering none is a dead end. One predicate cannot guard
 * both doors (trap 22b) — which is why there are two functions here, not one
 * with a wider window.
 *
 * ⚠ NOT the remedy: "clear the key when a later turn re-issues the handle".
 * Clearing frees the LATER card by RESURRECTING the earlier one, re-opening the
 * stale-live harm in the other direction. Pinned as its own case in
 * `__tests__/heldProposalSettlement.acrossTurns.spec.tsx`.
 *
 * The `held:` prefix keeps the two key spaces disjoint inside the one map, so
 * a `patch_id` can never collide with a `proposal_id`.
 */
export const HELD_PROPOSAL_STATE_KEY_PREFIX = 'held:'

/**
 * THE MOUNT QUESTION. The registry key for one held-proposal card, scoped to
 * the turn it is mounted in.
 *
 * `turnId` absent ⇒ the bare handle, mirroring `GraphPatchBlockRenderer`'s own
 * fallback for a message with no id. Read and write must agree on this, so both
 * sides go through here rather than composing the string themselves.
 */
export function heldProposalMountKey(
  turnId: string | undefined,
  proposalId: string,
): string {
  return turnId
    ? `${HELD_PROPOSAL_STATE_KEY_PREFIX}${turnId}:${proposalId}`
    : `${HELD_PROPOSAL_STATE_KEY_PREFIX}${proposalId}`
}

/**
 * Resolve a held proposal's settlement for the turn it is mounted in.
 *
 * Unlike `resolvePatchBlockState` there is no producer-supplied `status` to
 * consult: `HeldProposalBlockSchema` carries no status field, so the block
 * itself never asserts settlement and the local registry is the only reader.
 * Absent ⇒ `'proposed'`, i.e. exactly today's behaviour for a fresh proposal.
 */
export function resolveHeldProposalState(
  turnId: string | undefined,
  proposalId: string,
  patchBlockStates: Map<string, PatchBlockState> | undefined,
): PatchBlockState {
  return patchBlockStates?.get(heldProposalMountKey(turnId, proposalId)) ?? 'proposed'
}

/**
 * THE RETIREMENT QUESTION. Every registry key that settling `proposalId` must
 * write, derived from the transcript AS IT STANDS AT THIS MOMENT.
 *
 * Membership is by PROPOSAL IDENTITY (`block.proposal_id === proposalId`),
 * never by summary, position or ordinal — the same handle deliberately carries
 * different summaries on different turns, so any content predicate would bind
 * to the wrong card (trap 19).
 *
 * `actingTurnId` is the turn whose card the user actually pressed. It is
 * included unconditionally, so the card the user acted on retires even if it
 * could not be found in `messages` — failing towards "the pressed card is
 * settled", never towards leaving a live control over a resolved hold.
 *
 * WHY THE TRANSCRIPT IS SNAPSHOTTED RATHER THAN CONSULTED AT READ TIME: a turn
 * that does not exist yet cannot be in this list, and that absence is precisely
 * what keeps a freshly-issued offer live. Reading the transcript at render time
 * instead would settle later turns too.
 *
 * ── ⚠ AND WHY SNAPSHOTTING ALONE WAS NOT ENOUGH ────────────────────────────
 * The snapshot excludes only turns that DO NOT EXIST YET. A later turn already
 * in the transcript is settled anyway, and that is the ordinary case: the user
 * asks to remove the Pricing node, changes their mind and asks to rename it,
 * CEE re-mints the same handle, and both cards sit on screen. Tidying away the
 * stale REMOVE card then retired the live RENAME card with it — the fresh-dead
 * harm, reached by position in the transcript rather than by time.
 *
 * The sweep is therefore BOUNDED AT THE ACTING TURN'S POSITION. `messages` is
 * the array the thread renders in order, so index IS on-screen order; this is
 * the same ordering the reader can see, not a second notion of time.
 *
 *   · index <  acting — an EARLIER re-issue of the handle. Already superseded
 *     server-side by the acting turn's own hold (CEE §6.7 same-key
 *     supersession), so leaving it live is the stale-live lie. Retired.
 *   · index == acting — the card the user pressed, on every surface. Retired.
 *   · index >  acting — a LATER offer CEE has issued against the same target
 *     slot. A change the user has not resolved. Left live.
 *
 * `actingTurnId` absent ⇒ no position to bound at, and the caller is a message
 * with no id; the sweep stays unbounded, exactly as before.
 *
 * `actingTurnId` present but NOT LOCATABLE in `messages` ⇒ ordering is
 * unknowable, so the sweep does nothing and only the pressed card retires. The
 * two harms are not symmetric and that asymmetry picks the direction: a
 * stale-live card costs one explicit CEE refusal that writes nothing, whereas a
 * wrongly-retired card costs EVERY affordance on its turn —
 * `heldProposalConsumedActionIds` (`suggestedActionChips.ts:50-61`) suppresses
 * a turn's confirm/decline chip ids whenever a held_proposal block is present,
 * settled or not, so there is no fallback for the card to fall back to.
 */
export function heldProposalRetirementKeys(
  messages: readonly ConversationMessage[],
  proposalId: string,
  actingTurnId?: string,
): string[] {
  const keys: string[] = []
  const add = (key: string): void => {
    if (!keys.includes(key)) keys.push(key)
  }

  if (actingTurnId !== undefined) add(heldProposalMountKey(actingTurnId, proposalId))

  // The bound. `findIndex` returns -1 for an acting turn that is not on screen,
  // which stops the sweep entirely — see the unlocatable case above.
  const lastIndex =
    actingTurnId === undefined
      ? messages.length - 1
      : messages.findIndex((message) => message.id === actingTurnId)

  for (let i = 0; i <= lastIndex; i += 1) {
    const message = messages[i]
    if (!message.blocks) continue
    for (const block of message.blocks) {
      if (block.type !== 'v5_held_proposal') continue
      if (block.proposal_id !== proposalId) continue
      add(heldProposalMountKey(message.id, proposalId))
      break
    }
  }

  return keys
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

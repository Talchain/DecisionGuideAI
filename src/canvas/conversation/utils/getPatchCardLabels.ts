/**
 * getPatchCardLabels — Derives card header text and status badge from resolved
 * patch block state. Replaces hardcoded "Changes applied" / "Review suggested
 * changes" / "Applied" strings with state-driven labels.
 *
 * Used by GraphPatchBlockRenderer (InlineBlocks.tsx).
 */

import type { PatchBlockState } from '../useConversation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardState =
  | 'proposed'
  | 'accepted'
  | 'auto_applied'
  | 'rejected'
  | 'dismissed'
  | 'error'

export interface CardBadge {
  /** Lucide icon name — caller resolves to the React component */
  icon: 'check' | 'x' | 'alert-triangle'
  /** Tailwind semantic colour class */
  colour: string
}

export interface PatchCardLabels {
  header: string
  badge: CardBadge | null
}

// ---------------------------------------------------------------------------
// Resolve the display-level card state from the patch block's resolved state,
// auto_apply flag, and error context.
// ---------------------------------------------------------------------------

export function resolveCardState(
  resolvedPatchState: PatchBlockState,
  autoApply: boolean,
  hasNetworkError: boolean,
): CardState {
  if (hasNetworkError && resolvedPatchState === 'proposed') return 'error'
  if (autoApply) return 'auto_applied'
  return resolvedPatchState
}

// ---------------------------------------------------------------------------
// Map card state → header text + optional badge
// ---------------------------------------------------------------------------

const LABEL_MAP: Record<CardState, PatchCardLabels> = {
  proposed:     { header: 'Suggested change',    badge: null },
  accepted:     { header: 'Change accepted',     badge: { icon: 'check', colour: 'text-success' } },
  auto_applied: { header: 'Model updated',       badge: { icon: 'check', colour: 'text-success' } },
  rejected:     { header: 'Change rejected',     badge: { icon: 'x', colour: 'text-danger' } },
  dismissed:    { header: 'Change dismissed',     badge: null },
  error:        { header: 'Something went wrong', badge: { icon: 'alert-triangle', colour: 'text-danger' } },
}

export function getPatchCardLabels(cardState: CardState): PatchCardLabels {
  return LABEL_MAP[cardState]
}

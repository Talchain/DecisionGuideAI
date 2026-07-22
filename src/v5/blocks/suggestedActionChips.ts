/**
 * suggestedActionChips — build the turn's generic suggested-action chip row
 * from a V5 response, with the F4 single-confirm-owner rule applied.
 *
 * F4 (held-proposal confirm affordance renders once):
 *   On a held-proposal turn CEE emits EXACTLY ONE confirm chip in
 *   `suggested_actions`, and the `held_proposal` block references THAT SAME
 *   chip by id (`confirm_action_id`, and optionally `decline_action_id`) —
 *   single-sourced on the wire (HeldProposalBlockSchema: "This block never
 *   embeds its own action object, so the chip is never duplicated on the
 *   wire."). The held-proposal CARD (V5HeldProposalBlock) resolves those refs
 *   and renders the confirm / decline buttons — it is the SINGLE OWNER of the
 *   affordance, because it carries the mutation context the user is confirming
 *   (mirrors the repo's C1 "single Rerun owner" doctrine).
 *
 *   Without this module the SAME action was ALSO emitted into the generic
 *   `suggested_actions` chip row, so the user saw the confirm twice. We drop
 *   from the chip row exactly the ids a held_proposal block on the SAME turn
 *   consumes — keyed on the REFERENCED ids, never on `action_type`: other
 *   turns legitimately render chips of the same action_type, so only the exact
 *   ids a held_proposal references may be suppressed.
 *
 *   Fail-safe: a turn with no held_proposal block yields an empty consumed set,
 *   so the chip row is byte-for-byte unchanged everywhere else (zero behaviour
 *   change off the held-proposal path). An unresolvable confirm/decline ref is
 *   a no-op here too — the id it names is, by definition, absent from
 *   `suggested_actions`, so filtering by it removes nothing (the same
 *   fail-closed alignment mapV5Blocks already has when it degrades an
 *   unresolvable held_proposal to the R7 unsupported card).
 *
 *   The legacy diagnostic error block that rides the held turn
 *   (`type:"error"`, `severity:"warn"`) is NOT a chip source: mapV5Block
 *   returns null for it, so it contributes no affordance and needs no
 *   suppression here.
 */
import type { OlumiResponse } from '@talchain/schemas/boundary'

import type { ActionChip } from '../../canvas/conversation/types'

type V5Block = OlumiResponse['blocks'][number]
type SuggestedActionRef = OlumiResponse['suggested_actions'][number]

/**
 * Ids of top-level `suggested_actions` that held_proposal blocks on this turn
 * consume as their confirm / decline affordance. The held-proposal CARD owns
 * those affordances, so the generic chip row must not also render them.
 *
 * Empty when the turn carries no held_proposal block (the fail-safe path).
 */
export function heldProposalConsumedActionIds(
  blocks: readonly V5Block[] = [],
): ReadonlySet<string> {
  const consumed = new Set<string>()
  const list = Array.isArray(blocks) ? blocks : []
  for (const block of list) {
    if (block.type !== 'held_proposal') continue
    consumed.add(block.confirm_action_id)
    if (block.decline_action_id) consumed.add(block.decline_action_id)
  }
  return consumed
}

/**
 * Map a V5 response's top-level `suggested_actions[]` to the UI `ActionChip[]`
 * that the SuggestedChips row renders, excluding any action a held_proposal
 * block on the same turn already owns (F4 single confirm owner). SuggestedChips
 * additionally caps rendering at 3 (ruled doctrine D-K); this function does not
 * cap — it only maps and applies the ownership filter.
 */
export function buildSuggestedActionChips(
  blocks: readonly V5Block[] = [],
  suggestedActions: readonly SuggestedActionRef[] = [],
): ActionChip[] {
  const consumed = heldProposalConsumedActionIds(blocks)
  const actions = Array.isArray(suggestedActions) ? suggestedActions : []
  return actions
    .filter((a) => !consumed.has(a.id))
    .map((a) => ({
      id: a.id,
      label: a.label,
      intent: 'primary' as const,
      message: a.message,
      ...(a.action_type ? { action_type: a.action_type } : {}),
    }))
}

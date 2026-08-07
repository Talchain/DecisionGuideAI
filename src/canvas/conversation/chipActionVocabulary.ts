/**
 * chipActionVocabulary — WHICH `action_type` a CEE-suggested chip may render
 * with. DERIVED. Never a hand list.
 *
 * ─── The defect this module exists to close (ROADMAP 2.668) ────────────────
 * `V5_ENABLED_ACTIONS` lived in `SuggestedChips.tsx` as a hand-maintained
 * allowlist of seven strings. It was missing `add_constraint`,
 * `set_factor_value` and `adjust_edge_strength` — which is to say, ALL THREE
 * of CEE's registered graph-mutation handlers, i.e. every chip the
 * propose-confirm channel can mint. Consequence, measured end-to-end on
 * 2026-08-07 (CEE #839's F-A probe, at UI `d18ac8b9`): CEE emitted the #836
 * demotion chip correctly — `suggested_actions:[{action_type:'add_constraint',
 * …}]` with its paired `pending_actions` confirmation — the chip travelled the
 * whole wire, and the UI's filter deleted it on arrival. The ENTIRE
 * propose-confirm consent channel was dark UI-side, for every producer, and
 * the only user-visible symptom was prose where a button should have been:
 * offer → "yes, please" → "You did not ask me to edit the model".
 *
 * The 2026-08-06 live consent witness recorded the same fact from the other
 * side: "Still NO propose-confirm CHIP anywhere — every demotion so far
 * arrives as prose". The chip was never missing. It was filtered.
 *
 * ─── Why a list could not survive, and what replaces it ────────────────────
 * The list was the dominant Olumi defect class (trap 12: the hand-maintained
 * mirror). It drifted silently, and the drift read as green — there was even a
 * spec PINNING the six exclusions as correct, with prose reasons that had gone
 * false. Adding three strings would have re-armed exactly the same trap.
 *
 * So the set is derived from the two facts that actually decide whether
 * rendering a chip is HONEST — meaning a click does what the chip's label
 * promises rather than degrading into an ordinary chat turn:
 *
 *   1. THE CLICK REACHES CEE WITH ITS INTENT INTACT.
 *      `buildPayload.sanitiseActionType` sends an `action_type` only when it is
 *      BOTH published in the enum we vendored (`KNOWN_ACTION_TYPES`, itself
 *      derived from `@talchain/schemas`) AND accepted at CEE's ingress
 *      (`CEE_ACCEPTED_ACTION_TYPES`). A value failing that gate is STRIPPED at
 *      the wire: CEE would receive the message with no typed action at all, and
 *      the chip would be a promise the transport already broke.
 *
 *   2. THE CLICK DISPATCHES TO A TURN TYPE CHOSEN FOR IT.
 *      `ACTION_TO_TURN_TYPE` is consulted by `dispatchAction`; an action absent
 *      from it falls through to the `'conversation'` default. That is the
 *      "promises action, delivers default routing" case the old spec's own
 *      comment named as the reason to exclude `explain_from_structure`.
 *
 * Both conjuncts are read from live code, so the set cannot drift from them.
 * The exclusions are now DERIVED and self-repairing: `explain_from_structure`
 * stays out because nothing maps it — and lights up the moment someone adds
 * the mapping, which is precisely what that old comment asked a future author
 * to remember to do by hand.
 *
 * ─── The safety property this KEEPS (ROADMAP 2.668 I-D) ────────────────────
 * The allowlist existed partly so an UNKNOWN action_type never renders as an
 * executable chip. That still holds, and now holds for a derivable reason: an
 * action_type CEE has not published in the vendored enum satisfies neither
 * conjunct, so it is absent from the derived set and `SuggestedChips` drops it.
 * The change is confined to actions that are known, accepted AND dispatchable —
 * "known-and-proposed" — which are exactly the ones that were being dropped by
 * mistake.
 *
 * ─── What derivation CANNOT prove, and what is shipped alongside ───────────
 * Trap 12d: a derived guard proves the copies AGREE; it can never prove the
 * source list is COMPLETE. If `ActionType` itself were short a member, every
 * derived guard here would stay green. So this module ships with BOTH kinds of
 * guard, and neither supersedes the other:
 *   - derived invariants (`chipActionVocabulary.spec.ts`) — no known,
 *     accepted, dispatchable action may be dropped, and nothing renders that
 *     the wire or the dispatcher would degrade;
 *   - a hand-written CORPUS of real producer-captured response shapes
 *     (`proposeConfirmChipRender.spec.tsx`) — the only instrument that can
 *     notice the vocabulary is short, because it is written from what CEE was
 *     MEASURED emitting, not from our own list.
 */
import {
  KNOWN_ACTION_TYPES,
  CEE_ACCEPTED_ACTION_TYPES,
  isSendableToken,
} from '../../v5/buildPayload'
import { DISPATCHABLE_ACTION_TYPES } from './actionTurnTypes'

/**
 * Action types this client renders that are NOT in the wire vocabulary at all.
 *
 * `edit_graph` and `draft_graph` predate `ActionType` and are absent from the
 * vendored enum, so conjunct 1 can never admit them; they are carried here to
 * preserve existing behaviour rather than silently withdrawn by the switch to
 * derivation. Being outside the enum is what makes the carve-out safe: it is
 * provably disjoint from the wire vocabulary (pinned in the spec), so it can
 * never mask a drift in the derived set — a wire value can never hide here.
 */
export const UI_LOCAL_RENDERABLE_ACTION_TYPES: ReadonlySet<string> = new Set<string>([
  'edit_graph',
  'draft_graph',
])

/**
 * Is this a wire action_type whose click would be honest — reaching CEE typed
 * (conjunct 1) AND dispatching to a turn type chosen for it (conjunct 2)?
 *
 * Exported so the spec can drive it with SYNTHETIC registries and prove the AND
 * actually bites, rather than only observing the composed result.
 */
export function isHonestlyDispatchableAction(
  actionType: string,
  published: ReadonlySet<string> = KNOWN_ACTION_TYPES,
  accepted: ReadonlySet<string> = CEE_ACCEPTED_ACTION_TYPES,
  dispatchable: ReadonlySet<string> = DISPATCHABLE_ACTION_TYPES,
): boolean {
  return isSendableToken(actionType, published, accepted) && dispatchable.has(actionType)
}

/**
 * The chip RENDER vocabulary. Chips whose `action_type` is set and absent from
 * this set are filtered out by `SuggestedChips` when V5 is active.
 *
 * Derived at module load from the wire vocabulary + the dispatch map; the only
 * hand-written contribution is the pre-enum carve-out above.
 */
export const V5_ENABLED_ACTIONS: ReadonlySet<string> = new Set<string>([
  ...[...KNOWN_ACTION_TYPES].filter((t) => isHonestlyDispatchableAction(t)),
  ...UI_LOCAL_RENDERABLE_ACTION_TYPES,
])

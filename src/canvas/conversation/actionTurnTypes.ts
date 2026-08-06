/**
 * actionTurnTypes — the deterministic `action_type` → turn-type dispatch map.
 *
 * EXTRACTED from `useConversation.ts` (2026-08-07, ROADMAP 2.668) so that the
 * chip RENDER gate can be DERIVED from it. `useConversation` re-exports
 * `ACTION_TO_TURN_TYPE` unchanged, so every existing importer is unaffected.
 *
 * Why the extraction was necessary rather than cosmetic: the render gate
 * (`chipActionVocabulary`) has to answer "would a click on this chip dispatch
 * to a turn type chosen for it, or fall through to the default?" — and the
 * only honest source for that is this map. Importing the 6,000-line
 * `useConversation` hook module into `SuggestedChips` to read one constant
 * would drag stores, services and React hooks into a leaf component's module
 * graph. The constant is data; it belongs in a data module.
 */
import type { TurnType } from '../../services/turn-request-builder'

/** Deterministic action_type → turn type mapping. Falls back to 'conversation' for unknown actions. Exported for tests. */
export const ACTION_TO_TURN_TYPE: Record<string, Exclude<TurnType, 'system_event'>> = {
  run_analysis: 'run_analysis',
  // V5 backend handler ID is the PLURAL `explain_results` (see backend
  // `src/orchestrator-v5/handlers/chip-click-dispatch.ts:137-141` whitelist +
  // `src/orchestrator-v5/compose/chip-generator.ts` chip emission, post-
  // Phase-2b). Singular `explain_result` retained as a legacy alias because
  // the chip-generator's `promptChip(...)` used it as a discriminator string
  // for years and existing chip surfaces still emit it; either form must
  // reach the same 'explain' turn type so dispatch is consistent and the
  // deterministic chip-click bypass fires regardless of which alias the
  // chip carries.
  explain_result: 'explain',
  explain_results: 'explain',
  compare_options: 'explain',
  what_would_flip: 'explain',
  // F2 CHANGE B (2026-07-22): the "What changed?" pill is an analytical
  // comparison — same explanation class as what_would_flip / compare_options,
  // so it dispatches as an 'explain' turn (correct timeout class + local
  // handling). The CEE answer is a direct_answer run-over-run delta.
  what_changed: 'explain',
  challenge_assumption: 'conversation',
  set_factor_value: 'conversation',
  add_factor: 'conversation',
  add_option: 'conversation',
  add_constraint: 'conversation',
  adjust_edge_strength: 'conversation',
  remove_factor: 'conversation',
  set_goal_target: 'conversation',
  run_premortem: 'explain',
  draft_graph: 'explicit_generate',
}

/**
 * The action types this client dispatches DELIBERATELY (own keys only).
 *
 * `Object.keys`, not `in`: `'constructor' in ACTION_TO_TURN_TYPE` is `true`
 * on any object literal, so a membership test written with `in` would silently
 * treat every `Object.prototype` member as a dispatchable action.
 */
export const DISPATCHABLE_ACTION_TYPES: ReadonlySet<string> = new Set(
  Object.keys(ACTION_TO_TURN_TYPE),
)

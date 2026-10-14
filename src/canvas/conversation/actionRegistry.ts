/**
 * One local method → action → typed press mapping, shared by Reasoning and chat.
 * Typed rows select CEE handlers through chip.id; labels supply display/context.
 *
 * Existing capabilities verified in CEE staging source 5404dff6077f:
 * src/orchestrator-v5/agent-lane/actions/{registry,handlers}.ts.
 * Bias check is act:bias_check (a deterministic typed reply). Reframe, opposite
 * case, outside view and trade-offs have no equivalent typed handler. Their
 * prose rows remain INTERIM: a press sends the existing question family as an
 * ordinary Agent chip turn under ask:<intent>. These are available controls,
 * not implemented reasoning protocols. Do not describe them as running one.
 *
 * Generic Ask retains its existing stage rules. Explicit method presses keep
 * the typed id and let CEE enforce its own preconditions, or reuse the current
 * offer through pressOffer, including availability and offered revision.
 * CEE-only actions keep their wire ids; this table covers the local methods.
 */
import type { AskIntent, AskStage } from './askAiQuestions'

export const ACTION_IDS = [
  'review',
  'what_changes',
  'strengthen',
  'pre_mortem',
  'more_options',
  'reframe',
  'opposite_case',
  'outside_view',
  'trade_offs',
  'bias_check',
] as const
export type ActionId = (typeof ACTION_IDS)[number]

export type ActionHandler =
  | { kind: 'typed'; press_id: string; stages: readonly AskStage[] }
  | { kind: 'prose' }

export interface ActionEntry {
  ask: AskIntent
  handler: ActionHandler
  /** The `METHOD_CATALOGUE` entry this action is, where it is one. */
  method_id?: string
}

export const ACTION_REGISTRY = {
  review: { ask: 'review', handler: { kind: 'typed', press_id: 'agent-next-review-decision', stages: ['ran-current'] } },
  what_changes: { ask: 'what-would-change', handler: { kind: 'typed', press_id: 'agent-next-what-would-change', stages: ['ran-current'] } },
  strengthen: { ask: 'strengthen', handler: { kind: 'typed', press_id: 'agent-next-strengthen', stages: ['ran-current'] } },
  pre_mortem: { ask: 'pre-mortem', method_id: 'pre_mortem', handler: { kind: 'typed', press_id: 'agent-next-pre-mortem', stages: ['ran-current', 'withheld'] } },
  // CEE's widen handler is total: it runs whenever the model has a goal and answers a typed "can't yet" when it has
  // none, so the press goes to it at every stage and from every door (DL ruling, 7 Oct 2026).
  more_options: { ask: 'widen', method_id: 'different_option', handler: { kind: 'typed', press_id: 'agent-next-widen', stages: ['drafted', 'ran-current', 'stale', 'withheld'] } },
  reframe: { ask: 'method-reframe', method_id: 'reframe_problem', handler: { kind: 'prose' } },
  opposite_case: { ask: 'method-opposite', method_id: 'consider_opposite', handler: { kind: 'prose' } },
  outside_view: { ask: 'method-outside-view', method_id: 'outside_view', handler: { kind: 'prose' } },
  trade_offs: { ask: 'compare-options', method_id: 'explore_tradeoffs', handler: { kind: 'prose' } },
  // CEE staging actions/{registry,handlers}.ts: deterministic, evidence-grounded bias reply.
  bias_check: { ask: 'method-bias', method_id: 'review_bias', handler: { kind: 'typed', press_id: 'act:bias_check', stages: ['drafted', 'ran-current', 'stale', 'withheld'] } },
} as const satisfies Record<ActionId, ActionEntry>

/** The same rows, read through the entry type (the const form exists so a typed row's `press_id` is checked at compile time). */
const ENTRIES: Readonly<Record<ActionId, ActionEntry>> = ACTION_REGISTRY

/** Both typed handlers and interim prose turns are available method presses. */
export function methodIsAvailable(methodId: string): boolean {
  return actionOfMethod(methodId) !== undefined
}

/** All registered rows are available; CEE-only actions retain their existing behaviour. */
export function actionIsAvailable(_actionId: string): boolean {
  return true
}

/** Both action-bar surfaces and catalogue presses read the same typed mapping. */
export function registeredPressId(actionId: string): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(ENTRIES, actionId)) return undefined
  const { handler } = ENTRIES[actionId as ActionId]
  return handler.kind === 'typed' ? handler.press_id : undefined
}

/** CEE's typed press id for this action at this stage, or `undefined` where it has none. */
export function typedPressIdOf(actionId: ActionId, stage: AskStage): string | undefined {
  const { handler } = ENTRIES[actionId]
  return handler.kind === 'typed' && handler.stages.includes(stage) ? handler.press_id : undefined
}

/** The chip id a press of this action sends at this stage. */
export function pressIdOf(actionId: ActionId, stage: AskStage): string {
  return typedPressIdOf(actionId, stage) ?? `ask:${ENTRIES[actionId].ask}`
}

export function actionOfAsk(intent: AskIntent): ActionId | undefined {
  return ACTION_IDS.find((id) => ENTRIES[id].ask === intent)
}

export function actionOfMethod(methodId: string): ActionId | undefined {
  return ACTION_IDS.find((id) => ENTRIES[id].method_id === methodId)
}

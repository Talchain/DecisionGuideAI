/**
 * ⭐ S-B ACTION SYSTEM, SLICE 0 — THE ONE TABLE OF ACTIONS A PRESS CAN ASK OLUMI FOR.
 *
 * Keyed by action id. It is the single source of the press mapping: which chip
 * id a press sends, and whether CEE answers that id with a typed handler or the
 * press is, for now, an ordinary Agent turn. The served CEE lane routes on
 * `chip.id` and nothing else, so a press id spelled anywhere but here is a
 * second mapper that can drift (`noPressIdOutsideTheRegistry.spec` holds that).
 *
 * WHO READS IT
 *   · `askAi` (every Ask door on the canvas, the inspector and the Reasoning
 *     tab) chooses its chip id here.
 *   · `pressAction` is the one press path for an action.
 *   · the Reasoning tab's methods (`runMethod`) and its four text presses.
 *
 * `handler.kind`
 *   · `typed`: CEE has its own handler for `press_id` and accepts it at
 *     `stages`. Outside those stages the press sends the plain ask.
 *   · `prose`: ⚠ INTERIM. No typed CEE handler exists yet, so the press is an
 *     ordinary Agent chip turn under `ask:<intent>`: Olumi's question is never
 *     taken as the person's own words and the change and Run tools stay
 *     withheld, but nothing checks the reply follows the method. Do not write
 *     "runs the protocol" on the strength of a `prose` row. When CEE's handler
 *     lands, the row becomes `typed` here and nowhere else changes.
 *
 * ⚠ `stages` IS `askAi`'S RULE, AND ONE SURFACE DOES NOT USE IT YET. The
 * Reasoning tab's four text presses are shown on any current Run and send
 * `press_id` there, including a Run that withholds its figures, where CEE
 * answers with its own typed limit. They read `press_id` from the row, so the id
 * has one source; the two stage rules become one when each handler's own
 * precondition replaces `stages` (slice 1's `enabled`).
 *
 * `ask` is the question family whose text is the visible user line. It is
 * display only: CEE never routes on it.
 *
 * This is the seed of the shared registry (labels, icons and the relevance
 * signal join it with the ActionBar); the ids are the ACTION-SYSTEM draft's.
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
  bias_check: { ask: 'method-bias', method_id: 'review_bias', handler: { kind: 'prose' } },
} as const satisfies Record<ActionId, ActionEntry>

/** The same rows, read through the entry type (the const form exists so a typed row's `press_id` is checked at compile time). */
const ENTRIES: Readonly<Record<ActionId, ActionEntry>> = ACTION_REGISTRY

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

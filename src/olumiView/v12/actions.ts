/**
 * V12 one action system (proposal 005 v2, "Activities" and "How the screen is put together"; Codex 003): the AI panel's menu behind the composer's
 * ⋯ and the one next step, both chosen here from the View, with no I/O and no React. Every user-facing word about the scenario is core's, verbatim
 * (`session.methods[].text`); the only words written here are chrome: the names of the two tools folded in from the Reasoning tab and the plain
 * statement of what an analysis-gated question needs.
 *
 * ViewChat.tsx draws these and runs the presses; nothing here imports it (so the menu and the card can both be built from it without a cycle).
 */
import type { View, ViewTurn } from '../client'
import { sessionOf, type SessionMethod } from '../layout'
import { replyHasNext } from '../replyHasNext'

/** The reply's next step as core words it (`answer.next`), with `move` the coach's move id. */
export type Next = NonNullable<ViewTurn['answer']>['next']

/** The coach's filler move: it names no one move, so it is never a step on its own (V10_MOVE_ICONS draws no chip for it either). */
export const FILLER_MOVE = 'other_method'

/** A move core names that the person can take in one tap: any non-empty id but the filler. */
export const isRealMove = (move: unknown): move is string => typeof move === 'string' && move !== '' && move !== FILLER_MOVE

/** The menu item core sends while it offers "Let us give our figure first": a press opens its blind entry, never a question (API.md). */
export const FIGURE_FIRST_ID = 'figure_first'

/** The two tools the Reasoning tab held that are not questions. Chrome words: they name where a press goes, never a fact about the scenario. */
export const TOOL_WORDS = {
  edit_brief: 'Your brief',
  review_inputs: 'Review all inputs',
} as const
export type ToolId = keyof typeof TOOL_WORDS

/**
 * The questions whose answer core grounds in a calculation (turns.ts methodTurn: "What would have to be true?" in D6, "What could go wrong?"
 * in D5, "How much rests on Olumi's guesses?" in D8; the others read the run too). Without an analysis they can still be asked, and Olumi
 * answers in words only: the menu says so, so a qualitative answer is never taken for a calculated one.
 */
export const NEEDS_ANALYSIS: ReadonlySet<string> = new Set(['differ', 'find_first', 'have_true', 'go_wrong', 'push', 'rests'])

/** Chrome words for the prerequisite of an analysis-gated question while there is no analysis to read. */
export const NEEDS_ANALYSIS_WORDS = 'Needs an analysis to be worked out. Until there is one, Olumi answers in words only, not from a calculation.'

/** An analysis exists for the model on screen: the View's run has an aim (the same test the composer's placeholder uses). */
export const analysedOf = (view: View): boolean => view.version !== null && (view.model?.run?.aim ?? null) !== null

export type MenuMethod = SessionMethod & { /** Chrome: set while the question is gated on an analysis the model does not have yet. */ prerequisite: string | null; /** Its index in `session.methods`, the path of its words. */ i: number }

export type Menu = {
  /** What the team came for, core's `session.goal` id, or null. */
  goal: string | null
  /** Core's questions in core's order (the goal's first), "Let us give our figure first" among them only while core offers it. Never filtered. */
  methods: MenuMethod[]
  /** The tools folded in from the Reasoning tab, in this order. */
  tools: ToolId[]
}

/** The menu for the View on screen, or null when core sent no session block (as `sessionOf`: a menu with a question missing is not drawn). */
export function menuOf(view: View): Menu | null {
  const s = sessionOf(view)
  if (s === null) return null
  const gated = !analysedOf(view)
  return {
    goal: s.goal?.id ?? null,
    methods: s.methods.map((m, i) => ({ ...m, i, prerequisite: gated && NEEDS_ANALYSIS.has(m.id) ? NEEDS_ANALYSIS_WORDS : null })),
    tools: view.model === null ? [] : ['edit_brief', 'review_inputs'],
  }
}

/** One figure the chances wait on (core's `run.waits_on.items[]`). */
export type WaitsOnItem = NonNullable<NonNullable<NonNullable<View['model']>['run']>['waits_on']>['items'][number]

export type NextStep =
  | { readonly kind: 'approve' }
  /** The first figure the chances wait on that core lets them type (`edit` non-null, on a version they may edit). In core's words; drawn with the figure's own editor. */
  | { readonly kind: 'figure'; readonly item: WaitsOnItem & { edit: NonNullable<WaitsOnItem['edit']> } }
  /** The newest reply's own move, drawn under that reply as its one tap (ViewChat MoveTap); no second card. */
  | { readonly kind: 'move'; readonly turn: number; readonly next: Next }
  /** The first question core puts for the person's goal. */
  | { readonly kind: 'method'; readonly method: MenuMethod }
  | { readonly kind: 'invite' }

/** A person who is alone has begun a private view: the part that needs others is the reveal, so the step is to bring someone in. */
const teamActivity = (view: View): boolean => view.collab.alone && view.collab.mine.length > 0

/**
 * The one thing for the person to do next, from their purpose and the state, in this order:
 *  1. a proposal Olumi holds (nothing is kept until it is approved);
 *  2. the first figure the chances wait on that core lets them type (the one-tap way to give a missing figure, kept from before V12);
 *  3. the newest reply's own move, when it is a real move (never the filler) and has not gone stale (`isGone`);
 *  4. the first question core orders for the goal (`first`: with no goal nothing leads, so none is chosen);
 *  5. bringing a colleague in, only while the View shows a team activity begun alone.
 * Else nothing: the conversation is the next step.
 */
export function nextStepFor(view: View, isGone: (turn: number, move: string) => boolean = () => false): NextStep | null {
  if (view.proposal !== null) return { kind: 'approve' }
  const figure = view.model?.edit_base == null ? undefined : view.model.run?.waits_on?.items.find((i) => i.edit !== null)
  if (figure) return { kind: 'figure', item: figure as WaitsOnItem & { edit: NonNullable<WaitsOnItem['edit']> } }
  const t = view.chat.at(-1)
  if (t?.answer != null && t.answer.next.newest && isRealMove(t.answer.next.move) && !isGone(t.id, t.answer.next.move)) return { kind: 'move', turn: t.id, next: t.answer.next }
  const m = view.version === null ? null : menuOf(view)?.methods.find((x) => x.first)
  if (m !== undefined && m !== null) return { kind: 'method', method: m }
  if (view.version !== null && !replyHasNext(view) && teamActivity(view)) return { kind: 'invite' }
  return null
}

/** The method replies are the turns whose `said` is one of core's own menu questions, word for word. */
export const isMethodReply = (view: View, t: ViewTurn): boolean => t.answer !== null && (sessionOf(view)?.methods.some((m) => m.id !== FIGURE_FIRST_ID && m.text === t.said) ?? false)

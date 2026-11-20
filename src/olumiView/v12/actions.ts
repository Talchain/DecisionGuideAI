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
// Only the three core grounds in a calculation today (menu review 18 Nov); differ, find_first and push join once core grounds them (CORE-A).
export const NEEDS_ANALYSIS: ReadonlySet<string> = new Set(['have_true', 'go_wrong', 'rests'])

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

/** The panel's one pinned step is a proposal Olumi holds. Every other next step is the newest reply's own `answer.next`, drawn once at that reply's end (ViewChat Turn). */
export type NextStep = { readonly kind: 'approve' }

/**
 * The one step the panel pins: a proposal Olumi holds (nothing is kept until it is approved). Nothing else is chosen here (system spec P2): the
 * newest reply's own move is drawn at the end of that reply, once; the UI no longer picks a method, a figure or an invitation of its own.
 */
export function nextStepFor(view: View): NextStep | null {
  return view.proposal !== null ? { kind: 'approve' } : null
}

/**
 * The newest reply's own move, when it is one the chat draws (MoveTap): core marks it `newest`, it names a real move (never the filler), and the chat
 * has not refused it as stale (`isGone`, the chat's own exclusion). One predicate for the chat's tap and for Journey's "go to the next step".
 */
export function replyMoveFor(view: View, isGone: (turn: number, move: string) => boolean = () => false): { readonly turn: number; readonly next: Next } | null {
  const t = view.chat.at(-1)
  if (t?.answer == null || !t.answer.next.newest || !isRealMove(t.answer.next.move) || isGone(t.id, t.answer.next.move)) return null
  return { turn: t.id, next: t.answer.next }
}

/** The method replies are the turns whose `said` is one of core's own menu questions, word for word. */
export const isMethodReply = (view: View, t: ViewTurn): boolean => t.answer !== null && (sessionOf(view)?.methods.some((m) => m.id !== FIGURE_FIRST_ID && m.text === t.said) ?? false)

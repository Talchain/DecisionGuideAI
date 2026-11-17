/**
 * OLUMI'S MOVES AS ICONS (Paul, 17 Nov: "icons across everything, clickable, powerful functionality that directly interacts with the AI";
 * experience contract section 8). One map from core's method id (`session.methods[].id`) to its Lucide icon, one from core's four challenge
 * kinds (ViewChat `CHALLENGE_KINDS`, the challenge route's `kind`) to theirs, and the one rule for where the moves are offered. No words are
 * written here: a method's words are core's (`session.methods[].text`), a challenge's are the product's own, found below.
 *
 * ONE GLYPH, ONE MEANING. No icon here is one the lens bar (`LENS_ICON`), a card mark (`cardMarks.ts`) or the canvas chrome already uses for
 * something else. Where the suggested glyph was taken, the one chosen says why:
 *  - the four challenges wear the composer's own four glyphs for the same four challenges (ViewChat.tsx `METHOD_GLYPHS`: Zap, FlipVertical2,
 *    SearchX, Globe), so a challenge reads the same under the typing line and on a card;
 *  - `similar` ("How do similar situations turn out?") is the outside view, so it wears the outside view's Globe (the composer, V10's
 *    `outside_view` move); History is the pill's version history;
 *  - `else_do` ("What else could we do?") wears V10's widen-options Split; Lightbulb is a kept idea (KeepIdea);
 *  - `go_wrong` wears ShieldAlert; AlertTriangle is the warning state and the card's must-fix mark;
 *  - `right_question` wears Frame (the framing); Crosshair is "About this card on the canvas" (AboutChip);
 *  - `find_first` wears Microscope; Search is "Find evidence" (FindEvidence);
 *  - `rests` wears Weight; Layers is the tool column's lenses menu and Layers2 the Model lens;
 *  - `success` wears BadgeCheck; Target is what the team came for (the goal chip) and an aim's "target not captured" mark.
 * A method id this page does not know yet wears MethodChip's question mark, the mark of "one of core's questions".
 */
import { ArrowUpDown, BadgeCheck, CheckCheck, FlipVertical2, Frame, GitCompare, Globe, MessageCircleQuestion, Microscope, PencilLine, ScanEye, SearchX, ShieldAlert, Split, Weight, Zap, type LucideIcon } from 'lucide-react'
import type { View } from '../../client'
import { onFloor } from '../../early'
import { sessionOf } from '../../layout'
import { isDrafting, takesBrief, type ChallengeKind } from '../../ViewChat'
import type { AskIntent } from '../../../canvas/conversation/askAiQuestions'
import { V10_METHODS } from '../../../presentation/V10MethodChips'

/** Core's method ids seen today, each to its icon. */
export const METHOD_ICON: Readonly<Record<string, LucideIcon>> = {
  differ: GitCompare,
  find_first: Microscope,
  have_true: CheckCheck,
  go_wrong: ShieldAlert,
  figure_first: PencilLine,
  else_do: Split,
  right_question: Frame,
  push: ArrowUpDown,
  similar: Globe,
  rests: Weight,
  success: BadgeCheck,
  bias: ScanEye,
}

/** The icon for a method id: its own, or the generic question mark for one this page does not know. */
export const methodIcon = (id: string): LucideIcon => (Object.prototype.hasOwnProperty.call(METHOD_ICON, id) ? METHOD_ICON[id]! : MessageCircleQuestion)

/** The four challenges, each to its icon (the composer's glyph for the same challenge). */
export const CHALLENGE_ICON: Readonly<Record<ChallengeKind, LucideIcon>> = { assumption: Zap, opposite: FlipVertical2, disconfirming: SearchX, outside: Globe }

/**
 * Each challenge's name: the composer's own label for the same challenge (V10MethodChips `V10_METHODS`, keyed by the same four kinds: "Challenge
 * it", "The opposite", "What would disprove it", "Outside view").
 */
export const challengeName = (kind: ChallengeKind): string => V10_METHODS.find((m) => m.key === kind)!.label

/**
 * The question each challenge sends, by the ask it is in the product: the inverse of ViewChat.tsx `CHALLENGES` (line 1071, chip id `ask:<intent>`
 * to kind), so the words are exactly those a challenge chip sends today (askAiQuestions `QUESTIONS`, built by askAi `buildAskAiQuestion`).
 */
export const CHALLENGE_ASK: Readonly<Record<ChallengeKind, AskIntent>> = { assumption: 'challenge', opposite: 'method-opposite', disconfirming: 'falsify', outside: 'method-outside-view' }

/** At most this many of core's questions stand on the canvas's rail; the rest are behind Olumi's mark (contract section 8). */
export const RAIL_MAX = 6

/**
 * Whether Olumi's moves are offered on the canvas: exactly where the panel offers its own ways to test the model (ViewChat.tsx
 * ViewComposerBody, `const methods = view !== null && !held && !takesBrief(sid, view) && !onFloor(view)`, with `held` there being
 * `busy || past !== null || (drafting && !onFloor(view)) || unknown`), with core's session block to draw them from (the ⋯ menu's own
 * condition). Busy is left out: a press while a write is in flight is held by the control (disabled), so the rail does not flicker.
 * So: no model yet (a brief to take, or the floor), a past version held, a first draft building, or no session: nothing.
 */
export function movesOffered(sid: string | null, view: View | null, at: unknown): view is View {
  return view !== null && sid !== null && at === null && !isDrafting(view) && !takesBrief(sid, view) && !onFloor(view) && sessionOf(view) !== null && (view.model?.cards.length ?? 0) > 0
}

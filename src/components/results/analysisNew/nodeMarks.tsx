/**
 * Analysis (New) — the node-kind mark, in ONE place.
 *
 * ⭐⭐ WHY THIS IS SHARED RATHER THAN COPIED. The strip and the coaching cards
 * both need to say "this is about a Risk", and two spellings of one visual
 * vocabulary is the hand-maintained mirror this estate pays for repeatedly
 * (CLAUDE.md trap 12). A shape that means `risk` in the strip and something
 * subtly different on a card is worse than no shape at all, because the reader
 * learns a vocabulary that then lies to them.
 *
 * ⭐ WHAT THE MARK IS FOR, which is the point of the exercise. The founder's
 * standing criticism of this panel is that it is "too textual", and the useful
 * diagnosis is not word count — it is that every element has the same rhythm: a
 * label, a title, a paragraph, an action row. The shape marks were decorative:
 * they said what KIND of thing something was and nothing else, while the only
 * functional icons were two buttons repeated identically on every card.
 *
 * Giving a coaching card the mark of the node it concerns moves work out of the
 * sentence and into the form. "This is about a risk" stops being a clause the
 * reader has to parse and becomes something they see. Shorter prose follows as
 * a consequence rather than as a target.
 *
 * ⚠ COLOUR IS DERIVED from `canvas/nodes/colors.ts` — the canvas owns what
 * colour a kind is, and this module never restates it. SHAPE is a local map,
 * because the canvas's own glyph table (`contextMenu/useMenuItems.ts`) is
 * module-private; that one mirror is pinned by a test asserting every kind has
 * a shape, so adding a kind without one REDs rather than rendering a blank.
 */

import { nodeColors } from '../../../canvas/nodes/colors'
import { useCanvasStore } from '../../../canvas/store'
import { resolveNodeTypeLiteral } from '../../../canvas/domain/nodes'

/** The kinds this panel draws. Deliberately narrower than `NodeType`. */
export type MarkKind = 'option' | 'factor' | 'risk' | 'outcome'

export const MARK_KINDS: readonly MarkKind[] = ['option', 'factor', 'risk', 'outcome']

/**
 * Paul 14 Oct 2026: "The brief and goal both already have coloured shapes that identify them … We should be using
 * them in this top panel." The Reasoning checklist's Brief and Goal rows draw the canvas's own decision hexagon and
 * goal diamond (`canvas/nodes/NodeShapeIndicator.tsx`, same 12-unit box). Kept OUT of `MARK_KINDS`, so
 * `markKindForTarget` still answers `null` for a goal or decision target.
 */
export type SubjectMarkKind = 'decision' | 'goal'
export const SUBJECT_MARK_KINDS: readonly SubjectMarkKind[] = ['decision', 'goal']
export type AnyMarkKind = MarkKind | SubjectMarkKind

/** Mirrors the canvas glyph vocabulary: square, disc, down-triangle, up-triangle; hexagon, diamond. */
const SHAPE: Record<AnyMarkKind, string> = {
  decision: 'M3.25 1.5h5.5L11.5 6l-2.75 4.5h-5.5L.5 6z',
  goal: 'M6 1l5 5-5 5-5-5z',
  option: 'M1.6 1.6h8.8v8.8H1.6z',
  factor: 'M6 1.2a4.8 4.8 0 100 9.6 4.8 4.8 0 000-9.6z',
  risk: 'M6 10.8L1.2 2.4h9.6z',
  outcome: 'M6 1.2l4.8 8.4H1.2z',
}

/** Derived, never restated. */
export const MARK_COLOUR: Record<AnyMarkKind, string> = {
  decision: nodeColors.decision.text,
  goal: nodeColors.goal.text,
  option: nodeColors.option.text,
  factor: nodeColors.factor.text,
  risk: nodeColors.risk.text,
  outcome: nodeColors.outcome.text,
}

/** Exposed so a test can assert shape and colour cover the same set. */
export const MARK_SHAPE_KEYS = Object.keys(SHAPE) as AnyMarkKind[]

export interface NodeMarkProps {
  kind: AnyMarkKind
  /** Tailwind size classes. Defaults to the 12px panel mark. */
  className?: string
}

export function NodeMark({ kind, className = 'w-3 h-3' }: NodeMarkProps) {
  return (
    <svg
      viewBox="0 0 12 12"
      className={`${className} ${MARK_COLOUR[kind]} shrink-0`}
      data-mark-kind={kind}
      aria-hidden={true}
    >
      <path d={SHAPE[kind]} fill="currentColor" />
    </svg>
  )
}

/**
 * The kind of node a recommendation points at, or `null`.
 *
 * ⚠ `null` IS THE HONEST ANSWER IN THREE DIFFERENT SITUATIONS and the caller
 * must render nothing for all of them: the recommendation carries no target at
 * all; the target is an EDGE rather than a node (`focusModelTarget` accepts
 * both, and a relationship has no node kind); or the target names a node this
 * panel does not draw (a goal, a decision, an action). Guessing a mark in any
 * of those cases would put a shape on screen that means something it is not.
 *
 * Read non-reactively: a node's KIND does not change while a card is on screen,
 * and subscribing here would re-render every card on every canvas drag.
 */
export function markKindForTarget(targetId: string | undefined | null): MarkKind | null {
  if (!targetId) return null
  const node = (useCanvasStore.getState().nodes ?? []).find((n) => n.id === targetId)
  if (!node) return null
  const kind = resolveNodeTypeLiteral(node)
  return kind && (MARK_KINDS as readonly string[]).includes(kind) ? (kind as MarkKind) : null
}

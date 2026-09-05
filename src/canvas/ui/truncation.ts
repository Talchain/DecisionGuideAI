import type { CSSProperties } from 'react'

/**
 * ⭐⭐⭐ A LABEL MAY TRUNCATE. A VALUE NEVER MAY.
 *
 * A cut-off number is worse than an absent one: the reader does not see a gap,
 * they see a magnitude, and it is the wrong magnitude. The deployed edge badge
 * painted `Sensitive · 5…` — a flip risk whose digits were eaten by the
 * ellipsis, with nothing on screen saying so.
 *
 * ⚠ THIS RULE IS NOT NEW, AND THAT IS THE POINT OF THIS FILE. It was ratified
 * twice, in Paul's words, and both statements are still in the tree:
 *
 *   · `nodes/OptionNode.tsx` — the approved brief, quoted there as "one line
 *     per change, label truncates, value NEVER truncates". That comment also
 *     settles what to do when the value cannot fit: the value "keeps as many
 *     lines as it needs and the LABEL gets its own line". WRAP, DO NOT CLIP.
 *   · `nodes/DecisionNode.tsx` — "An ellipsis with somewhere to go is a
 *     caveat; an ellipsis with nowhere to go is hiding", written when 37-41%
 *     of the triage line shipped cut.
 *
 * So the class that keeps reopening is not an unknown rule. It is a known rule
 * with no shared authority and no gate: enforced correctly at most sites,
 * missed at the two that had no reason to know. This module is the authority;
 * `__tests__/valueNeverTruncates.spec.ts` is the gate.
 *
 * ⭐ THE OPERATIVE TEST, which decides badges nobody has written yet:
 * **is the number inside the truncating element's own subtree, or in a
 * sibling?** A `truncate` NEXT TO a value is correct. A `truncate` AROUND a
 * value is the defect. One span carrying `"Label · 49%"` is a value defect
 * waiting for a narrow viewport, because CSS ellipsis cuts from the END and
 * the number is almost always last.
 *
 * ⚠ `title` IS NOT A RECOVERY ROUTE. It renders on hover only: it never fires
 * on keyboard focus in any major browser, and it is absent wherever
 * `(hover: hover)` is false. A truncated LABEL needs a focusable element whose
 * activation reveals the full text, or a visible restatement. `aria-label`
 * alone serves screen readers and leaves sighted keyboard and touch users with
 * nothing.
 */

/**
 * The label half of a label/value line. `min-w-0` is what lets it actually
 * shrink inside a flex row — without it the browser floors a flex item at its
 * content width and the SIBLING gets squeezed instead, which is how a value
 * ends up clipped by a rule that was never applied to it.
 */
export const TRUNCATING_LABEL_CLASS = 'min-w-0 truncate'

/**
 * The value half. `shrink-0` refuses to give up width, `whitespace-nowrap`
 * refuses to break the number across lines. Together they mean the label is
 * what disappears under pressure — which is the rule.
 */
export const PROTECTED_VALUE_CLASS = 'shrink-0 whitespace-nowrap'

/**
 * Inline-style twins, for the surfaces that cannot use classes. Edge labels are
 * the live case: they render inside `EdgeLabelRenderer` at a counter-scale and
 * already build their geometry in `style`.
 */
export const TRUNCATING_LABEL_STYLE: CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

export const PROTECTED_VALUE_STYLE: CSSProperties = {
  flexShrink: 0,
  whiteSpace: 'nowrap',
}

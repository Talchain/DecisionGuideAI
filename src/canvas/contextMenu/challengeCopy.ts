/**
 * The one producer of node CHALLENGE copy — the prompt and the tooltip.
 *
 * ## Why this is a module and not two string literals
 *
 * "Challenge this" has TWO doors: the context menu's Ask AI submenu
 * (`useMenuItems.ts`) and the hover row's Zap button (`NodeQuickActions.tsx`).
 * They confirm differently — the menu auto-sends via `askAI`, the button
 * prefills and waits — but they must ask the SAME question, in the same words.
 * Both read this file, so a reword is one edit; a copy pasted into either
 * surface would be a second spelling of one idea, drifting the first time
 * anybody touched either.
 *
 * ⚠ It is deliberately NOT inside `actions.ts`. `useMenuItems.spec.ts` mocks
 * `../actions` wholesale, and a `vi.mock` factory REPLACES the module — so a
 * tooltip producer living there would be `undefined` in that spec and every
 * tooltip assertion would test nothing. That is the hand-maintained-mirror
 * defect one level down: a guard that cannot see what it is pointed at.
 * `actions.ts` delegates here; nothing is duplicated.
 *
 * ## Why the copy is per-kind at all
 *
 * The generic sentence — *"Challenge the current setup of X. What could be
 * wrong or missing?"* — reads true of a factor, a risk, an outcome and a goal:
 * each carries a value, a range or a target somebody chose. It reads weakly of
 * the three kinds this file names:
 *
 *  • a QUESTION (`decision` — the user-facing word is "Question", see
 *    `domain/vocabulary.ts`) has no setup to be wrong; it has a FRAMING, and
 *    the useful challenge is whether it is the right thing to be working out;
 *  • an OPTION is a candidate answer, and the useful challenge is what would
 *    make it worse than it looks and what is missing from the set;
 *  • a CONSTRAINT carries the most genuinely challengeable setup of the three
 *    (`constraintType`, `thresholdValue`, `unit`, `hardConstraint`), and the
 *    useful challenge is whether it is real, correctly set, and negotiable.
 *
 * The four kinds that already ship keep their witnessed wording. This adds
 * kinds; it does not reword what users have already seen.
 */

import type { NodeType } from '../domain/nodes'

/** The wording every kind used before per-kind copy existed, and still the
 *  wording for factor, risk, outcome and goal. */
const GENERIC_CHALLENGE_PROMPT = (label: string) =>
  `Challenge the current setup of "${label}". What could be wrong or missing?`

/** Likewise for the menu entry's tooltip. */
const GENERIC_CHALLENGE_TOOLTIP = "Ask AI to argue against this element's current setup"

interface ChallengeCopy {
  prompt: (label: string) => string
  tooltip: string
}

/**
 * Kinds whose challenge is a different QUESTION, not a different phrasing of
 * the same one. Anything absent falls back to the generic pair above — so
 * adding a kind here is additive and cannot silently reword another.
 */
const PER_KIND: Partial<Record<NodeType, ChallengeCopy>> = {
  /**
   * ⚠ THE USER-FACING WORD IS "QUESTION", NOT "DECISION" — `DECISION_NODE_LABEL`
   * in `domain/vocabulary.ts`; "Decision" was retired on 31 Aug 2026. The code
   * id stays `decision`; the copy must not leak it.
   */
  decision: {
    prompt: (label) =>
      `Challenge how this question is framed: "${label}". Is it the right thing to be working out, and what is it assuming?`,
    tooltip: 'Ask Olumi to argue this is the wrong question to be asking',
  },
  option: {
    prompt: (label) =>
      `Challenge the option "${label}". What would make it a worse choice than it looks, and what alternative is missing?`,
    tooltip: 'Ask Olumi to argue against this option',
  },
  constraint: {
    prompt: (label) =>
      `Challenge the constraint "${label}". Is it real, is it set at the right level, and who could relax it?`,
    tooltip: 'Ask Olumi to argue this constraint is wrong or negotiable',
  },
}

/** The sentence dropped into the composer for a node challenge. */
export function buildNodeChallengePrompt(nodeType: NodeType | undefined, label: string): string {
  const perKind = nodeType ? PER_KIND[nodeType] : undefined
  return (perKind?.prompt ?? GENERIC_CHALLENGE_PROMPT)(label)
}

/** The context menu entry's tooltip for the same act. */
export function challengeTooltipFor(nodeType: NodeType | undefined): string {
  const perKind = nodeType ? PER_KIND[nodeType] : undefined
  return perKind?.tooltip ?? GENERIC_CHALLENGE_TOOLTIP
}

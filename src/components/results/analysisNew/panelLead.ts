/**
 * ⭐⭐ WHAT THE PANEL LEADS WITH — ONE OWNER, BECAUSE TWO SURFACES ASK IT.
 *
 * Paul's ruling, 17 Sep 2026: *"The slot means 'the most important thing on
 * this panel right now' — the conclusion when there is one, otherwise the
 * question being worked on."* That makes the panel's largest type a FUNCTION
 * of whether a conclusion exists, and two components must agree on the answer:
 * `AtAGlance` (which renders the conclusion) and `ModelStrip` (which renders
 * the subject, and must stand down when the conclusion speaks).
 *
 * ⛔ THE COPY IS THE DEFECT, NOT THE EXPRESSION. `Boolean(leaderLabel ??
 * headline)` is three tokens long and would have been trivially re-typed at the
 * second call site — which is exactly how this estate's dominant defect starts
 * (CLAUDE.md trap 12: a list a human must remember to sync WILL drift, and the
 * drift always reads as green). Two copies of this predicate disagreeing means
 * either NOTHING on the panel carries the lead size, or TWO things do, and
 * neither state has a red anywhere: both components render, both pass their own
 * suites, and only a reader looking at the deployed pixels would see it.
 *
 * ⚠ ONE FACT, TWO SHAPES, AND THAT IS WHY BOTH LIVE HERE. `conclusionLabel`
 * answers *which string names the conclusion* and `panelHasConclusion` answers
 * *is there one* — different questions (trap 21), but the second is DERIVED
 * from the first rather than re-stated, so they cannot drift apart. Had the
 * boolean been written independently it would have been the mirror one level
 * down.
 *
 * ⚠ `Boolean(...)`, NOT `!== null`, AND THE DIFFERENCE IS REACHABLE. `??`
 * falls through on null/undefined only, so a `leaderLabel` of `''` — a producer
 * naming an option with an empty label — yields `''`, which `!== null` would
 * call a conclusion and `Boolean` correctly does not. This preserves the
 * expression `AtAGlance` shipped with, byte for byte in behaviour; it is not a
 * tidy-up of it.
 */
import type { AtAGlance } from './analysisNewTypes'

/**
 * Only the two fields the question turns on, so a caller holding a partial
 * glance (a test fixture, a future narrower view model) can still ask it.
 */
export type GlanceLead = Pick<AtAGlance, 'leaderLabel' | 'headline'>

/**
 * The string that names this run's conclusion, or null when the producer named
 * none. `leaderLabel` is the leading option's LABEL and `headline` the composed
 * sentence; the label wins because a surface that can typeset the subject alone
 * should, and the sentence is the fallback for runs that carry no separable
 * subject.
 */
export function conclusionLabel(glance: GlanceLead): string | null {
  return glance.leaderLabel ?? glance.headline
}

/** Whether this run reached a conclusion the panel is entitled to lead with. */
export function panelHasConclusion(glance: GlanceLead): boolean {
  return Boolean(conclusionLabel(glance))
}

/**
 * goalLabelProvenance — may the product present this goal label AS the goal?
 *
 * ─── THE DEFECT THIS ANSWERS ────────────────────────────────────────────────
 * CEE authors an objective for the goal node (`deriveGoalObjectiveLabel`) and
 * REFUSES where the quote holds no objective to derive — a deliberation frame,
 * a clause that would be discarded, or simply more than nine words. On refusal
 * the user's VERBATIM SENTENCE stays as the label, and CEE stamps
 * `provenance: 'from_brief'` to say so. CEE measured 9 of 13 authored on its own
 * governed corpus, so roughly a third of stated goals arrive as a raw fragment
 * — "We need a direction before the January board meeting" — and every surface
 * then prints it as *the goal*. That is a category error: a stated fact is not
 * an objective, and it is the first thing a stranger reads.
 *
 * ─── WHY `provenance`, AND NOT `source_quote`/`label_authored` ──────────────
 * Both of those exist at CEE and BOTH ARE DARK ON THIS PATH. Three dated live
 * captures (`src/lib/coherence/__tests__/fixtures/captures/`,
 * 16–17 Aug 2026) carry the goal node as
 * `{ kind:'goal', label:<fragment>, provenance:'from_brief' }` with NO
 * `source_quote` and NO `label_authored`. A guard keyed on either would have
 * been a guard that never fires (the estate's reachability trap: a path can be
 * live while the producer cannot feed it). `provenance` is the carrier that
 * actually arrives, and `mapDraftNodeToCanvas` already spreads it onto
 * `data` — so nothing here is minted, plumbed or invented.
 *
 * ─── THE CANONICAL OWNER ────────────────────────────────────────────────────
 * The classification itself is NOT redecided here. `classifyNodeProvenance`
 * (`./valueProvenance`) is the one authority on what a `CEEProvenance` literal
 * means; this module is a NAMED APPLICATION of it to one question, so a change
 * to the vocabulary lands in one place and reaches this predicate for free.
 * `from_brief` classifies as `kind: 'brief'`, and `'brief'` is precisely
 * "these are the user's words, lifted" — which is the whole claim.
 *
 * ⚠ `ai_inferred` DELIBERATELY DOES NOT FIRE. That is Olumi's authored
 * objective, a different claim with a different remedy; folding it in here
 * would quietly turn this into a judgement about goal QUALITY, which is the
 * inference this lane is forbidden to make.
 */

import { classifyNodeProvenance } from './valueProvenance'

/** The one testid for the notice, DERIVED by every surface and every spec. */
export const GOAL_LABEL_FROM_BRIEF_TESTID = 'pre-analysis-v3-goal-from-brief'

/**
 * The one sentence. Held here rather than in a per-surface copy file so the
 * three surfaces that render it cannot drift into three different claims.
 *
 * It states the PROVENANCE and hands over the pen. It does not guess what the
 * user meant, does not rank the goal, and does not apologise — the extract may
 * well be right, and the product simply has not been told that it is.
 */
export const GOAL_LABEL_FROM_BRIEF_COPY = {
  /** The chip/pill. Short enough to sit beside the label on a canvas node. */
  pill: 'From your brief',
  /** The full claim, wherever there is room for a line of it. */
  notice: 'Taken from your brief — not yet confirmed as your goal. Edit it to say what you want to achieve.',
} as const

/**
 * True when this goal node's label is an unconfirmed extract from the brief.
 *
 * Takes the node's `data` (not a node, not an id) so a caller cannot pass the
 * wrong object and get a plausible answer.
 */
export function goalLabelIsUnconfirmedBriefExtract(
  data?: { provenance?: unknown } | null,
): boolean {
  const provenance = data?.provenance
  if (typeof provenance !== 'string') return false
  return classifyNodeProvenance(provenance)?.kind === 'brief'
}

/**
 * The provenance a node carries once a HUMAN has authored its label.
 *
 * ⚠ SCOPED TO `goal`, AND THE SCOPE IS THE POINT. On a factor, `data.provenance`
 * answers a different question — who owns the VALUE — and `provenanceToPill`
 * renders `user_set` as "Set by you". Stamping it on a rename would credit the
 * user with a number Olumi estimated: two questions under one field name, which
 * is the estate's chronic defect. A goal node has no value, so on a goal the
 * field can only be speaking about the label.
 *
 * Returns `undefined` for every other kind, meaning "write nothing".
 */
export function provenanceAfterHumanAuthoredLabel(
  kind?: string | null,
): 'user_set' | undefined {
  return kind === 'goal' ? 'user_set' : undefined
}

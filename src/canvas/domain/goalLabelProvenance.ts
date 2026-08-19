/**
 * goalLabelProvenance — may the product present this goal label AS the goal?
 *
 * ─── THE DEFECT THIS ANSWERS ────────────────────────────────────────────────
 * CEE authors an objective for the goal node (`deriveGoalObjectiveLabel`) and
 * REFUSES where the quote holds no objective to derive — a deliberation frame,
 * a clause that would be discarded, or simply more than nine words. On refusal
 * the user's VERBATIM SENTENCE stays as the label. CEE measured 9 of 13 authored
 * on its own governed corpus, so roughly a third of stated goals arrive as a raw
 * fragment — "We need a direction before the January board meeting" — and every
 * surface then prints it as *the goal*. That is a category error: a stated fact
 * is not an objective, and it is the first thing a stranger reads.
 *
 * ─── ⚠ WHAT THIS PREDICATE ACTUALLY KEYS ON, AND WHY IT IS WIDER ────────────
 * THIS HEADER USED TO SAY CEE STAMPS `provenance: 'from_brief'` TO REPORT THAT
 * REFUSAL. IT DOES NOT, AND THE SENTENCE IS WITHDRAWN — derived at the producer
 * bytes, not inferred here:
 *
 *   · `from_brief` is a DISPLAY projection of the node's `extractionType`
 *     (`olumi-assistants-service` `src/cee/transforms/provenance-display.ts:24-29`
 *     — `explicit`/`observed` → `from_brief`, everything else → `ai_inferred`).
 *     Its own doc says "extracted directly from the brief". It answers *where
 *     did this node's CONTENT come from*, and says NOTHING about whether the
 *     label is the user's words or Olumi's authored objective.
 *   · The field that answers THAT is `label_authored`
 *     (`src/schemas/cee-v3.ts`): *"TRUE when `label` is our authored display
 *     string rather than the user's verbatim words … DERIVED at the producer
 *     from `label !== source_quote`"*.
 *
 * CONSEQUENCE, STATED DELIBERATELY RATHER THAN LEFT TO BE DISCOVERED: this
 * predicate fires on a SUPERSET of the raw-fragment case. A goal whose content
 * was extracted from the brief AND whose label CEE successfully authored is
 * `extractionType: 'explicit'` too, so it is `from_brief` and it gets the
 * notice. The notice is not a claim that the label is unauthored — and the copy
 * below was written so that it is true of the whole superset: an authored
 * objective derived from the brief IS taken from your brief and IS not yet
 * confirmed by you. What we do NOT have on this wire is the ability to say the
 * narrower thing.
 *
 * ─── WHY `provenance` IS NEVERTHELESS THE CARRIER ───────────────────────────
 * `source_quote` and `label_authored` both exist at CEE and BOTH ARE DARK ON
 * THIS PATH. Three dated live captures
 * (`src/lib/coherence/__tests__/fixtures/captures/`, 16–17 Aug 2026) carry the
 * goal node as `{ kind:'goal', label:<fragment>, provenance:'from_brief' }` with
 * NO `source_quote` and NO `label_authored`; `label_authored` returns zero hits
 * in this repo outside comments. A guard keyed on either would have been a guard
 * that never fires (the estate's reachability trap: a path can be live while the
 * producer cannot feed it). `provenance` is the carrier that actually arrives,
 * and `mapDraftNodeToCanvas` already spreads it onto `data` — so nothing here is
 * minted, plumbed or invented. Narrowing this to the raw-fragment case is a
 * PRODUCER change (put `label_authored` on the draft wire), not a UI one.
 *
 * ─── THE CANONICAL OWNER ────────────────────────────────────────────────────
 * The classification itself is NOT redecided here. `classifyNodeProvenance`
 * (`./valueProvenance`) is the one authority on what a `CEEProvenance` literal
 * means; this module is a NAMED APPLICATION of it to one question, so a change
 * to the vocabulary lands in one place and reaches this predicate for free.
 * `from_brief` classifies as `kind: 'brief'`, i.e. "this came from the brief
 * rather than from Olumi or from the user's later editing" — which is exactly
 * the claim the copy makes, and no more. (It is NOT "these are the user's words,
 * lifted"; that is `label_authored === false`, and it is not on this wire. See
 * the block above.)
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

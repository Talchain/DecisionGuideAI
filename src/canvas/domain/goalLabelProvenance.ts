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
 * The claim, and the act that answers it, PER SURFACE.
 *
 * It states the PROVENANCE and hands the pen back to the user. It does not
 * guess what they meant, does not rank the goal, and does not apologise. The
 * extract may well be right; the product has simply not been told that it is.
 *
 * ⭐⭐ THERE IS NO SINGLE `notice` MEMBER, AND THAT IS THE POINT. One member used
 * to serve all three surfaces, and it ended `"Edit it to say what you want to
 * achieve."` — an imperative that was TRUE ON EXACTLY ONE OF THEM when this
 * split was written. TWO of the three host a writer today, and they are
 * DIFFERENT ACTS, so they are still two different sentences:
 *
 *   · CANVAS GOAL NODE (`nodes/GoalNode.tsx`) — HOSTS THE WRITER. Double-click
 *     runs `handleNodeDoubleClick` → `requestNodeRename` → the inspector shell's
 *     `EditableLabel`, which is OUTSIDE `InspectorRouter`'s `<fieldset disabled>`
 *     and ungated on node kind, and saves through `store.updateNodeLabel` →
 *     `provenanceAfterHumanAuthoredLabel('goal')` → `'user_set'`. A DOUBLE-CLICK
 *     on a node, which is not the gesture the hero's field asks for.
 *   · PRE-ANALYSIS HERO (`pre-analysis-v3/hero/HeroSection.tsx`) — HOSTS ITS
 *     OWN WRITER, AND THIS IS THE SURFACE THAT MOVED. Its Goal field was gated
 *     on `CANONICAL_EDIT_AUTHORITY.goalSuccessTarget: 'disabled'` and rendered
 *     a read-only `<span>`, directly ABOVE this notice — so the hero printed
 *     the imperative a user actually read and could not act on. That gate read
 *     the WRONG KEY, not the wrong value: `goalSuccessTarget` governs the
 *     success THRESHOLD, still reads `'disabled'`, and the presentation ruling
 *     in `mutations/mutationAuthority.ts` is untouched. The field is now gated
 *     on `GOAL_LABEL_EDIT_CONNECTED` — `canvasNodeRenameWithServerHash` AND
 *     `preAnalysisV3StructuralAdd`, both `'server_graph'` — and `commitGoal`
 *     writes through the SAME `store.updateNodeLabel` the canvas uses. So the
 *     hero's imperative names the field in front of the user.
 *   · MODEL TAB ROW (`model-tab-v2/ModelRowView.tsx`) — NO GOAL-LABEL WRITER.
 *     `ModelTabV2Panel`'s `editConnectedIds` admits the goal node for its
 *     minimum TARGET only (`modelGoalMinimumTarget`); nothing on that surface
 *     writes the goal's LABEL.
 *
 * ⚠ SO THE MEMBERS ARE DISTINCT BY CONSTRUCTION, EACH BOUND BY THE SURFACE THAT
 * ANSWERS FOR ITS OWN WRITER. Do NOT collapse them back into one, and do NOT
 * write a test that pins two surfaces to AGREEMENT — such a test REDs on
 * whichever surface is corrected first, which is exactly backwards. The shared
 * thing here is the PREDICATE (`goalLabelIsUnconfirmedBriefExtract`) and the
 * TESTID; the sentence is the surface's own, because the act it names is.
 */
export const GOAL_LABEL_FROM_BRIEF_COPY = {
  /** The chip/pill. Short enough to sit beside the label on a canvas node. */
  pill: 'From your brief',
  /** CANVAS GOAL NODE. The one surface that hosts the act it names. */
  canvasNodeNotice:
    'Taken from your brief. You have not confirmed it as your goal yet. Double-click the node to write it in your own words.',
  /** PRE-ANALYSIS HERO. Writes in place, so it names the field above it. */
  heroNotice:
    'Taken from your brief. You have not confirmed it as your goal yet. Edit the Goal field above to say what you want to achieve.',
  /** MODEL TAB ROW. No goal-label writer here, so it names one that has it. */
  modelRowNotice:
    'Taken from your brief. You have not confirmed it as your goal yet. The goal on the canvas is where you write it in your own words.',
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

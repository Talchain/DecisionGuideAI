/**
 * ⭐⭐⭐ DID THE ANALYSIS COUNT THIS NODE? — READ FROM THE PRODUCER'S STAMP,
 * NEVER DERIVED HERE.
 *
 * CEE declares `analysis_participation: 'included' | 'retained_excluded'` on
 * NodeV3 (CEE PR #1581). `retained_excluded` means the node was KEPT in the
 * model and LEFT OUT of the calculation — a fact only the producer holds,
 * because only the producer ran the strip.
 *
 * This module is the whole reader. It has one job and it is a narrow one:
 * turn an open `node.data` bag into either a licensed participation value or
 * `null`. It computes nothing, infers nothing, and has no opinion about what
 * a missing field means.
 *
 * ── ⛔⛔ THE DISPLAY CONTRACT, AGREED WITH CORE. NO CLAUSE IS RELAXABLE ──────
 *
 *  1. An exclusion claim renders ONLY on an explicit `'retained_excluded'`.
 *  2. NEVER from absence. NEVER from a negation. NEVER from an unrecognised
 *     value. Absence stays absent; unknown renders NOTHING.
 *  3. The canvas MUST NOT derive the exclusion. *"Not connected"* and
 *     *"excluded from this calculation"* are DIFFERENT FACTS and CEE owns the
 *     second (CLAUDE.md trap 21 — two questions under one name). A node with no
 *     edges is not an excluded node; it is a node with no edges.
 *
 * ── ⚠⚠ WHY THE EQUALITY IS WRITTEN AGAINST THE ONE LICENSED VALUE ──────────
 *
 * The obvious spelling is `participation !== 'included'`. It is WRONG, and it
 * is wrong in the one direction that matters:
 *
 *     data.analysis_participation === undefined   →  !== 'included'  →  TRUE
 *     data.analysis_participation === 'partial'   →  !== 'included'  →  TRUE
 *     data.analysis_participation === 42          →  !== 'included'  →  TRUE
 *
 * **182,015 existing nodes carry no field at all.** A negation would stamp
 * *"not included in analysis"* on every one of them — manufacturing the exact
 * claim clause 2 forbids, at estate scale, on the day the reader shipped.
 *
 * And it would do so while passing any test written against the two known
 * values, because a test that only ever supplies `'included'` or
 * `'retained_excluded'` cannot observe the third, fourth and infinite cases the
 * negation admits. That is CLAUDE.md trap 13d: an invariant written with the
 * same asymmetry as the code it tests is a guard agreeing with itself. The
 * corpus that would catch it is the one that includes ABSENCE and an
 * UNRECOGNISED string — both of which are reachable at this tip and neither of
 * which is a known value.
 *
 * So: positive equality against the single licensed member, and every other
 * input — absent, wrong-typed, or a value CEE adds later — falls through to
 * `null`. A future third member is unrecognised HERE until someone widens
 * `LICENSED_PARTICIPATION_VALUES` deliberately, which is the safe direction:
 * a new member renders nothing rather than renders the wrong thing.
 *
 * ── WHAT THIS MODULE IS NOT ────────────────────────────────────────────────
 *
 * It is NOT a readiness question. `selectOptionExclusionMessage`
 * (`stores/readinessStore.ts`) answers *"will the run proceed without this
 * OPTION?"* — a PRE-run prediction from CEE's readiness verdict, gated on
 * staleness, option-scoped. This answers *"did the run that produced what you
 * are looking at leave this node out?"* — a stamp on the graph itself, any node
 * type. Named apart deliberately: they are not two spellings of one fact and
 * reconciling them would be the trap-21 move, not the fix.
 */

/**
 * The wire key, as CEE declares it on NodeV3. Snake_case because `node.data` is
 * the raw CEE bag — `DraftChat.tsx` spreads unknown node fields into `data`
 * untouched (`const { id, kind, type, label, observed_state, ...rest } = n`),
 * and `AnyNodeDataImportSchema` is `.passthrough()`, so the field arrives under
 * its producer spelling and is not camelised anywhere on the way.
 */
export const ANALYSIS_PARTICIPATION_KEY = 'analysis_participation' as const

/** The node was counted by the calculation. */
export const PARTICIPATION_INCLUDED = 'included' as const

/** The node was kept in the model and left out of the calculation. */
export const PARTICIPATION_RETAINED_EXCLUDED = 'retained_excluded' as const

/**
 * The complete licensed vocabulary, as a value — not a hand-copied list in a
 * comment somewhere (CLAUDE.md trap 12: a mirror a human must remember to sync
 * WILL drift, and the drift always reads as green). Widening CEE's enum means
 * widening this, in a diff a reviewer can see.
 */
export const LICENSED_PARTICIPATION_VALUES = [
  PARTICIPATION_INCLUDED,
  PARTICIPATION_RETAINED_EXCLUDED,
] as const

export type AnalysisParticipation = (typeof LICENSED_PARTICIPATION_VALUES)[number]

/**
 * ⭐ THE FOUNDER'S RULED WORDING, EXACTLY. Not a template, not a pattern to
 * compose from — the sentence itself, rendered whole.
 *
 * ⚠ DO NOT DECOMPOSE IT. Splitting it into a short pill label (`Unfinished`)
 * plus a longer tooltip looks like a layout improvement and is a different
 * claim: *"Unfinished"* alone is a statement about the node's completeness that
 * the UI would be authoring, and it drops the only half CEE actually stamped —
 * that the calculation left it out. One string, one claim, one author.
 *
 * ⚠ THE EM DASH IS SAFE HERE, AND IT WAS CHECKED RATHER THAN ASSUMED.
 * `noEmDashesInRenderedCopy` derives its corpus from the import closure of
 * `TAB_RENDER_ROOT = 'src/components/results/analysisNew/AnalysisNewTabBody.tsx'`
 * (`src/test/helpers/reasoningTabCopyScope.ts:111`) — the Reasoning tab. Canvas
 * node cards are not in that closure, and sibling node copy already carries em
 * dashes on green CI (`GoalNode.tsx:807`, `OptionNode.tsx:1255`).
 */
export const UNFINISHED_CONTRIBUTION_COPY = 'Unfinished — not included in analysis.'

/** The pill's identity, so an assertion binds to THIS claim and not to the
 *  shape of a `StatusPill` (CLAUDE.md trap 19 — bind by identity, never by an
 *  appearance another element could satisfy). Deliberately distinct from
 *  `excluded-from-analysis-pill`, which carries the readiness question. */
export const UNFINISHED_CONTRIBUTION_TEST_ID = 'unfinished-contribution-pill'

/**
 * Read the participation stamp off an open node-data bag.
 *
 * @returns the licensed value CEE stamped, or `null` for **absence, a
 * non-string, and any value outside the licensed set**. Those three are
 * deliberately one outcome: none of them licenses a claim, and distinguishing
 * them here would only tempt a caller into treating one of them as a signal.
 *
 * Total on `unknown` so it is safe on a raw bag, a React Flow `data` prop, or
 * anything a future caller hands it. No throw path.
 */
export function readAnalysisParticipation(data: unknown): AnalysisParticipation | null {
  if (data === null || typeof data !== 'object') return null
  const raw = (data as Record<string, unknown>)[ANALYSIS_PARTICIPATION_KEY]
  if (typeof raw !== 'string') return null
  // Positive membership against the licensed set — see the header. An
  // `!== 'included'` negation here would return true for every one of the
  // 182,015 unstamped nodes.
  return (LICENSED_PARTICIPATION_VALUES as readonly string[]).includes(raw)
    ? (raw as AnalysisParticipation)
    : null
}

/**
 * ⭐ THE GATE THE RENDER HANGS ON, AND IT IS INERT AT THIS TIP BY CONSTRUCTION.
 *
 * `true` only when CEE has explicitly stamped `'retained_excluded'`. Nothing in
 * the estate emits that value yet — swept at `eb7211d7` with a contrast control
 * (`analysis_participation` 0 files / `selectOptionExclusionMessage` 2 files, so
 * the probe was not blind) — which means every reachable node today takes the
 * `false` branch and nothing new renders.
 *
 * That is the shipping condition, not an accident of it: the consumer goes in
 * ready, and the day Core's emitter lands the claim appears with no UI deploy.
 */
export function isRetainedExcludedFromAnalysis(data: unknown): boolean {
  return readAnalysisParticipation(data) === PARTICIPATION_RETAINED_EXCLUDED
}

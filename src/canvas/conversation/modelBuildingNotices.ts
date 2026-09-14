/**
 * modelBuildingNotices — the wire binding and the ONLY copy authority for
 * CEE's `model_building_notices`.
 *
 * WHAT THE PRODUCER SENDS, AND WHAT IT DELIBERATELY DOES NOT
 * ----------------------------------------------------------
 * When Olumi drafts a model from a brief it drops things it could not
 * represent, and it records why. `model_building_notices` is that record. It is
 * a DECLARED, OPTIONAL field on `OlumiResponseSchema` (schemas 0.48.0,
 * `olumi-response.js:234`) — NOT an `__additive__` sidecar like
 * `_grounded_selection` / `_answer_shape`, so it is read straight off the
 * response surface rather than through the demotion channel.
 *
 * Its shape, read at the vendored 0.48.0 bytes (never inferred):
 *
 *   { total_count: number,
 *     groups: Array<{ kind: ModelBuildingNoticeKind, count: number }>,
 *     details_redacted: true }
 *
 * `.strict()` at every level, `groups` is `.min(1).max(6)`, and a `superRefine`
 * enforces TWO cross-field rules: group kinds are UNIQUE, and `total_count`
 * EQUALS the sum of the group counts. Both matter to this consumer:
 * uniqueness is why a kind can key a display row, and the sum rule is why
 * `total_count` can be rendered as a headline quantity without the UI
 * re-deriving it.
 *
 * ⚠ `details_redacted` IS A LITERAL `true`. The producer sends AGGREGATE COUNTS
 * PER KIND AND NOTHING ELSE — no free text, no per-item detail, no next step.
 * Everything a user reads here is therefore UI copy keyed to a closed enum,
 * which is exactly why the copy lives in ONE place (this file) and is derived
 * from the enum rather than hand-listed at a call site.
 *
 * ── WHY THE KIND CODES NEVER REACH A USER ──────────────────────────────────
 * The estate already prints raw wire vocabulary at users (`existence_boundary_
 * crossing`). This consumer never does: `describeModelBuildingNoticeKind` is
 * the only path from a kind to a rendered string, and a kind with no human
 * phrasing renders NOTHING rather than falling back to its code. That is the
 * same posture as `AnalysisRefusalNotice`'s unmapped-code rule, minus the
 * details disclosure — there the raw code was the only remaining information,
 * here the count is still fully renderable without it.
 *
 * ── COMPLETENESS IS COMPILE-TIME, NOT HAND-MAINTAINED (CLAUDE.md trap 12) ───
 * `KIND_DESCRIPTIONS` is typed `Record<ModelBuildingNoticeKind, string>`. A
 * seventh enum member arriving in a future schema bump FAILS TYPECHECK here
 * rather than silently rendering one fewer row than the count promises. A
 * hand-kept list with a `default:` arm would drift green; this cannot.
 */
import {
  ModelBuildingNoticesSchema,
  type ModelBuildingNoticeKind,
  type ModelBuildingNotices,
} from '@talchain/schemas/boundary'

/**
 * One display row: a kind the UI can name, its count, and the human phrasing.
 * The kind is retained for test binding BY IDENTITY and for `data-` attributes;
 * it is never rendered as text.
 */
export interface ModelBuildingNoticeRow {
  readonly kind: ModelBuildingNoticeKind
  readonly count: number
  readonly description: string
}

/** The view-model the bubble renders. Built only from what the producer sent. */
export interface ModelBuildingNoticesView {
  /** The producer's `total_count`. Schema-guaranteed to equal the row sum. */
  readonly totalCount: number
  /** Nameable rows, producer order preserved. */
  readonly rows: readonly ModelBuildingNoticeRow[]
}

/**
 * kind -> ONE plain-English noun phrase naming WHAT HAPPENED TO IT.
 *
 * ⭐⭐ REWRITTEN 11 Sep 2026. THREE OF THE SIX WERE FALSE AGAINST THE PRODUCER.
 * Each phrase must be true of EVERY producer reason mapped to its kind — the
 * wire carries the kind, never the reason, so a phrase true of only one reason
 * under it is a lie on the others. Derived at `projector.ts:352-615` and CEE's
 * `NOTICE_KIND_BY_REASON`; the corpus and the quotes are in
 * `modelBuildingNotices.whatIsActuallyMissing.spec.tsx`.
 *
 *   detail_not_connected   was "aren't LINKED to anything else yet", which says
 *                          the detail is on the graph. Both its reasons
 *                          WITHDRAW the node ("projected as a node and then
 *                          withdrawn"). It is not unlinked; it is gone.
 *   alternative_consolidated  was "Alternatives that were merged", which reads
 *                          as the USER's choice set. All three reasons dispose
 *                          of MODEL-emitted options ("a STATED option is NEVER
 *                          demoted"). Naming them as the user's is the exact
 *                          mis-attribution the producer refuses to make.
 *   conflict_resolved_conservatively  was "your brief conflicted with itself",
 *                          false for `constraint_direction_unstated`, where
 *                          nothing conflicted — a direction was simply unstated.
 *   target_not_modelled_as_threshold  was "Targets KEPT as plain values", false
 *                          for `stated_target_value_dropped`, where "that number
 *                          reached the graph NOWHERE".
 *   other                  was "didn't FIT the model", false for
 *                          `claim_label_not_a_name` ("the node IS on the graph
 *                          ... nothing was dropped") and for
 *                          `factor_merged_into_stated_cause`.
 *
 * ⚠ NO KIND GETS A SENTENCE THAT CLAIMS MORE THAN THE COUNT SUPPORTS. The
 * producer sends a count and a kind — not which factor, not which sentence of
 * the brief. So these name a CATEGORY and stop. Adding "for example, X" here
 * would fabricate detail the wire explicitly redacted (`details_redacted`).
 */
const KIND_DESCRIPTIONS: Record<ModelBuildingNoticeKind, string> = {
  detail_not_connected: 'Details that nothing connected to your goal',
  relationship_not_used: "Connections Olumi proposed but couldn't place in the model",
  alternative_consolidated: 'Overlapping alternatives folded into one option',
  conflict_resolved_conservatively:
    "Points Olumi couldn't settle, so it took the cautious reading",
  target_not_modelled_as_threshold: "Targets you set that the model doesn't test against",
  other: 'Other choices Olumi made while building the model',
}

/**
 * ⭐⭐ WHOSE THE MISSING THING WAS — THE FIX FOR COPY THAT ATTRIBUTED OLUMI'S
 * OWN INVENTIONS TO THE USER.
 *
 * The deployed headline read *"Olumi left 14 things FROM YOUR BRIEF out of this
 * model"* and the modal row read *"Details YOU MENTIONED ..."*. Derived at the
 * producer (`olumi-assistants-service` staging `7aa49ec8`), neither claim is
 * one this wire can support:
 *
 *   relationship_not_used  ALL EIGHT reasons dispose of an EDGE, and an edge is
 *                          never the user's. `ProjectedEdge.origin` is typed
 *                          `"ai" | "default"` (`projector.ts:759`), so a
 *                          user-authored edge IS NOT REPRESENTABLE; the only
 *                          claim-derived mint is `origin: "ai",
 *                          provenance_source: "inferred",
 *                          provenance_class: "ai_inferred"` UNCONDITIONALLY
 *                          (`:3029-3053`); and `DroppedRecordRef` is declared
 *                          *"A reference THE MODEL EMITTED"* (`:351`).
 *   detail_not_connected   MIXED, and undiscoverable here. The connectivity
 *                          prune is `(n.kind === "factor" || n.kind ===
 *                          "constraint") && !reachesGoal.has(n.id)`
 *                          (`:3131-3133`) — NO provenance filter — and records
 *                          `claim_kind: provenance_class === "stated"
 *                          ? "stated_item" : "claim"` (`:3142`). Both.
 *
 * ⚠ AND `claim_kind` NEVER REACHES THIS WIRE. At the branch's own pinned
 * contract (`vendor/talchain-schemas-0.55.0.tgz`, read at the tarball rather
 * than `node_modules`, which is 46 minor versions stale here),
 * `ModelBuildingNoticesSchema` carries `{ total_count, groups: [{ kind, count }],
 * details_redacted: true }` and nothing else. So where a kind is mixed, the
 * product does not know, and the copy must claim NEITHER.
 *
 * ⭐ THIS IS THE STANDARD THIS FILE ALREADY SET, APPLIED CONSISTENTLY. The
 * demotion of `alternative_consolidated` above rests on exactly this argument.
 *
 * ⚠⚠ HONEST IN BOTH DIRECTIONS — DELETING EVERY ATTRIBUTION WOULD BE ITS OWN
 * DEFECT. `target_not_modelled_as_threshold` is UNANIMOUSLY the user's: both
 * reasons emit `claim_kind: "stated_item"` with the user's verbatim quote
 * (`projector.ts:2618-2626`). "Targets YOU SET" is earned and is KEPT. A blanket
 * ban on the second person would under-attribute a real loss of the user's own
 * words, and would leave the guard unable to discriminate at all.
 *
 * ⚠ COMPLETENESS IS COMPILE-TIME (trap 12), as with `KIND_OUTCOME`: a seventh
 * enum member FAILS TYPECHECK here rather than silently defaulting into
 * `user_stated`, which is the direction that would hurt.
 */
export type ModelBuildingNoticeAttribution = 'user_stated' | 'olumi_authored' | 'mixed'

const KIND_ATTRIBUTION: Record<ModelBuildingNoticeKind, ModelBuildingNoticeAttribution> = {
  // The prune has no provenance filter; `claim_kind` is `stated_item` OR `claim`.
  detail_not_connected: 'mixed',
  // Every reason disposes of an edge, and no edge is user-authored.
  relationship_not_used: 'olumi_authored',
  // All three dispose of MODEL-emitted options.
  alternative_consolidated: 'olumi_authored',
  // `constraint_direction_unstated` is `stated_item`; the two parallel-conflict
  // reasons are the model's own claims colliding. Mixed — claim neither.
  conflict_resolved_conservatively: 'mixed',
  // Both reasons emit `claim_kind: "stated_item"` with the user's own quote.
  target_not_modelled_as_threshold: 'user_stated',
  // `claim_label_not_a_name` is gated on `ai_inferred`; a STATED option is never
  // dropped for budget; the merged factor is the model's restatement.
  other: 'olumi_authored',
}

/**
 * The ONLY kind -> attribution path. Unknown kinds are `mixed`, which is
 * FAIL-CLOSED: an unrecognised kind may never be told to the user as their own.
 */
export function modelBuildingNoticeAttribution(kind: string): ModelBuildingNoticeAttribution {
  return Object.prototype.hasOwnProperty.call(KIND_ATTRIBUTION, kind)
    ? KIND_ATTRIBUTION[kind as ModelBuildingNoticeKind]
    : 'mixed'
}

/**
 * ⭐⭐ WHAT THE COUNT IS ALLOWED TO CLAIM — THE FIX FOR A HEADLINE THAT COUNTED
 * THINGS STILL IN THE MODEL.
 *
 * Deployed on 11 Sep 2026, on a ~60-word brief: *"Olumi left 14 things from
 * your brief out of this model"*. Derived at the producer, NINE of the
 * TWENTY-ONE reasons CEE maps onto these six kinds describe content that IS IN
 * THE GRAPH,
 * and two whole kinds are unanimous about it. In the producer's own words:
 *
 *   constraint_direction_unstated  "The node keeps the user's words; the
 *                                   THRESHOLD is withheld ... THIS IS THE ASK,
 *                                   NOT A LOSS."
 *   claim_label_not_a_name         "The node IS on the graph ... Nothing was
 *                                   dropped, refused or shortened."
 *   refinement_merged_into_stated_option  "The projector BINDS IT TO THE
 *                                   PARENT'S NODE."
 *
 * So the headline was making a false claim about the user's own words on the
 * one channel whose entire purpose is telling them the truth about what was
 * lost — and a second one beside it, because every reason under
 * `alternative_consolidated` disposes of MODEL-emitted content rather than
 * anything "from your brief".
 *
 * ⚠⚠ HOW BIG IS THE OVER-COUNT? UNMEASURED ON THE WITNESSED DRAFT, AND THE ONE
 * BANKED FIGURE SAYS **SMALL** — recorded here so nobody inherits the opposite.
 * On both real banked B3 captures the projector produced 56 disclosures and the
 * DOMINANT CLASS was `unconnected_to_goal` at 51 of 56 (`transforms/schema-v3.ts:1831`),
 * which is `detail_not_connected` and IS genuinely absent. On that corpus this
 * change moves the headline 56 -> ~51, not 56 -> 5. The 14 witnessed on 11 Sep
 * has never been broken down, and a capture is the only thing that would.
 *
 * ⭐ SO THE COUNT IS NOT THE BIGGEST LIE ON THIS SURFACE — THE ROW COPY WAS.
 * At 51 of 56, the modal row said "Details you mentioned that aren't LINKED to
 * anything else yet", which tells the user the detail is on the graph and merely
 * unattached. The producer WITHDRAWS it. Nine in ten disclosures were describing
 * a deletion as a loose end. That is fixed in `KIND_DESCRIPTIONS` above, and it
 * is the change on this surface most likely to matter to a real user.
 *
 * ── THE RULE, AND WHY IT IS THE ONLY ONE THE WIRE SUPPORTS ──────────────────
 * A kind is `absent` only when EVERY producer reason mapped to it puts the
 * content outside the graph. The wire carries the KIND and not the reason, so a
 * kind with even one in-model reason cannot support an omission claim for the
 * items it counts. That leaves `relationship_not_used` and
 * `detail_not_connected` and nothing else.
 *
 * The two MIXED kinds are NOT forced into the nearest bucket. That is the
 * producer's own ruling, applied one level up: *"a coarse-but-true bucket beats
 * a specific-but-false one on a channel whose purpose is telling the truth
 * about what was lost"*. They render under their own heading, claiming neither.
 *
 * ⚠ COMPLETENESS IS COMPILE-TIME (trap 12). `Record<ModelBuildingNoticeKind, …>`
 * means a seventh enum member FAILS TYPECHECK here rather than silently
 * defaulting into `absent` and inflating the omission count — which is the
 * direction that would hurt, and exactly what a `default:` arm would do.
 */
export type ModelBuildingNoticeOutcome = 'absent' | 'present_changed' | 'other_notes'

const KIND_OUTCOME: Record<ModelBuildingNoticeKind, ModelBuildingNoticeOutcome> = {
  // Both reasons withdraw the record from the graph.
  detail_not_connected: 'absent',
  // All eight reasons leave the LINK unmade.
  relationship_not_used: 'absent',
  // All three fold MODEL-emitted content into a node that survives.
  alternative_consolidated: 'present_changed',
  // All three choose canonically and keep the user's words.
  conflict_resolved_conservatively: 'present_changed',
  // `stated_target_not_represented_as_threshold` is on the graph;
  // `stated_target_value_dropped` reached it "NOWHERE". Mixed — claim neither.
  target_not_modelled_as_threshold: 'other_notes',
  // `claim_label_not_a_name` and `factor_merged_into_stated_cause` are on the
  // graph; `option_budget_exceeded` was "left OFF". Mixed — claim neither.
  other: 'other_notes',
}

/** The ONLY kind -> outcome path. Unknown kinds claim nothing. */
export function modelBuildingNoticeOutcome(kind: string): ModelBuildingNoticeOutcome {
  return Object.prototype.hasOwnProperty.call(KIND_OUTCOME, kind)
    ? KIND_OUTCOME[kind as ModelBuildingNoticeKind]
    : 'other_notes'
}

/** The order the groups render in. The loss the user can act on comes first. */
export const OUTCOME_ORDER: readonly ModelBuildingNoticeOutcome[] = [
  'absent',
  'present_changed',
  'other_notes',
]

/**
 * The heading above each group. These are the sentences that make the rows
 * legible, so they carry the in/out claim the headline no longer over-states.
 */
export const OUTCOME_HEADINGS: Record<ModelBuildingNoticeOutcome, string> = {
  absent: 'Not in this model',
  present_changed: 'In the model, handled differently',
  other_notes: 'Also noted',
}

/**
 * How many of the rendered rows the product can HONESTLY call missing.
 *
 * ⚠ DERIVED FROM `rows`, NOT FROM `groups`, AND THAT IS FAIL-CLOSED ON PURPOSE.
 * A kind this UI cannot name is absent from `rows`, so it cannot be counted as
 * an omission — we do not know what a future kind means, and guessing `absent`
 * would inflate the one number a user is most likely to act on.
 */
export function absentCountOf(rows: readonly ModelBuildingNoticeRow[]): number {
  return rows.reduce(
    (sum, row) => (modelBuildingNoticeOutcome(row.kind) === 'absent' ? sum + row.count : sum),
    0,
  )
}

/**
 * The ONLY kind -> user-visible-string path. Returns `null` for anything not
 * nameable, so a caller cannot accidentally render a code.
 */
export function describeModelBuildingNoticeKind(kind: string): string | null {
  return Object.prototype.hasOwnProperty.call(KIND_DESCRIPTIONS, kind)
    ? KIND_DESCRIPTIONS[kind as ModelBuildingNoticeKind]
    : null
}

/**
 * The collapsed summary line. Count-led and past tense: it states what happened
 * to the model the user is looking at, and nothing about why.
 *
 * ⭐⭐ IT COUNTS `absentCountOf(rows)`, NEVER `totalCount`. The two are
 * different quantities and the deployed build rendered the wrong one — see
 * `KIND_OUTCOME` for the derivation and the measured sentence. `totalCount`
 * remains the producer's and is still rendered in full in the breakdown; what
 * changes is that the OMISSION CLAIM is scoped to the rows that support it.
 *
 * ⭐⭐ AND IT SAYS NOTHING ABOUT WHOSE THE MISSING THINGS WERE. The deployed
 * sentence was *"Olumi left 14 things FROM YOUR BRIEF out of this model"*, and
 * `absentCountOf` counts exactly the two kinds for which that clause is false or
 * unknowable — see `KIND_ATTRIBUTION`. Every kind in the `absent` bucket is
 * `olumi_authored` or `mixed`, so the headline states the loss and stops. The
 * row copy, which knows the KIND, carries what attribution the producer earns.
 *
 * ⚠ THE ZERO-ABSENT ARM IS NOT A REASSURANCE, AND MUST NEVER BECOME ONE. When
 * nothing is unanimously missing the line says what Olumi DID, not that the
 * brief survived intact — a completeness claim here would be built on kinds
 * that are MIXED, i.e. on items that may well be missing. It also may not mint
 * "left 0 things out": the file's two standing fabrication bans apply to this
 * arm exactly as they apply to an absent payload.
 *
 * ⚠⚠ AND IT IS ASSERTED POSITIVELY, WHICH IT WAS NOT. A post-merge audit
 * replaced this whole arm with `return ''` and ALL 44 tests across the three
 * notices specs stayed GREEN — every assertion touching it was a NEGATIVE
 * (`not.toMatch(/left \d+/)`), and a negative passes on the empty string. The
 * arm fires on `total_count: 1`, the most likely draft of all, and an emptied
 * one renders a toggle with NO ACCESSIBLE NAME. Pinned as whole-string
 * equalities and by accessible name in
 * `modelBuildingNotices.attributionIsEarned.spec.tsx` (trap 13: an absence
 * proved with no positive control proves nothing).
 *
 * Mirrors the established receipt phrasing ("Olumi made N adjustments to keep
 * the model valid") so the two disclosures read as one voice.
 */
export function modelBuildingNoticesSummary(view: ModelBuildingNoticesView): string {
  const absent = absentCountOf(view.rows)

  if (absent > 0) {
    return absent === 1
      ? 'Olumi left 1 thing out of this model'
      : `Olumi left ${absent} things out of this model`
  }

  return view.totalCount === 1
    ? 'Olumi made 1 modelling choice worth checking'
    : `Olumi made ${view.totalCount} modelling choices worth checking`
}

/**
 * The one pointer line — the "useful next route" the product constraint
 * requires, and the reason this notice is not an honest dead end.
 *
 * ⚠ TRUE BY CONSTRUCTION, NOT BY CONVENTION, and that is the whole test it had
 * to pass. It names a CONVERSATIONAL ACTION, not a control this notice renders:
 * the bubble always sits in a thread the user is already typing into, so
 * "tell Olumi" is available wherever this can appear. The alternative wording
 * ("click Add to model") would name an affordance that does not exist — the
 * exact defect #684's review D2 caught in `ANALYSIS_REFUSAL_POINTER`.
 *
 * It also promises only what the product genuinely does: the user says which
 * omissions matter, and the next turn can work them in. It does NOT promise
 * that Olumi will succeed, or name a mechanism.
 */
export const MODEL_BUILDING_NOTICES_POINTER =
  'Tell Olumi which of these matter and it can work them into the model.'

/**
 * Wire binding. Reads `model_building_notices` off a live CEE turn response.
 *
 * PARSED, NOT TRUSTED — through the published schema itself, so the two
 * cross-field rules (unique kinds, sum equals `total_count`) are enforced here
 * rather than restated. Restating them would be a second copy of a producer
 * rule that can drift (CLAUDE.md trap 12); using the schema cannot.
 *
 * ⚠ FAIL-CLOSED, AND THE ABSENT CASE IS LOAD-BEARING — BUT IT MEANS LESS THAN
 * IT LOOKS LIKE. The contract CANNOT ENCODE ZERO: `total_count` is `.positive()`
 * and `groups` is `.min(1)`, so there is no representable "nothing was dropped"
 * payload. Absence therefore means **no notice attestation was supplied** — NOT
 * "this draft dropped nothing". The two are different claims and only the first
 * is evidence.
 *
 * So absence yields `null`, the caller attaches nothing, and the bubble makes
 * NO CLAIM IN EITHER DIRECTION. Two fabrications are banned here, not one:
 *   · `{ totalCount: 0 }` would put "Olumi left 0 things out of this model" in
 *     front of every user — the mint-a-zero defect this estate has shipped once.
 *   · A reassurance ("nothing was left out", "your brief was captured in full")
 *     would be WORSE: a positive completeness claim built on a silent field,
 *     which is precisely the confident wrongness this capability exists to end.
 *
 * A row whose kind this UI cannot name is DROPPED from `rows` while
 * `totalCount` is preserved verbatim — the count is the producer's, and
 * shrinking it to match what we can phrase would misreport the producer. The
 * renderer is written so the headline count and the row list are never claimed
 * to be the same quantity.
 */
export function extractModelBuildingNoticesSidecar(
  response: unknown,
): ModelBuildingNoticesView | null {
  if (!response || typeof response !== 'object') return null
  const raw = (response as Record<string, unknown>).model_building_notices
  if (raw === undefined || raw === null) return null

  const parsed = ModelBuildingNoticesSchema.safeParse(raw)
  if (!parsed.success) return null

  return toModelBuildingNoticesView(parsed.data)
}

/** Shape the validated producer payload into the view-model. */
export function toModelBuildingNoticesView(
  notices: ModelBuildingNotices,
): ModelBuildingNoticesView {
  const rows: ModelBuildingNoticeRow[] = []
  for (const group of notices.groups) {
    const description = describeModelBuildingNoticeKind(group.kind)
    if (!description) continue
    rows.push({ kind: group.kind, count: group.count, description })
  }
  return { totalCount: notices.total_count, rows }
}

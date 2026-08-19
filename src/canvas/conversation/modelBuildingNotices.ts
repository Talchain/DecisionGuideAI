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
 * kind -> ONE plain-English noun phrase naming WHAT WAS LEFT OUT.
 *
 * Written as things the USER recognises from their own brief, never as
 * descriptions of the model-builder's internal decision. Each is a noun phrase
 * so it reads correctly under the headline without a verb of its own.
 *
 * ⚠ NO KIND GETS A SENTENCE THAT CLAIMS MORE THAN THE COUNT SUPPORTS. The
 * producer sends a count and a kind — not which factor, not which sentence of
 * the brief. So these name a CATEGORY and stop. Adding "for example, X" here
 * would fabricate detail the wire explicitly redacted (`details_redacted`).
 */
const KIND_DESCRIPTIONS: Record<ModelBuildingNoticeKind, string> = {
  detail_not_connected: "Details you mentioned that aren't linked to anything else yet",
  relationship_not_used: "Relationships you described that the model doesn't use",
  alternative_consolidated: 'Alternatives that were merged into a single option',
  conflict_resolved_conservatively:
    'Points where your brief conflicted with itself, settled the cautious way',
  target_not_modelled_as_threshold:
    'Targets kept as plain values rather than pass/fail thresholds',
  other: "Other details that didn't fit the model",
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
 * Mirrors the established receipt phrasing ("Olumi made N adjustments to keep
 * the model valid") so the two disclosures read as one voice.
 */
export function modelBuildingNoticesSummary(totalCount: number): string {
  return totalCount === 1
    ? 'Olumi left 1 thing from your brief out of this model'
    : `Olumi left ${totalCount} things from your brief out of this model`
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

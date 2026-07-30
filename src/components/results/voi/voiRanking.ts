/**
 * voiRanking — the reader between `enrichment.factor_evppi` (schemas 0.30.0,
 * CEE #754) and the V7 evidence disclosure's "Resolve next" view.
 * V7-C slice 1, ROADMAP 2.141; design of record
 * `docs-designs/V7C-EVPPI-RANKING-DESIGN-2026-07-30.md` §2.
 *
 * WHAT THIS IS ALLOWED TO SAY, AND WHY IT IS SO LITTLE
 * ────────────────────────────────────────────────────
 * ISL's per-factor EVPPI is a real Strong–Oakley regression estimate, but it is
 * in the decision's OUTCOME units (`units: 'outcome'`). A magnitude in outcome
 * units has no licensed rendering — there is no goal-unit ruling — so the ONLY
 * things this reader carries are:
 *
 *   · the producer's RANK ORDER, verbatim, and
 *   · the producer's `below_resolution` band, as a demotion.
 *
 * Everything else the wire offers (`evppi`, `evppi_raw`, `noise_floor`,
 * `decision_evpi`, the audit legs, the estimator tags) is deliberately NOT
 * carried onto the model. `evppi` is read for ONE purpose — defensive
 * validation — and never stored, never compared, never used to order. There is
 * therefore no path by which a number can reach the DOM from here.
 *
 * PRODUCER RANK ORDER IS THE CONTRACT. Rows arrive sorted by `evppi`
 * descending. This reader preserves the array order exactly, including a
 * deliberately mis-sorted one: a consumer that "fixes" the order is a consumer
 * that can invert it, and the order is the only thing this surface shows. Ties
 * therefore keep the producer's stable order with no tie-breaking of our own.
 *
 * ABSENT ≠ ZERO, EVERYWHERE. A factor ISL omits (a lever any option intervenes
 * on, or a per-factor estimator drop) gets NO row: not a zero, not a
 * below-resolution entry, not a "no value" line. The reader never enumerates
 * canvas factors and never fills gaps — it maps the wire array and stops.
 *
 * DEGRADE, NEVER FABRICATE. `null` means "the honest gate renders". That is the
 * verdict for an absent/null/empty/non-array block, for a block whose every row
 * failed validation, and for the one structural case in the design: an
 * unlabelable RANK-1 resolved row. We do not rank around a factor we cannot
 * name.
 *
 * NO HEURISTICS. This is not the retired `gap.voi` regime (`selectHinge` /
 * `groupActionItems`, ConfidenceSection's era). There is no fallback chain, no
 * influence×divergence substitute, no threshold: if the real estimator did not
 * produce rows, the view says so.
 */

import { EnrichmentFactorEvppiEntrySchema } from '@talchain/schemas/boundary'
// The repo's one EXPORTED plain-object guard. `transportFailure.ts` already
// carried a byte-identical private copy and was folded onto this one; a seventh
// copy here would have been the same trap-12 mirror. (The six pre-existing
// private copies in src/v5 and src/lib are a separate, rowed migration.)
import { isRecord } from '../../../canvas/conversation/ceeRecovery'

/** A canvas label resolution for a producer `factor_id`. `null` = unlabelable. */
export interface VoiLabelResolution {
  label: string
  /** True when the id maps to a canvas node that can be focused. */
  canFocus: boolean
}

/** One ranking row — a label and a focus target. No magnitude, by construction. */
export interface VoiRankingRow {
  /** Producer factor id. Carried for canvas focus ONLY — never displayed. */
  factorId: string
  /** Resolved canvas node label. A row without one is dropped, never id-shaped. */
  label: string
  canFocus: boolean
}

export interface VoiRanking {
  /** `status: 'resolved'` rows in PRODUCER WIRE ORDER. Rank 1 is index 0. */
  resolved: VoiRankingRow[]
  /** `status: 'below_resolution'` rows in producer order. Demoted, never ranked. */
  belowResolution: VoiRankingRow[]
  /**
   * True when the producer disclosed `FACTOR_EVPPI_PARTIAL`, OR when this
   * reader dropped a row (failed validation / unlabelable / a repeated
   * `factor_id`'s second occurrence). One flag because
   * the user-facing consequence is identical — "some factors couldn't be
   * assessed for this ranking" — and the id lists are unavailable anyway
   * (PLoT drops the structured `detail` arrays, design §1b). A lever's
   * intentional omission is NOT a gap and never sets this.
   */
  someFactorsUnassessed: boolean
}

const PARTIAL_WARNING_CODE = 'FACTOR_EVPPI_PARTIAL'

/**
 * THE ROW CONTRACT, DERIVED FROM THE PINNED SCHEMA — not a second copy of it.
 *
 * The three fields this reader actually reads, picked off
 * `EnrichmentFactorEvppiEntrySchema` (@talchain/schemas 0.30.0, the schema
 * written for exactly this row). Hand-rolled `typeof` checks over the same three
 * fields were a SECOND definition of the row contract in a repo whose #1 hazard
 * is schema skew: the pin can move and a hand-rolled check cannot notice.
 * `.pick()` binds these three to the schema, so a rename or retype of any of
 * them is a compile error here rather than rows silently dropping in production.
 *
 * ⚠ WHY `.pick(…)` AND NOT THE WHOLE SCHEMA. Parsing the FULL entry would also
 * validate the audit legs this reader never reads (`units`, `noise_floor`,
 * `method`, `evppi_raw`, `n_samples`, the clamp booleans, `correlation_active`).
 * A producer that sent one of those with the wrong type would then have its row
 * DROPPED — and if it were rank 1, the whole ranking would collapse to the
 * honest gate. That is a real behaviour change (measured: 3 of 33 probe payloads
 * flip), it is a product judgement about unread fields, and it is not this
 * reader's to make silently. Keeping the pick makes the swap provably
 * behaviour-identical to the checks it replaces.
 *
 * Passthrough survives `.pick()`, so unknown/extra producer keys still parse.
 */
const FactorEvppiRowSchema = EnrichmentFactorEvppiEntrySchema.pick({
  factor_id: true,
  evppi: true,
  status: true,
})

type FactorEvppiRow = ReturnType<typeof FactorEvppiRowSchema.parse>

/**
 * The three deliberate CONSUMER tightenings on top of the wire shape, each
 * stricter than the schema on purpose:
 *
 *   · `factor_id` NON-EMPTY — the wire types it `z.string()`, which admits `''`;
 *     an empty id resolves to no canvas node and can name nothing.
 *   · `evppi` PRESENT and FINITE — the wire types it `z.number().optional()`,
 *     and `z.number()` admits `Infinity`. A row whose magnitude is unreadable is
 *     a row whose status we decline to trust, and the fail-safe direction is to
 *     drop it and disclose rather than to rank it. The value itself goes no
 *     further than this check — it is never stored, compared, or used to order.
 *   · `status` a CLOSED enum — the wire types it OPEN (`z.string()`) so an
 *     unknown status cannot fail transport. Here it must be one of the two bands
 *     we know how to render, because the only other thing we could do with an
 *     unrecognised band is guess which one it means.
 */
function isUsableRow(row: FactorEvppiRow | null): row is FactorEvppiRow {
  return (
    row !== null &&
    row.factor_id.length > 0 &&
    typeof row.evppi === 'number' &&
    Number.isFinite(row.evppi) &&
    (row.status === 'resolved' || row.status === 'below_resolution')
  )
}

/** True when the producer disclosed a partial per-factor assessment. */
function hasPartialWarning(inferenceWarnings: unknown): boolean {
  if (!Array.isArray(inferenceWarnings)) return false
  return inferenceWarnings.some(
    (w) => isRecord(w) && w.code === PARTIAL_WARNING_CODE,
  )
}

export interface BuildVoiRankingInput {
  /** `enrichment.factor_evppi`, as carried by the mapper. Unknown by design. */
  rows: unknown
  /** `inference_warnings[]`, for the PARTIAL disclosure. Unknown by design. */
  inferenceWarnings: unknown
  /** Canvas label resolution — injected so this stays a pure function. */
  resolveLabel: (factorId: string) => VoiLabelResolution | null
}

export function buildVoiRanking({
  rows,
  inferenceWarnings,
  resolveLabel,
}: BuildVoiRankingInput): VoiRanking | null {
  // Absent / null / empty / not-an-array → the honest gate. Never an empty list.
  if (!Array.isArray(rows) || rows.length === 0) return null

  const resolved: VoiRankingRow[] = []
  const belowResolution: VoiRankingRow[] = []
  let droppedAnyRow = false
  /** Set once we have seen the first row the producer marked `resolved`. */
  let sawFirstResolvedRow = false
  /**
   * True when the producer's rank-1 resolved row could not be shown — by EITHER
   * failure mode. The whole view then collapses to the honest gate, because the
   * first surviving row would otherwise wear rank 1's licensed sentence
   * ("Most worth resolving next") without being rank 1.
   */
  let rankOneUnusable = false
  /**
   * `factor_id`s already placed. A repeated id is ONE factor the producer named
   * twice, not two factors — see the dedup below.
   */
  const seenFactorIds = new Set<string>()

  for (const raw of rows) {
    // Defensive validation, fail-safe: drop THAT row, never coerce a value.
    // Shape from the PINNED SCHEMA (`FactorEvppiRowSchema`), then the three
    // consumer tightenings (`isUsableRow`) — both documented above.
    const parsed = FactorEvppiRowSchema.safeParse(raw)
    const wireRow = parsed.success ? parsed.data : null

    if (!isUsableRow(wireRow)) {
      droppedAnyRow = true
      // A row we declined to VALIDATE is a row whose `status` we cannot trust
      // either — the status may be the very field that failed. So we cannot
      // know what rank it held. Rows arrive sorted by `evppi` DESCENDING, which
      // means a drop occurring before any resolved row has survived could have
      // BEEN the producer's rank 1 — and then the first survivor is really
      // rank 2, rendered under rank 1's sentence. That is a rank claim the
      // producer never made, so it collapses to the gate.
      //
      // This is the SAME principle design §2 applies to an unnameable rank 1,
      // applied to the other failure mode: we do not rank around a factor we
      // cannot name, and we do not rank around one we cannot read. It was
      // originally applied to only the label branch, because this `continue`
      // ran before `sawFirstResolvedRow` was set — so `rankOneUnusable` was
      // unreachable from here. Reachable on a SCHEMA-VALID payload:
      // `evppi` is `z.number().optional()` at schemas 0.30.0, so
      // `{factor_id, status: 'resolved'}` with no `evppi` validates on the wire
      // and is dropped here.
      //
      // Deliberately unconditional rather than gated on `resolved.length > 0`:
      // the conservative direction is to withhold the ranking, and an
      // all-below-resolution run that also lost a row genuinely cannot tell us
      // whether the lost row was a resolved one.
      if (!sawFirstResolvedRow) rankOneUnusable = true
      continue
    }

    const factorId = wireRow.factor_id
    const isResolvedRow = wireRow.status === 'resolved'
    const isFirstResolvedRow = isResolvedRow && !sawFirstResolvedRow
    if (isResolvedRow) sawFirstResolvedRow = true

    // A REPEATED `factor_id` is one factor named twice, never two factors.
    // Rendering both would put the same label at two ranks and invent a factor
    // the producer never sent — and it would do so SILENTLY, which is worse
    // than any malformed payload in this family.
    //
    // First occurrence wins, which keeps BOTH invariants: producer order is
    // untouched, and under the producer's descending sort the first occurrence
    // is the higher-EVPPI one, so the surviving row is the one that earns its
    // rank. Dropping the whole ranking to the gate over one repeated id would
    // discard honest data; treating the extra row as a defensive-validation
    // drop is what design §4 already licenses the disclosure note for ("or any
    // row dropped by defensive validation / label resolution").
    //
    // A duplicate can never be the first row, so it cannot mask rank 1.
    if (seenFactorIds.has(factorId)) {
      droppedAnyRow = true
      continue
    }

    // Never render a raw id (id-shaped-label doctrine). An unlabelable row is
    // dropped and disclosed; an unlabelable RANK-1 row collapses the whole
    // view to the gate below.
    const resolution = resolveLabel(factorId)
    if (resolution === null || resolution.label.trim().length === 0) {
      droppedAnyRow = true
      if (isFirstResolvedRow) rankOneUnusable = true
      continue
    }

    seenFactorIds.add(factorId)

    const row: VoiRankingRow = {
      factorId,
      label: resolution.label,
      canFocus: resolution.canFocus,
    }
    if (isResolvedRow) resolved.push(row)
    else belowResolution.push(row)
  }

  // Never rank around a factor we cannot name OR cannot read (design §2, final
  // row, applied to both failure modes).
  if (rankOneUnusable) return null
  // Every row unusable → the gate, never an empty ranking.
  if (resolved.length === 0 && belowResolution.length === 0) return null

  return {
    resolved,
    belowResolution,
    someFactorsUnassessed: droppedAnyRow || hasPartialWarning(inferenceWarnings),
  }
}

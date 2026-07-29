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
   * reader dropped a row (failed validation / unlabelable). One flag because
   * the user-facing consequence is identical — "some factors couldn't be
   * assessed for this ranking" — and the id lists are unavailable anyway
   * (PLoT drops the structured `detail` arrays, design §1b). A lever's
   * intentional omission is NOT a gap and never sets this.
   */
  someFactorsUnassessed: boolean
}

const PARTIAL_WARNING_CODE = 'FACTOR_EVPPI_PARTIAL'

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** True when the producer disclosed a partial per-factor assessment. */
function hasPartialWarning(inferenceWarnings: unknown): boolean {
  if (!Array.isArray(inferenceWarnings)) return false
  return inferenceWarnings.some(
    (w) => isPlainObject(w) && w.code === PARTIAL_WARNING_CODE,
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
  /** True when the FIRST resolved row on the wire could not be shown. */
  let rankOneUnusable = false

  for (const raw of rows) {
    // Defensive validation, fail-safe: drop THAT row, never coerce a value.
    // `evppi` is required to be a finite number here even though the wire
    // schema types it optional — a row whose magnitude is unreadable is a row
    // whose status we decline to trust, and the fail-safe direction is to drop
    // it and disclose rather than to rank it. The value itself goes no further
    // than this check.
    const isRowUsable =
      isPlainObject(raw) &&
      typeof raw.factor_id === 'string' &&
      raw.factor_id.length > 0 &&
      typeof raw.evppi === 'number' &&
      Number.isFinite(raw.evppi) &&
      (raw.status === 'resolved' || raw.status === 'below_resolution')

    if (!isRowUsable) {
      droppedAnyRow = true
      continue
    }

    const factorId = raw.factor_id as string
    const isResolvedRow = raw.status === 'resolved'
    const isFirstResolvedRow = isResolvedRow && !sawFirstResolvedRow
    if (isResolvedRow) sawFirstResolvedRow = true

    // Never render a raw id (id-shaped-label doctrine). An unlabelable row is
    // dropped and disclosed; an unlabelable RANK-1 row collapses the whole
    // view to the gate below.
    const resolution = resolveLabel(factorId)
    if (resolution === null || resolution.label.trim().length === 0) {
      droppedAnyRow = true
      if (isFirstResolvedRow) rankOneUnusable = true
      continue
    }

    const row: VoiRankingRow = {
      factorId,
      label: resolution.label,
      canFocus: resolution.canFocus,
    }
    if (isResolvedRow) resolved.push(row)
    else belowResolution.push(row)
  }

  // Never rank around a factor we cannot name (design §2, final row).
  if (rankOneUnusable) return null
  // Every row unusable → the gate, never an empty ranking.
  if (resolved.length === 0 && belowResolution.length === 0) return null

  return {
    resolved,
    belowResolution,
    someFactorsUnassessed: droppedAnyRow || hasPartialWarning(inferenceWarnings),
  }
}

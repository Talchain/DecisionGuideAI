/**
 * ⭐ THE EVIDENCE ASSESSMENT, READ OFF A LIVE ANALYSIS TURN.
 *
 * ── THE DEFECT THIS CLOSES ────────────────────────────────────────────────
 * The Reasoning tab's evidence check rendered "Evidence not assessed" on every
 * run. The only thing that ever answered it was `runMeta.m1Coaching
 * .evidence_gaps`, and the sole writer of that field is `hydrateAnalysis` — the
 * RESTORE-from-Supabase path. `applyV5State`, which is the live turn path, never
 * wrote it. So on a real journey the question could not be answered at all, and
 * the refusal — correct in itself — had become a constant.
 *
 * CEE now projects a narrow `evidence_assessment` block past the Tier-3
 * transport ban: producer-written labels, the ids that bind them, and the fact
 * that the producer looked. No VOI score, no EVPI, no influence. This reads it.
 *
 * ⛔⛔ FAIL CLOSED, AND THE DIRECTION IS THE WHOLE POINT.
 * The view model renders an empty gap list beside `assessed: true` as a LICENSED
 * ALL-CLEAR — "No evidence gaps flagged". So a list that arrives SHORT is not a
 * smaller truth: past the last gap it becomes a false statement about the user's
 * own evidence, which is strictly worse than the honest refusal it replaces.
 * Every malformed shape therefore returns `null` — make no claim — rather than
 * salvaging the entries it can parse. Salvage is the one behaviour this module
 * may never have.
 *
 * ⚠ CONFIDENCE DOES NOT TRAVEL, AND THAT IS WHY THIS CANNOT SAY "ALL ADDRESSED".
 * `EvidenceGapItem.confidence` is nullable precisely so absence cannot be
 * rendered as a zero, and `everyEvidenceGapAddressed` needs a confidence to
 * return true. A gap read through this path therefore carries `null`, so the
 * strongest verdict it can produce is "Evidence gaps" — never "Evidence
 * covered". That is correct: the producer told us a gap exists, not that anyone
 * has closed it.
 */

/** One gap: the id that binds it to a factor, and the label that names it. */
export interface EvidenceAssessmentGap {
  readonly factorId: string
  readonly factorLabel: string
}

/**
 * `assessed` is the producer stating it LOOKED. It is narrowed to the literal
 * `true` so that a future `assessed: false` — or any other value — reads as
 * silence rather than as a negative assessment, which is a different claim
 * nobody has made.
 */
export interface EvidenceAssessment {
  readonly assessed: true
  readonly gaps: readonly EvidenceAssessmentGap[]
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Read the block from an enrichment dict, or return `null` to make no claim.
 *
 * `null` is returned for: no enrichment, no block, `assessed` not literally
 * true, a non-array `gaps`, and — the load-bearing one — any gap missing either
 * its id or its label. A gap with no id could not be bound to a factor; a gap
 * with no label could not be named to a user. Either way the answer would be
 * incomplete, and an incomplete answer here is the false all-clear.
 */
export function readEvidenceAssessment(enrichment: unknown): EvidenceAssessment | null {
  if (enrichment == null || typeof enrichment !== 'object') return null
  const block = (enrichment as Record<string, unknown>).evidence_assessment
  if (block == null || typeof block !== 'object') return null

  const record = block as Record<string, unknown>
  // Silence is not an assessment: only the literal `true` is the producer
  // saying it looked.
  if (record.assessed !== true) return null

  const raw = record.gaps
  if (!Array.isArray(raw)) return null

  /**
   * ⛔⛔ AN EMPTY LIST IS NOT AN ALL-CLEAR, AND BOTH SEAMS MUST AGREE ON THAT.
   *
   * The view model renders `assessed: true` beside an empty list as a LICENSED
   * ALL-CLEAR ("No evidence gaps flagged"). Upstream, PLoT's `evidence_gaps` is
   * produced by `safeCompute(..., [], ...)`, which yields `[]` on ANY exception,
   * and by a path that yields `[]` when there is nothing assessable — so an
   * empty list cannot be told from a crash.
   *
   * The producer side now declines to emit on an empty list. This declines too,
   * rather than relying on that: one question answered with two defaults at two
   * seams is how this estate ships contradictions (trap 21), and a consumer that
   * would render an all-clear IF one arrived is a defect waiting for a producer
   * change rather than a safe consumer.
   */
  if (raw.length === 0) return null

  const gaps: EvidenceAssessmentGap[] = []
  for (const entry of raw) {
    if (entry == null || typeof entry !== 'object') return null
    const factorId = nonEmptyString((entry as Record<string, unknown>).factor_id)
    const factorLabel = nonEmptyString((entry as Record<string, unknown>).factor_label)
    // One unusable gap voids the whole answer — see the fail-closed note above.
    if (factorId === null || factorLabel === null) return null
    gaps.push({ factorId, factorLabel })
  }
  return { assessed: true, gaps }
}

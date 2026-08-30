/**
 * CEE quality sub-scores — the ONE reader, and the reason it exists.
 *
 * ⚠ THIS REPLACES A HAND-MIRRORED PAIR. `applyDraftResult` and `DraftChat` each
 * carried their own copy of this mapping, and both copies carried the same
 * defect (CLAUDE.md trap 12 — a list a human must remember to sync WILL drift,
 * and the drift always reads as green).
 *
 * ── WHAT THE PRODUCER ACTUALLY SENDS ────────────────────────────────────────
 * Derived at CEE `staging` @ `f18d941b`, not inferred from this repo:
 *
 *   `src/schemas/cee-v3.ts:792-797`   quality: { overall, structure?, coverage?,
 *                                                structural_proxy?, safety? }
 *   `src/cee/quality/index.ts:118-119`
 *       // Renamed from 'causality' — this score measures structural
 *       // completeness, not causal validity. A genuine causality score
 *       // requires scientific definition (see roadmap B5.28b).
 *       const structural_proxy = structure;
 *
 * **THERE IS NO `causality` FIELD.** CEE removed it on purpose, and every
 * shipped starter draft carries `"structural_proxy": 8` in its place
 * (`src/canvas/starters/data/*.draft.json`).
 *
 * ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────
 * Both twins read `causality: raw.causality ?? raw.overall ?? 5`. Since
 * `raw.causality` is undefined on every real payload, the Model card printed
 * **"Causality: 7"** — with a green/amber/red bar — for a dimension the
 * producer refuses to compute, using the OVERALL score's number. A hardcoded
 * fallthrough spoken as a scientific measurement.
 *
 * The same `?? overall` ran on `structure` / `coverage` / `safety`, each of
 * which is `.optional()` in the producer schema. Where one was absent the panel
 * showed four independent-looking assessments derived from one number — and
 * `ModelSnapshot`'s own `!= null` guards, written to handle exactly that, could
 * never fire because ingestion made sure the field was never absent.
 *
 * ── WHY `structural_proxy` IS NOT PROMOTED INTO THE CAUSALITY SLOT ──────────
 * It is not a causality score; it is `structure`, assigned from it on the line
 * above. Showing it under a second label would print one number twice and read
 * as two independent signals — the same false-independence harm one step over.
 * A proven duplicate is not shown. The Causality row instead reports, truthfully,
 * that nothing scored it.
 *
 * ── THE INVARIANT ───────────────────────────────────────────────────────────
 * A dimension is present here ONLY when the producer sent a finite number for
 * it. Absent means absent, all the way to the screen. Nothing is derived from a
 * neighbouring dimension, and nothing falls back to a constant.
 */

/**
 * CEE's per-dimension model-quality scores, 1–10.
 *
 * Every dimension except `overall` is OPTIONAL, because every one of them is
 * optional in the producer's own schema. A consumer must therefore decide what
 * to say when a score is missing — which is the point: the previous shape made
 * "missing" unrepresentable, so no surface could tell the truth about it even
 * if it wanted to.
 */
export interface CeeQualityDimensions {
  /** Overall model quality. The only score CEE always sends. */
  overall: number
  structure?: number
  coverage?: number
  /**
   * ⚠ CEE DOES NOT COMPUTE THIS AND CURRENTLY NEVER WILL — it renamed the field
   * to `structural_proxy` precisely because the number measures structural
   * completeness rather than causal validity. Kept in the shape so it becomes
   * live for free if roadmap B5.28b ever defines a real one.
   *
   * ⚠⚠ WHAT EACH SURFACE DOES WITH THE ABSENCE — STATED PER SURFACE, because an
   * earlier version of this note claimed "rendered as 'Not scored'" over the
   * whole domain and that is true of ONE of the two consumers:
   *
   *   `model-tab/ModelHealthSection.tsx:274,282-288` — the FULL card. Renders a
   *     "Not scored" row and, beneath the sub-scores, the sentence saying why:
   *     Olumi scores completeness, not whether the causal claims are true. This
   *     is the surface that owes the explanation, and it gives it.
   *
   *   `pre-analysis/ModelSnapshot.tsx:245-249` — the COMPACT middot list
   *     ("Quality: 9/10 · Structure 8 · Coverage 10 · Safety 8"). Renders
   *     NOTHING for an absent dimension, and deliberately: that list's own
   *     contract — its per-dimension `!= null` guards, which predate this change
   *     and could never fire while ingestion back-filled every gap — is "the
   *     dimensions that were scored". Causality is not special-cased there; it
   *     takes the same path `structure`/`coverage`/`safety` take when CEE omits
   *     them.
   *
   * That omission is not the NO-HIDING ruling's "quietly dropping a dimension".
   * What left that list is a FABRICATION — `overall`'s number under a fourth
   * label — and the fact it concealed is stated in full one surface over. But
   * the distinction is only honest if it is written down, so: the compact list
   * carries the scores, the Model card carries the caveat. If that ever stops
   * being true — if the card's explanatory line is removed, or the snapshot
   * becomes the only quality surface a user sees — then the snapshot owes the
   * caveat and this note is the record of why.
   */
  causality?: number
  safety?: number
}

/** A finite number, or `undefined`. Never a substitute drawn from elsewhere. */
function score(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Read CEE's `quality` block.
 *
 * Returns `null` when the producer sent no usable overall score — the same
 * condition both twins already gated on (`typeof raw.overall === 'number'`), so
 * this is not a new refusal.
 */
export function readCeeQualityDimensions(rawQuality: unknown): CeeQualityDimensions | null {
  if (rawQuality == null || typeof rawQuality !== 'object') return null
  const raw = rawQuality as Record<string, unknown>

  const overall = score(raw.overall)
  if (overall === undefined) return null

  return {
    overall,
    ...(score(raw.structure) !== undefined ? { structure: score(raw.structure) } : {}),
    ...(score(raw.coverage) !== undefined ? { coverage: score(raw.coverage) } : {}),
    ...(score(raw.causality) !== undefined ? { causality: score(raw.causality) } : {}),
    ...(score(raw.safety) !== undefined ? { safety: score(raw.safety) } : {}),
  }
}

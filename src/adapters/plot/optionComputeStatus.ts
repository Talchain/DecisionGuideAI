/**
 * optionComputeStatus — the producer's PER-OPTION computation classification,
 * narrowed once at the wire→internal boundary and carried verbatim from there.
 *
 * ## The defect this closes
 *
 * ISL classifies every option's computation and PLoT forwards that
 * classification per option. Both UI mappers rebuilt the per-option object
 * KEY BY KEY, so a field neither of them named could not survive the rebuild
 * even though it arrived intact on the wire — the identical mechanism the
 * `percentiles_source` note in `mapV5AnalysisToReport.ts` records, one field
 * along. The surface then re-derived a worse classification of its own, and a
 * degraded option rendered as a measured `0%` beside a genuine measured zero
 * rendered as `"<0.01%"`.
 *
 * ## PRODUCER SEMANTICS — derived at the producer's bytes, not from what the
 * enum members sound like
 *
 * ISL `src/models/response_v2.py:405` (`OptionResultV2`) declares
 * `status: Literal["computed", "partial", "failed"]` as a REQUIRED field, and
 * `src/utils/response_builder.py:92-110` (`determine_option_status(n_valid,
 * n_total)`) is the only producer of it:
 *
 *   - `'failed'`   ⇔ `n_valid === 0`. ZERO finite Monte Carlo samples. There is
 *                    no distribution, so there is no share, no rank and no
 *                    percentile — nothing downstream of it is a measurement.
 *   - `'partial'`  ⇔ `0 < n_valid / n_total < 0.8`. Samples EXIST; ISL emits a
 *                    full `outcome` block and raises a LOW_EFFECTIVE_SAMPLES
 *                    critique. It is a DISCLOSURE, not a failure, and treating
 *                    it as one would discard results ISL honestly computed.
 *   - `'computed'` ⇔ ratio >= 0.8.
 *
 * PLoT states the same three-way reading twice, in `src/routes/v2/run.ts`
 * (`isCrownableCandidate` :1976 and `isFailedIslOption` :2008 at staging
 * `d37c8cfd`), and treats an ABSENT status as the legacy V1 shape — ISL's V1
 * `OptionResult` has no `status` field at all — i.e. as computed. This module
 * matches that reading exactly, because a UI that classified the same option
 * differently from the service that crowned it would be a second authority on
 * one question (CLAUDE.md trap 21).
 *
 * ## WHY THE NARROWING IS LOAD-BEARING AND NOT DEFENSIVE DECORATION
 *
 * The shared contract does NOT close this vocabulary. `@talchain/schemas`
 * 0.48.0 declares `EnrichmentOptionComparisonEntrySchema.status` as
 * `z.ZodOptional<z.ZodString>` — a BARE STRING, not an enum (contrast its
 * sibling `outcome.percentiles_source`, which IS `z.ZodEnum(["samples",
 * "unavailable"])`). So the contract admits any string at all, and a corpus
 * drawn only from what the producer emits today cannot certify this code over
 * the class the contract permits (CLAUDE.md trap 13d). Narrowing here means an
 * unrecognised token can never reach a predicate that would then have to guess
 * what it meant.
 *
 * ## ABSENT MEANS ABSENT — the direction of the failure is chosen, not incidental
 *
 * An unrecognised or missing status narrows to `undefined`, and `undefined`
 * keeps an option on the ORDINARY path. It does not silently become `'failed'`.
 * That is the same fail-toward-saying-less direction `narrowPercentilesSource`,
 * `robustnessVerdict` and `runAnalysedAnyOption` already take, and it is the
 * safe one HERE too: reading silence as failure would suppress a real result
 * and tell the user their option could not be computed when it was.
 *
 * ⚠ The residual, stated rather than hidden: if PLoT/ISL ever add a FOURTH
 * failure token, this module maps it to `undefined` and the option renders on
 * the ordinary path — the pre-existing behaviour, not a new falsehood, but not
 * the honest one either. The guard against that is
 * `optionComputeStatus.spec.ts`'s producer-vocabulary test, which pins THIS
 * list against the producer's `Literal` and REDs if the two stop matching.
 */

/**
 * The producer's closed per-option vocabulary.
 *
 * ⚠ NOT the same question as `DecisionResultData.analysisStatus`, which shares
 * three of these spellings and answers about the WHOLE RUN. See
 * {@link OPTION_COMPUTE_STATUSES} for why they are named apart rather than
 * reconciled.
 */
export type OptionComputeStatus = 'computed' | 'partial' | 'failed'

/**
 * The vocabulary as data, so the narrowing and the tests read from ONE list
 * rather than two hand-kept copies of it (CLAUDE.md trap 12).
 *
 * ⚠ TWO STATUSES, ONE SPELLING, DIFFERENT LEVELS — AND THEY ARE NAMED APART ON
 * PURPOSE (CLAUDE.md trap 21). `EnrichmentAnalysisStatus` (`["computed",
 * "partial", "failed", "blocked"]`) is the RUN's status and reaches the UI as
 * `DecisionResultData.analysisStatus` / `.statusReason`. THIS type is ONE
 * OPTION's. They overlap in three of four spellings and answer different
 * questions — "did the analysis complete?" versus "did the computation produce
 * a usable result for THIS option?" — so a run can be `'computed'` while one of
 * its options is `'failed'`, and that combination is not an inconsistency to
 * reconcile. It is why the display-side field is called `computeStatus` and not
 * `status`: a second bare `statusReason` one level down, carrying the same
 * three tokens, is how two authorities come to look like one.
 */
export const OPTION_COMPUTE_STATUSES = ['computed', 'partial', 'failed'] as const

/**
 * Narrow an untrusted wire value to the producer's vocabulary, or `undefined`.
 *
 * Absent in ⇒ absent out. No coercion, no default, no `?? 'computed'` — a
 * default here would manufacture a classification claim out of silence, which
 * is the fabrication the whole module exists to refuse.
 */
export function narrowOptionComputeStatus(raw: unknown): OptionComputeStatus | undefined {
  return (OPTION_COMPUTE_STATUSES as readonly string[]).includes(raw as string)
    ? (raw as OptionComputeStatus)
    : undefined
}

/**
 * The producer's own sentence about a non-computed option, or `undefined`.
 *
 * ⚠ NEVER AUTHORED HERE AND NEVER DEFAULTED. ISL declares it
 * `Optional[str] = "Reason for non-computed status"`, and it is ABSENT from
 * every one of the 12 live captures in `src/v5/__tests__/fixtures/` — so a
 * render site must be correct with no reason at all, and must not treat the
 * presence of this string as the thing that licenses the disclosure. The STATUS
 * licenses the disclosure; this only enriches it.
 *
 * An empty or whitespace-only string is absence wearing a present field's
 * clothes and narrows to `undefined`, the same rule `buildOptionsComparison`
 * already applies to `storyHeadlines`.
 */
export function narrowOptionComputeStatusReason(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

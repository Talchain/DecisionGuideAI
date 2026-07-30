/**
 * ISL `inference_warnings[]`, from BOTH slots a mapper may use — ROOT first,
 * then the legacy `robustness` nesting.
 *
 * ONE reader because `useResultsSectionData.ts` needed the identical dual read
 * twice (the VOI ranking's PARTIAL disclosure and the Analysis-tab warning strip)
 * and had it in two DIVERGENT cast styles. Two copies of a two-slot fallback is
 * two chances for the next copy to read only one slot and render permanently
 * empty with nothing red — which is exactly what the design doc's §2 mapping
 * table would have caused had it been implemented verbatim (measured over all 773
 * live non-noop `run_analysis` facts on staging, 2026-07-29: root 773/773,
 * robustness 0/773 — see `canvas/stores/persistedRunSnapshotFactory.ts`).
 *
 * ⚠ R-6 — WHY THIS IS A LEAF MODULE RATHER THAN AN EXPORT FROM THE HOOK. It was
 * file-private in `useResultsSectionData.ts`, which meant the three remaining
 * copies in `src/canvas` could not adopt it even though the reason it exists is
 * the hazard those copies embody. Exporting it FROM the hook would have made
 * every adopter — including `GoalNode`, which renders once per canvas node —
 * import a 3,000-line results hook, so it lives here instead, beside
 * `humaniseInferenceWarning` and the other leaves `GoalNode` already imports
 * from. Hook and canvas both import it; there is one definition.
 *
 * ⚠ TWO COPIES DELIBERATELY NOT MIGRATED, because doing so is a BEHAVIOUR CHANGE
 * and not a refactor. Both read the `robustness` slot ONLY, so on live data
 * (0/773) they are permanently blank; giving them this dual read makes them start
 * populating:
 *   · `canvas/components/ModelTabBody.tsx` — the Model card's audit-trail
 *     `inferenceWarnings` row. Reads `results.report.robustness.inference_warnings`
 *     off the SAME `ResultsReport` this function takes, so adoption is a one-line
 *     swap — and would surface an audit row that is empty today.
 *   · `canvas/stores/analysisSnapshotFactory.ts` `extractInferenceWarnings` —
 *     takes only `V2RunResponse['robustness']` as its parameter (it has no root
 *     object in scope) and normalises members to `string[]`, so adoption needs a
 *     call-site change as well.
 * Both are real findings and neither is a drive-by: what appears in an audit row
 * is a product judgement and wants its own RED-first pin. Recorded, not silently
 * left behind.
 *
 * Returns `unknown`: payload redaction may deliver a `{__truncated, items}`
 * wrapper rather than a bare array, so callers unwrap with `safeArray` or
 * validate for themselves. Never throws, never defaults to `[]` — an absent key
 * must stay distinguishable from an empty one.
 *
 * ⚠ THE NARROW CAST ON THE LEGACY SLOT IS LOAD-BEARING AND MUST NOT BE "TIDIED"
 * INTO A TYPE DECLARATION. The top-level read is plain (the key is declared on
 * `ResultsReport`). Declaring a member on `ResultsReport['robustness']` — an
 * inline object type — changes the elided-member counter tsc prints inside four
 * unrelated baselined diagnostics in `useResultsSectionData.ts`, which trips
 * `typecheck:selftest`'s clean-tree control. See the note at that slot in
 * `../types.ts`.
 */
import type { ResultsReport } from '../types'

export function readInferenceWarnings(
  report: ResultsReport | null | undefined,
): unknown {
  return (
    report?.inference_warnings ??
    (report?.robustness as { inference_warnings?: unknown } | undefined)?.inference_warnings
  )
}

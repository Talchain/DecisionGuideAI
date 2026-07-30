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
 * HISTORY — TWO COPIES WERE DELIBERATELY NOT MIGRATED, THEN ADOPTED. When this
 * module was extracted (R-6), two `robustness`-slot-only readers were left in
 * place and recorded here rather than silently migrated, because populating a
 * previously-blank surface is a BEHAVIOUR CHANGE and a product judgement, not a
 * refactor:
 *   · `canvas/components/ModelTabBody.tsx` — the Model card's audit-trail
 *     `inferenceWarnings` (ModelHealthSection banner + codes-only audit row);
 *   · `canvas/stores/analysisSnapshotFactory.ts` `extractInferenceWarnings` —
 *     the Compare-tab snapshot (its persisted-rebuild caller compensated via
 *     `composeRobustness`'s root-wins fold; the live-capture caller did not, so
 *     the same Compare surface was blank or populated by capture path).
 * That judgement was settled: BOTH SITES ADOPTED 2026-07-30, Paul-ratified
 * (ROADMAP 2.173, decision 2), each behind its own RED-first pin. Evidence:
 * `PHASE0-EVIDENCE-2026-07-28/inference-warnings-derivation.md` — root slot
 * 419/827 live facts non-empty, robustness slot 0/827, and the identical items
 * already displayed on the Analysis tab via this reader. ModelTabBody imports
 * this function; the snapshot factory mirrors the root-wins precedence inline
 * (its input is a `V2RunResponse`, not a `ResultsReport`).
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

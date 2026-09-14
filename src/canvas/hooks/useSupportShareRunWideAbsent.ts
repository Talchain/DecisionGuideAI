/**
 * `useSupportShareRunWideAbsent` — is a missing support percentage a fact about
 * ONE OPTION, or about THE RUN?
 *
 * ⚠ WHY THIS IS ITS OWN MODULE AND NOT ANOTHER EXPORT ON
 * `useNodeDisplayMetadata`. 57 spec files mock that module with a hand-listed
 * `vi.mock` factory, and a factory REPLACES the module — so every new export
 * added there is silently absent in all 57 and they fail at render with
 * "No export is defined on the mock". That is CLAUDE.md trap 12 (the
 * hand-maintained mirror) with 57 copies, and it was measured here: adding the
 * export to that file turned 289 tests red across the canvas suites. Splitting
 * the module is the fix that does not require 57 files to be kept in sync.
 */
import { useCanvasStore } from '../store'
import type { ResultsReport } from '../../components/results/types'
import { optionComputationProducedResult } from '../../components/results/utils/notAnalysedOptions'
import type { OptionComputeStatus } from '../../adapters/plot/optionComputeStatus'

/**
 * ⭐ IS THE MISSING SUPPORT PERCENTAGE A FACT ABOUT *THIS OPTION*, OR ABOUT
 * *THE RUN*? The option card cannot tell from its own data, and until this
 * predicate existed it did not ask: every option whose share failed to resolve
 * rendered the same notice, so a three-option model rendered it three times.
 *
 * The two cases are genuinely different and want different treatment:
 *
 *   - PARTIAL — some options resolved a share and this one did not. The notice
 *     is INFORMATIVE: it tells the reader why this card carries no figure while
 *     its siblings do. PLoT's `IDENTICAL_OPTIONS_DEDUPED` produces exactly this
 *     shape (`plot/src/validation/preflight-v2.ts`), dropping a duplicate
 *     option from the analysed set while the rest compute normally.
 *
 *   - RUN-WIDE — NO option resolved a share. Then it is not a fact about any
 *     option at all, and repeating it on every card states one fact N times in
 *     the position where the comparison belongs. The cards yield that position;
 *     the Question node states it ONCE (`DecisionNode`).
 *
 * ⚠ WHY THIS CANNOT BE `Object.values(option_probabilities).some(...)`. The V5
 * mapper has two keying paths (`mapV5AnalysisToReport.ts`): path A keys by
 * canonical `option_id` when `enrichment.option_comparison` is present, path B
 * keys by `block.win_probabilities` keys VERBATIM when it is absent — and those
 * are human LABELS on real staging payloads. Under path B the map is FULL of
 * finite numbers while EVERY canvas lookup misses, so a predicate over the
 * map's values would read "shares present" on precisely the payload that
 * renders the notice on every card. The question is not whether the report
 * holds numbers; it is whether an OPTION NODE resolves one, so this resolves
 * through the node ids exactly as the card does.
 *
 * Returns a primitive, so the zustand selector is reference-stable and this
 * adds no re-render beyond an actual change of the answer.
 */
export function useSupportShareRunWideAbsent(): boolean {
  return useCanvasStore((state) => {
    if (state.results.status !== 'complete') return false
    const report = state.results.report
    if (!report) return false
    const optionProbabilities =
      (report as unknown as ResultsReport).option_probabilities ?? {}

    let optionNodes = 0
    let resolvedShares = 0
    for (const node of state.nodes) {
      if (node.type !== 'option') continue
      optionNodes += 1
      const entry = optionProbabilities[node.id]
      if (!entry) continue
      // Same gate, same order as the per-node read above: the producer's
      // status is consulted BEFORE the share, never re-derived from it. A
      // `failed` option carries its own distinct notice and must not count as
      // a resolved share here.
      if (!optionComputationProducedResult(entry.status as OptionComputeStatus | undefined)) continue
      if (typeof entry.win_probability === 'number' && Number.isFinite(entry.win_probability)) {
        resolvedShares += 1
      }
    }

    // No option nodes at all is not a run-wide absence, it is an empty model.
    return optionNodes > 0 && resolvedShares === 0
  })
}

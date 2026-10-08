/**
 * The first pair after the user sizes their links (DL 58e392 ruling 2, 8 Oct): the earlier Run withheld its shares, so
 * CEE sends `win_probabilities: []` with `win_probabilities_unavailable: 'prior_withheld'` and Compare had no figure at
 * all until a second sized Run. This reads the LATEST side only, from the latest Run's own licensed shares.
 *
 * ⛔ THE LATEST RUN'S OWN FIGURES, AS THE CANVAS OPTION CARD READS THEM. `option_probabilities[id].win_probability`,
 *   skipping an option the producer says failed (`optionComputationProducedResult`, the card's and the panel's one
 *   predicate). Only on the producer's typed `prior_withheld` (which CEE emits only when the latest Run may show its
 *   shares), only on a re-run pair, and only while the caller's own licence (`resultsAllowed`) holds.
 * ⛔ BOUND TO THE ANALYSIS ON SCREEN. The caller passes the report only when the stored delta describes it
 *   (`runDeltaDescribesDisplayedAnalysis`: same `response_hash`, same scenario), so these are the delta's latest Run.
 *   No new run identity is minted (CLAUDE.md trap 21).
 */
import { optionComputationProducedResult, type OptionComputeStatus } from '../../components/results/utils/notAnalysedOptions'
import type { RunDeltaView } from '../../components/results/analysisNew/runDeltaView'

export type LatestShare = { readonly optionId: string; readonly label: string | null; readonly current: number }

export function latestOnlyShares(
  view: Pick<RunDeltaView, 'winProbabilitiesUnavailable' | 'frame'>,
  report: unknown,
  label: (id: string) => string | null,
): LatestShare[] | null {
  if (view.winProbabilitiesUnavailable !== 'prior_withheld' || view.frame === 'versions') return null
  const probs = (report as { option_probabilities?: unknown } | null | undefined)?.option_probabilities
  if (typeof probs !== 'object' || probs === null || Array.isArray(probs)) return null
  const shares = Object.entries(probs as Record<string, { win_probability?: unknown; status?: OptionComputeStatus }>)
    .flatMap(([optionId, p]) => {
      const current = p?.win_probability
      if (!optionComputationProducedResult(p?.status)) return []
      if (typeof current !== 'number' || !Number.isFinite(current)) return []
      return [{ optionId, label: label(optionId), current }]
    })
  return shares.length > 0 ? shares : null
}

/**
 * ⭐ PJ-B3 — THE RUN RANKED THIS FACTOR, AND THE RUN HAD NO VALUE FOR IT.
 *
 * WHY (R&C #72 5866297058, DL run `pj-20260928T075802Z/C01`). PLoT ranks
 * `factor_sensitivity` from the graph's structure; it never asks whether a
 * factor has a value. On C01 it ranked "Monthly churn" #2 with no
 * `value_source` and no `observed_state` value. The coaching card said so
 * ("has no value yet … that ranking comes from how the model is built, not
 * from your figures"), while this card printed a bare "Driver 2 of M". The
 * owner's ruling (Canvas, 28 Sep 2026): the rank STAYS — a factor with no value
 * can be a real structural driver — and the card adds "no value yet".
 *
 * THE TYPED FACT, AND ONLY IT: the run's `factor_sensitivity` row for this
 * factor carries no `value_source`, while another row in the SAME run carries
 * one. That is CEE #2154's row rule (`coaching/unvalued-driver-card.ts`: "The
 * mark is read only where the producer attests `value_source` at all"), read
 * off the run's own rows:
 *
 *   CEE wire `enrichment.factor_sensitivity[].value_source`
 *     → `mapV5AnalysisToReport` (kept verbatim onto `report.factor_sensitivity`)
 *     → `selectDriverPolicyFeed(report).rawFactors[i].value_source`
 *       (`RawFactorSensitivity.value_source`), index-aligned with
 *       `policyRows[i].key` — the SAME feed and key the rank is taken from.
 *
 * ⛔ WHAT IT DOES NOT READ. No prose, no label, no readiness or needs-input
 * rule, no live node value: it states what the RUN held, beside the rank that
 * run produced. A run where NO row carries `value_source` (older producers,
 * saved reports) attests nothing, so nothing is said — silence there is the
 * honest reading, never "no value yet" on every card.
 */
import type { DriverPolicyFeed } from '../../../components/results/useResultsSectionData'

/** The row names who put its value there — a non-blank `value_source`. */
function rowCarriesValueSource(row: { value_source?: unknown } | undefined): boolean {
  const source = row?.value_source
  return typeof source === 'string' && source.trim() !== ''
}

/**
 * True when the run analysed `nodeId` with NO `value_source` on its row while
 * another row of the same run carries one. False when the factor is
 * not in the run, when any of its rows carries one, or when no row does.
 */
export function runHoldsNoValueFor(
  feed: Pick<DriverPolicyFeed, 'rawFactors' | 'policyRows'>,
  nodeId: string,
): boolean {
  let attested = false
  let inRun = false
  let valued = false
  feed.policyRows.forEach((row, index) => {
    const carries = rowCarriesValueSource(feed.rawFactors[index])
    if (carries) attested = true
    if (row.key === nodeId) {
      inRun = true
      if (carries) valued = true
    }
  })
  return attested && inRun && !valued
}

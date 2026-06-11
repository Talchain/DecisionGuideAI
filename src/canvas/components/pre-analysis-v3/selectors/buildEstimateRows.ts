/**
 * buildEstimateRows — the influence-ranked estimates list ("What this
 * depends on"), with the value-scale guard applied per row.
 *
 * Display values come from the canonical factorDisplayText chain (the same
 * resolver the inspector and graph use): raw_value + meaningful unit >
 * CEE display_value > unitless raw > binary heuristic. The normalised
 * model-scale `value` is never displayed. When only a model-scale value
 * exists with no display-scale anchor, the row degrades to confirm-only
 * (approved correction; occurrences listed in the build report).
 */

import type { Node } from '@xyflow/react'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import { unwrapInterventionValue } from '../../../utils/labelUtils'
import { getObservedState } from '../../../utils/observedStateHelpers'
import { isAiSource } from '../../pre-analysis/utils/isAiSource'
import { isReviewedByUser } from '../../pre-analysis/utils/isReviewedByUser'
import type { Attribution, EstimateRowModel, RankingResult, RankLabel } from '../types'

function rankLabelFor(position: number): RankLabel {
  if (position === 0) return 'top'
  if (position === 1) return 'next'
  return 'lower'
}

export function buildEstimateRows(
  factorNodes: ReadonlyArray<Node>,
  ranking: RankingResult,
  currentUser: Attribution | null,
): EstimateRowModel[] {
  const byId = new Map(factorNodes.map(n => [n.id, n]))

  // Priority labels sequence over rows still to check: a reviewed row never
  // reads "check first", and the top unreviewed row always does — matching
  // the ladder and the estimates signal.
  let uncheckedPosition = 0

  return ranking.ordered
    .map((id): EstimateRowModel | null => {
      const node = byId.get(id)
      if (!node) return null
      const data = node.data as Record<string, unknown>
      const observed = getObservedState(data)

      const displayText = factorDisplayText(data)
      const rawUnwrapped = unwrapInterventionValue(observed.raw_value).value
      const valueUnwrapped = unwrapInterventionValue(observed.value).value
      const cap = unwrapInterventionValue(observed.cap).value ?? null
      const reviewed = isReviewedByUser(node)
      const aiSourced = isAiSource(typeof observed.source === 'string' ? observed.source : null)

      const needsValue =
        displayText == null && rawUnwrapped == null && valueUnwrapped == null

      // Value-scale guard: a model-scale value with no display-scale anchor
      // (no raw_value, no display text) cannot be shown or edited honestly.
      const scaleAmbiguous =
        valueUnwrapped != null && rawUnwrapped == null && displayText == null

      const rankLabel = reviewed ? 'lower' : rankLabelFor(uncheckedPosition)
      if (!reviewed) uncheckedPosition++

      return {
        nodeId: node.id,
        label: typeof data.label === 'string' ? data.label : node.id,
        rankLabel,
        weight: ranking.weights[id] ?? 0,
        reviewed,
        aiSourced,
        attribution: reviewed
          ? currentUser ?? { kind: 'person', displayName: 'You' }
          : { kind: 'olumi' },
        displayText,
        rawPrefill: rawUnwrapped ?? null,
        cap,
        canEditValue: !scaleAmbiguous,
        needsValue,
      }
    })
    .filter((row): row is EstimateRowModel => row !== null)
}

/** First AI-estimated, not-yet-reviewed row in ranking order (ladder rung 3). */
export function topUncalibrated(
  rows: ReadonlyArray<EstimateRowModel>,
): { id: string; label: string } | null {
  for (const row of rows) {
    if (!row.reviewed && !row.needsValue) {
      return { id: row.nodeId, label: row.label }
    }
  }
  return null
}

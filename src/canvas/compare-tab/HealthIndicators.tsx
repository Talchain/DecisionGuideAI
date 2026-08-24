import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { AnalysisSnapshot } from './types'

interface HealthIndicatorsProps {
  first: AnalysisSnapshot
  latest: AnalysisSnapshot
}

/**
 * T2b: an unknown stability cannot be "improving". When either end of the
 * comparison was never assessed there is no trend to claim, so this reports
 * false rather than letting `indexOf(null)` (-1) manufacture a rise out of
 * missing data.
 *
 * ⚠ D7 — T2b CLOSED ONE DIRECTION AND LEFT THE OTHER OPEN. `false` is not
 * "no claim"; at the call site it selects `ArrowDown`. So the guard written to
 * stop an absence manufacturing a RISE manufactured a FALL instead, and the row
 * read "Result stability: Not assessed → Not assessed" with a DOWN arrow beside
 * it. The return type is now three-valued: `null` means NO DIRECTION IS
 * CLAIMED, which is the state the data is actually in.
 */
function stabilityImproving(from: string | null, to: string | null): boolean | null {
  if (from == null || to == null) return null
  const order = ['fragile', 'mostly stable', 'stable']
  return order.indexOf(to) > order.indexOf(from)
}

/**
 * T2b, same rule as `stabilityImproving` above: coverage that was never
 * measured at one end cannot be "improving". A run rebuilt from a persisted
 * `run_analysis` fact has no graph, so it has no coverage — and `parseInt`
 * over a null (or the "0/0" a fabricating factory would have produced) would
 * manufacture a rise out of that absence.
 */
function coverageImproving(from: string | null, to: string | null): boolean | null {
  // D7: `null`, not `false` — see `stabilityImproving` above for why the
  // two-valued version fabricated a downward trend.
  if (from == null || to == null) return null
  // "3/5" format — compare numerators
  const fromNum = parseInt(from.split('/')[0], 10) || 0
  const toNum = parseInt(to.split('/')[0], 10) || 0
  return toNum > fromNum
}

export function HealthIndicators({ first, latest }: HealthIndicatorsProps) {
  const indicators = [
    {
      label: 'Result stability',
      // T2b: a null label means the producer sent no robustness data. Say so,
      // rather than rendering an empty gap that reads as a missing UI.
      from: first.stabilityLabel ?? 'Not assessed',
      to: latest.stabilityLabel ?? 'Not assessed',
      up: stabilityImproving(first.stabilityLabel, latest.stabilityLabel),
    },
    {
      label: 'Evidence coverage',
      // T2b: null means the run carries no graph to count factor evidence
      // over (a run rebuilt from a persisted analysis fact). Say so, exactly
      // as the stability row above does.
      from: first.evidenceCoverage ?? 'Not assessed',
      to: latest.evidenceCoverage ?? 'Not assessed',
      up: coverageImproving(first.evidenceCoverage, latest.evidenceCoverage),
    },
    {
      label: 'Influence concentration',
      // D7: the same "Not assessed" treatment the two rows above already have.
      // This row rendered `${null}%` as the literal "null%", and — worse — the
      // arrow below compared two values that may never have been measured.
      from: first.influenceConcentration != null ? `${first.influenceConcentration}%` : 'Not assessed',
      to: latest.influenceConcentration != null ? `${latest.influenceConcentration}%` : 'Not assessed',
      // Lower concentration is better (less dominated by single factor).
      // D7: a DIRECTION is a second-order claim and needs BOTH ends measured.
      // `0 < 0` is false, so an unmeasured pair silently rendered a DOWN arrow —
      // a stated trend between two numbers that do not exist. `null` means "no
      // direction claimed"; the arrow is suppressed rather than guessed.
      up: first.influenceConcentration != null && latest.influenceConcentration != null
        ? latest.influenceConcentration < first.influenceConcentration
        : null,
    },
  ]

  return (
    <div className="mt-2 flex flex-col gap-0.5">
      {indicators.map(h => {
        // D7: `up === null` means no direction was claimed. Rendering either
        // arrow would assert a trend; `Minus` asserts none.
        const Arrow = h.up === null ? Minus : h.up ? ArrowUp : ArrowDown
        return (
          <div key={h.label} className="flex items-center gap-1.5">
            <Arrow size={10} className="text-text-light" />
            <span className={typography.panelBody}>
              {h.label}: {h.from} → {h.to}
            </span>
          </div>
        )
      })}
    </div>
  )
}

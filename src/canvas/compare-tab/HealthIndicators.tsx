import { ArrowUp, ArrowDown } from 'lucide-react'
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
 */
function stabilityImproving(from: string | null, to: string | null): boolean {
  if (from == null || to == null) return false
  const order = ['fragile', 'mostly stable', 'stable']
  return order.indexOf(to) > order.indexOf(from)
}

function coverageImproving(from: string, to: string): boolean {
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
      from: first.evidenceCoverage,
      to: latest.evidenceCoverage,
      up: coverageImproving(first.evidenceCoverage, latest.evidenceCoverage),
    },
    {
      label: 'Influence concentration',
      from: `${first.influenceConcentration}%`,
      to: `${latest.influenceConcentration}%`,
      // Lower concentration is better (less dominated by single factor)
      up: latest.influenceConcentration < first.influenceConcentration,
    },
  ]

  return (
    <div className="mt-2 flex flex-col gap-0.5">
      {indicators.map(h => {
        const Arrow = h.up ? ArrowUp : ArrowDown
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

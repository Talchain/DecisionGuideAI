import { ArrowUp, ArrowDown } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { AnalysisSnapshot } from './types'

interface HealthIndicatorsProps {
  first: AnalysisSnapshot
  latest: AnalysisSnapshot
}

function stabilityImproving(from: string, to: string): boolean {
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
      label: 'Recommendation stability',
      from: first.stabilityLabel,
      to: latest.stabilityLabel,
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

/**
 * TradeoffsSection - What you're trading off
 *
 * Displays the tradeoffs of choosing the recommended option.
 * Helps users understand what they're giving up.
 */

import { Scale, AlertTriangle, Info } from 'lucide-react'
import { typography } from '../../../styles/typography'
import type { Tradeoff } from './types'

interface TradeoffsSectionProps {
  tradeoffs: Tradeoff[]
  onTradeoffClick?: (edgeId: string) => void
}

const severityConfig = {
  high: {
    icon: AlertTriangle,
    iconColor: 'text-carrot-600',
    bgColor: 'bg-carrot-50',
    borderColor: 'border-carrot-200',
    label: 'Significant',
  },
  medium: {
    icon: Scale,
    iconColor: 'text-banana-600',
    bgColor: 'bg-banana-50',
    borderColor: 'border-banana-200',
    label: 'Moderate',
  },
  low: {
    icon: Info,
    iconColor: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    label: 'Minor',
  },
}

export function TradeoffsSection({ tradeoffs, onTradeoffClick }: TradeoffsSectionProps) {
  if (!tradeoffs || tradeoffs.length === 0) {
    return (
      <div className="p-3 bg-mint-50 border border-mint-200 rounded-lg">
        <p className={`${typography.caption} text-mint-700`}>
          No significant tradeoffs identified. This option appears well-balanced.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tradeoffs.map((tradeoff, index) => {
        const config = severityConfig[tradeoff.severity]
        const Icon = config.icon
        const isClickable = !!tradeoff.edge_id

        return (
          <button
            key={tradeoff.edge_id || index}
            type="button"
            onClick={() => isClickable && onTradeoffClick?.(tradeoff.edge_id!)}
            disabled={!isClickable}
            className={`w-full text-left p-3 rounded-lg border ${config.borderColor} ${config.bgColor} transition-colors ${
              isClickable ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'
            }`}
          >
            <div className="flex items-start gap-3">
              <Icon
                className={`h-4 w-4 ${config.iconColor} flex-shrink-0 mt-0.5`}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`${typography.caption} font-medium ${config.iconColor}`}>
                    {config.label} tradeoff
                  </span>
                </div>
                <p className={`${typography.bodySmall} text-ink-800`}>
                  {tradeoff.description}
                </p>
                {tradeoff.alternative_benefits && (
                  <p className={`${typography.caption} text-ink-500 mt-1`}>
                    Alternative benefit: {tradeoff.alternative_benefits}
                  </p>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

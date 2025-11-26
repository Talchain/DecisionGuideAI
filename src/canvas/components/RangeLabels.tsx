/**
 * RangeLabels Component
 *
 * Provides user-friendly labels for outcome ranges.
 * Uses standardized Downside/Expected/Upside terminology.
 */

import { typography } from '../../styles/typography'
import { RANGE_TERMINOLOGY } from '../../config/terminology'
import { Info } from 'lucide-react'
import { useState } from 'react'

interface RangeLabelsProps {
  conservative: string
  likely: string
  optimistic: string
  showTooltips?: boolean
}

export function RangeLabels({
  conservative,
  likely,
  optimistic,
  showTooltips = true,
}: RangeLabelsProps) {
  const [hoveredRange, setHoveredRange] = useState<string | null>(null)

  const RangeItem = ({
    rangeKey,
    value,
  }: {
    rangeKey: 'conservative' | 'likely' | 'optimistic'
    value: string
  }) => {
    const config = RANGE_TERMINOLOGY[rangeKey]
    const isHovered = hoveredRange === rangeKey

    return (
      <div className="flex flex-col items-center gap-1 relative">
        <div className="flex items-center gap-1">
          <span className={`${typography.code} font-medium uppercase text-ink-900/70 tracking-wide`}>
            {config.userLabel}
          </span>
          {showTooltips && (
            <button
              type="button"
              onMouseEnter={() => setHoveredRange(rangeKey)}
              onMouseLeave={() => setHoveredRange(null)}
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-ink-900/50 hover:text-ink-900/80 hover:bg-sand-100"
              aria-label={`Show details for ${config.userLabel}`}
            >
              <Info className="w-2.5 h-2.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <span className={`${typography.code} font-semibold text-ink-900 tabular-nums`}>
          {value}
        </span>

        {/* Tooltip */}
        {isHovered && showTooltips && (
          <div
            className="absolute top-full mt-1 z-50 w-48 px-3 py-2 bg-ink-900 text-paper-50 rounded shadow-lg"
            role="tooltip"
          >
            <div className={`${typography.caption} font-medium mb-1`}>
              {config.technicalTerm}
            </div>
            <div className={`${typography.caption} text-paper-50/90`}>
              {config.description}
            </div>
            {/* Arrow */}
            <div
              className="absolute bottom-full left-1/2 transform -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderBottom: '6px solid rgb(var(--ink-900))',
              }}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-2 text-center" data-testid="range-labels">
      <RangeItem rangeKey="conservative" value={conservative} />
      <RangeItem rangeKey="likely" value={likely} />
      <RangeItem rangeKey="optimistic" value={optimistic} />
    </div>
  )
}

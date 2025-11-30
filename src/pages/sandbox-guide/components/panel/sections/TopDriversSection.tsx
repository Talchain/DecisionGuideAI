/**
 * TopDriversSection - Shows the top drivers from PLoT analysis
 *
 * Critical component that displays what matters most in the decision
 */

import type { ReportV1 } from '@/adapters/plot/types'
import { ExpandableSection } from '../../shared/ExpandableSection'

export interface TopDriversSectionProps {
  drivers: ReportV1['drivers']
  limit?: number
}

export function TopDriversSection({ drivers, limit = 3 }: TopDriversSectionProps): JSX.Element {
  if (!drivers || drivers.length === 0) {
    return <></>
  }

  const visibleDrivers = drivers.slice(0, limit)
  const hiddenDrivers = drivers.slice(limit)
  const hasMore = hiddenDrivers.length > 0

  const getPolarityIcon = (polarity: 'up' | 'down' | 'neutral'): string => {
    switch (polarity) {
      case 'up':
        return '↑'
      case 'down':
        return '↓'
      default:
        return '→'
    }
  }

  const getPolarityColor = (polarity: 'up' | 'down' | 'neutral'): string => {
    switch (polarity) {
      case 'up':
        return 'text-practical-600'
      case 'down':
        return 'text-creative-600'
      default:
        return 'text-storm-600'
    }
  }

  return (
    <div className="border-t border-storm-100">
      <div className="p-6">
        <h3 className="text-sm font-semibold text-charcoal-900 mb-3">🎯 Top Drivers</h3>
        <div className="space-y-2">
          {visibleDrivers.map((driver, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 rounded-lg border border-storm-200 hover:border-analytical-300 hover:bg-analytical-50 transition-colors cursor-pointer"
            >
              <span className={`text-xl ${getPolarityColor(driver.polarity)}`}>
                {getPolarityIcon(driver.polarity)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-charcoal-900 text-sm">{driver.label}</div>
                {driver.action && (
                  <div className="text-xs text-storm-600 mt-1">{driver.action}</div>
                )}
              </div>
              <span className="text-xs font-medium text-storm-500">{driver.strength}</span>
            </div>
          ))}
        </div>

        {hasMore && (
          <ExpandableSection
            title={
              <span className="text-sm text-analytical-600 font-medium">
                Show {hiddenDrivers.length} more driver{hiddenDrivers.length > 1 ? 's' : ''}
              </span>
            }
            defaultOpen={false}
            className="mt-3 border-0"
          >
            <div className="space-y-2 mt-2">
              {hiddenDrivers.map((driver, idx) => (
                <div
                  key={idx + limit}
                  className="flex items-start gap-3 p-3 rounded-lg border border-storm-200 hover:border-analytical-300 hover:bg-analytical-50 transition-colors cursor-pointer"
                >
                  <span className={`text-xl ${getPolarityColor(driver.polarity)}`}>
                    {getPolarityIcon(driver.polarity)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-charcoal-900 text-sm">{driver.label}</div>
                    {driver.action && (
                      <div className="text-xs text-storm-600 mt-1">{driver.action}</div>
                    )}
                  </div>
                  <span className="text-xs font-medium text-storm-500">{driver.strength}</span>
                </div>
              ))}
            </div>
          </ExpandableSection>
        )}
      </div>
    </div>
  )
}

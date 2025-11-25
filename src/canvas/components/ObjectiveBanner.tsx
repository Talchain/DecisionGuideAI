/**
 * ObjectiveBanner Component
 *
 * Displays the current objective/goal at the top of Results and Compare views.
 * Shows goal direction (maximize/minimize) with appropriate icon.
 */

import { Target, TrendingUp, TrendingDown } from 'lucide-react'
import { typography } from '../../styles/typography'

interface ObjectiveBannerProps {
  objectiveText: string
  goalDirection: 'maximize' | 'minimize'
}

export function ObjectiveBanner({ objectiveText, goalDirection }: ObjectiveBannerProps) {
  const DirectionIcon = goalDirection === 'maximize' ? TrendingUp : TrendingDown
  const directionLabel = goalDirection === 'maximize' ? 'Maximize' : 'Minimize'

  return (
    <div
      className="flex items-start gap-3 p-3 bg-sky-50 border border-sky-200 rounded-lg"
      role="region"
      aria-label="Objective"
      data-testid="objective-banner"
    >
      <Target className="w-5 h-5 text-sky-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`${typography.label} text-sky-900`}>Your objective</span>
          <div className="flex items-center gap-1 text-sky-700">
            <DirectionIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="text-xs font-medium uppercase tracking-wide">{directionLabel}</span>
          </div>
        </div>
        <p className={`${typography.body} text-sky-900`}>{objectiveText}</p>
      </div>
    </div>
  )
}
